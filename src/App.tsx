import React, { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, Loader2, Volume2, VolumeX, Keyboard, Send, Trash2, LogIn, LogOut, MessageCircle, X, Sparkles, Terminal, Code as CodeIcon, Globe, Maximize2, ExternalLink, Plus, Image as ImageIcon, Download, Camera } from "lucide-react";
import { resetJarvisSession } from "./services/geminiService";
import { processCommand } from "./services/commandService";
import { LiveSessionManager } from "./services/liveService";
import Visualizer from "./components/Visualizer";
import PermissionModal from "./components/PermissionModal";
import CreationArena from "./components/CreationArena";
import JarvisVideoPlayer from "./components/JarvisVideoPlayer";
import { playPCM } from "./utils/audioUtils";
import { motion, AnimatePresence } from "motion/react";
import { syncUser, getMessages, saveMessage, clearMessages, sendChatCommand, getTtsAudio } from "./lib/api.ts";

type AppState = "idle" | "listening" | "processing" | "speaking";

interface ChatMessage {
  id: string;
  sender: "user" | "zoya";
  text: string;
  imageUrl?: string;
  htmlContent?: string;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function App() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);
  const [selectedImageBase64, setSelectedImageBase64] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    const initApp = async () => {
      try {
        await syncUser();
        const msgs = await getMessages();
        setMessages(msgs);
      } catch (e) {
        console.error("Failed to load data", e);
      }
    };
    initApp();
  }, []);

  const [isMuted, setIsMuted] = useState(false);
  const [showChatLog, setShowChatLog] = useState(false);
  const [activeMedia, setActiveMedia] = useState<{
    type: "website" | "image" | "code";
    id: string;
    title: string;
    content: string;
    prompt?: string;
  } | null>(null);

  useEffect(() => {
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.sender === "zoya") {
        if (lastMsg.htmlContent) {
          setActiveMedia({
            type: "website",
            id: lastMsg.id,
            title: "Generated Web Application",
            content: lastMsg.htmlContent,
            prompt: lastMsg.text
          });
          setShowChatLog(true);
        } else if (lastMsg.imageUrl) {
          setActiveMedia({
            type: "image",
            id: lastMsg.id,
            title: "Generated Image Artwork",
            content: lastMsg.imageUrl,
            prompt: lastMsg.text
          });
          setShowChatLog(true);
        }
      }
    }
  }, [messages]);

  useEffect(() => {
    if (liveSessionRef.current) {
      liveSessionRef.current.isMuted = isMuted;
    }
  }, [isMuted]);

  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);

  const liveSessionRef = useRef<LiveSessionManager | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (showChatLog) {
      scrollToBottom();
    }
  }, [messages, showChatLog]);

  const handleTextCommand = useCallback(async (finalTranscript: string, imageBase64?: string | null) => {
    if (!finalTranscript.trim()) {
      setAppState("idle");
      return;
    }

    try {
      const msg = await saveMessage("user", finalTranscript);
      setMessages((prev) => [...prev, { 
        id: msg.id, 
        sender: "user", 
        text: finalTranscript,
        imageUrl: imageBase64 ? `data:image/jpeg;base64,${imageBase64}` : undefined
      }]);
    } catch(e) {
      console.error(e);
      setMessages((prev) => [...prev, { 
        id: Date.now().toString(), 
        sender: "user", 
        text: finalTranscript,
        imageUrl: imageBase64 ? `data:image/jpeg;base64,${imageBase64}` : undefined
      }]);
    }
    
    // If live session is active, send text through it
    if (isSessionActive && liveSessionRef.current) {
      liveSessionRef.current.sendText(finalTranscript);
      return;
    }

    setAppState("processing");

    // 1. Check for browser commands
    const commandResult = processCommand(finalTranscript);

    let responseText = "";

    if (commandResult.isBrowserAction) {
      responseText = commandResult.action;
      
      try {
        const msg = await saveMessage("zoya", responseText);
        setMessages((prev) => [...prev, { id: msg.id, sender: "zoya", text: responseText }]);
      } catch(e) {
        console.error(e);
        setMessages((prev) => [...prev, { id: Date.now().toString() + "-z", sender: "zoya", text: responseText }]);
      }
      
      if (!isMuted) {
        setAppState("speaking");
        try {
          const audioBase64 = await getTtsAudio(responseText);
          if (audioBase64) {
            await playPCM(audioBase64);
          }
        } catch(e) { console.error("TTS Error:", e); }
      }

      setAppState("idle");

      setTimeout(() => {
        if (commandResult.url) {
          window.open(commandResult.url, "_blank");
        }
      }, 1500);
    } else {
      // 2. General Chit-Chat via Gemini Server API
      try {
        const responseObj = await sendChatCommand(finalTranscript, messagesRef.current, imageBase64);
        setMessages((prev) => [...prev, responseObj]);
        
        if (responseObj.imageUrl || responseObj.htmlContent) {
          setShowChatLog(true);
        }
        
        responseText = responseObj.text;
        if (!isMuted && responseText) {
          setAppState("speaking");
          const audioBase64 = await getTtsAudio(responseText);
          if (audioBase64) {
            await playPCM(audioBase64);
          }
        }
      } catch(e) {
        console.error("Chat command error:", e);
      }
      
      setAppState("idle");
    }
  }, [isMuted, isSessionActive]);

  useEffect(() => {
    return () => {
      if (liveSessionRef.current) {
        liveSessionRef.current.stop();
      }
    };
  }, []);

  const toggleListening = async () => {
    if (isSessionActive) {
      setIsSessionActive(false);
      if (liveSessionRef.current) {
        liveSessionRef.current.stop();
        liveSessionRef.current = null;
      }
      setAppState("idle");
      resetJarvisSession();
    } else {
      try {
        setIsSessionActive(true);
        resetJarvisSession();
        
        const session = new LiveSessionManager();
        session.isMuted = isMuted;
        liveSessionRef.current = session;
        
        session.onStateChange = (state) => {
          setAppState(state);
        };
        
        session.onMessage = (sender, text) => {
          setMessages((prev) => [...prev, { id: Date.now().toString() + "-" + sender, sender, text }]);
        };
        
        session.onCommand = (url) => {
          setTimeout(() => {
            window.open(url, "_blank");
          }, 1000);
        };

        session.onMediaGenerate = async (type, prompt) => {
          try {
            const responseObj = await sendChatCommand(`Generate a ${type} with this description: ${prompt}`, messagesRef.current);
            setMessages((prev) => [...prev, responseObj]);
            setShowChatLog(true);
          } catch(e) {
            console.error("Failed to generate media from voice:", e);
          }
        };

        await session.start();
      } catch (e) {
        console.error("Failed to start session", e);
        setShowPermissionModal(true);
        setIsSessionActive(false);
        setAppState("idle");
      }
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() && !selectedImageBase64) return;
    
    handleTextCommand(textInput || "Analyze this image", selectedImageBase64);
    setTextInput("");
    setSelectedImagePreview(null);
    setSelectedImageBase64(null);
    setShowTextInput(false);
  };

  const renderMessageText = (text: string, msgId: string) => {
    const parts = text.split(/(```[a-z]*\n[\s\S]*?\n```)/gi);
    if (parts.length <= 1) {
      return <span className="whitespace-pre-wrap">{text}</span>;
    }

    return (
      <div className="space-y-3 w-full overflow-hidden">
        {parts.map((part, index) => {
          if (part.startsWith("```")) {
            const match = part.match(/```([a-z]*)\n([\s\S]*?)\n```/i);
            const lang = match ? match[1] : "";
            const code = match ? match[2] : part.slice(3, -3);

            return (
              <div key={index} className="my-2 rounded-lg bg-black/40 border border-white/10 overflow-hidden text-xs font-mono w-full">
                <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/10 text-[10px] text-white/40">
                  <span>{lang.toUpperCase() || "CODE"}</span>
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(code);
                      }} 
                      className="hover:text-white transition-colors"
                    >
                      Copy
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        setActiveMedia({
                          type: "code",
                          id: msgId + "-" + index,
                          title: `${lang.toUpperCase() || "Code"} Snippet`,
                          content: code
                        });
                        setShowChatLog(true);
                      }} 
                      className="text-violet-400 hover:text-violet-300 transition-colors font-semibold"
                    >
                      View Full Screen
                    </button>
                  </div>
                </div>
                <pre className="p-3 overflow-x-auto whitespace-pre">{code}</pre>
              </div>
            );
          } else {
            return <span key={index} className="whitespace-pre-wrap">{part}</span>;
          }
        })}
      </div>
    );
  };



  return (
    <div className="h-[100dvh] w-screen bg-[#050505] text-white flex flex-col items-center justify-between font-sans relative overflow-hidden m-0 p-0">
      <input 
        type="file" 
        ref={fileInputRef} 
        accept="image/*" 
        style={{ display: "none" }} 
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
              const dataUrl = ev.target?.result as string;
              setSelectedImagePreview(dataUrl);
              setSelectedImageBase64(dataUrl.split(",")[1]);
            };
            reader.readAsDataURL(file);
          }
        }} 
      />
      {showPermissionModal && (
        <PermissionModal 
          onClose={() => setShowPermissionModal(false)} 
        />
      )}

      {/* Cinematic Background Gradients */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-violet-900/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-pink-900/20 blur-[120px] rounded-full" />
      </div>

      {/* Header */}
      <header className="absolute top-0 left-0 w-full flex justify-between items-center z-20 shrink-0 px-6 py-4 md:px-12 md:py-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-500 to-pink-500 flex items-center justify-center font-bold text-sm">
            J
          </div>
          <h1 className="text-xl font-serif font-medium tracking-wide opacity-90">Jarvis</h1>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={async () => {
                if (confirm("Are you sure you want to clear the chat history?")) {
                  try {
                    await clearMessages();
                    setMessages([]);
                    resetJarvisSession();
                  } catch(e) {
                    console.error("Failed to clear messages", e);
                  }
                }
              }}
              className="p-2 rounded-full bg-white/5 hover:bg-red-500/20 hover:text-red-400 transition-colors border border-white/10"
              title="Clear Chat History"
            >
              <Trash2 size={18} className="opacity-70" />
            </button>
          )}
          <button
            onClick={() => setShowChatLog(!showChatLog)}
            className={`p-2 rounded-full transition-colors border border-white/10 ${showChatLog ? 'bg-violet-500 hover:bg-violet-600' : 'bg-white/5 hover:bg-white/10'}`}
            title="Chat & Media Log"
          >
            <MessageCircle size={18} className="opacity-70" />
          </button>
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <VolumeX size={18} className="opacity-70" />
            ) : (
              <Volume2 size={18} className="opacity-70" />
            )}
          </button>
        </div>
      </header>

      {/* Main Content - Unified Split Workspace / Ambient Canvas */}
      {showChatLog ? (
        <main className="absolute inset-0 flex flex-col md:flex-row gap-6 w-full h-full z-10 overflow-hidden pt-24 pb-6 px-4 md:px-12 pointer-events-none">
          {/* Left Panel: Command Console & Conversational Thread */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="w-full md:w-[380px] lg:w-[420px] bg-[#0c0c0e]/85 backdrop-blur-xl border border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-2xl pointer-events-auto h-full"
          >
            {/* Thread Header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10 bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-violet-500 animate-pulse" />
                <h2 className="font-serif text-sm font-medium text-white/95 tracking-wide">Jarvis Console</h2>
              </div>
              <button 
                onClick={() => setShowChatLog(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 border border-transparent hover:border-white/10 text-white/50 hover:text-white transition-all"
                title="Minimize Log"
              >
                <X size={16} />
              </button>
            </div>

            {/* Conversation Messages */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-6 text-white/35">
                  <Sparkles size={28} className="text-violet-400/50 mb-3 animate-pulse" />
                  <div className="text-sm font-medium">No activity yet</div>
                  <p className="text-xs mt-1 max-w-[200px]">Type below to generate fully working websites, photos, or code snippets instantly!</p>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div key={msg.id || i} className={`flex flex-col max-w-[85%] ${msg.sender === "user" ? "self-end items-end" : "self-start items-start"}`}>
                    <div className={`text-[10px] uppercase tracking-wider font-semibold text-white/45 mb-1 ${msg.sender === "user" ? "mr-1" : "ml-1"}`}>
                      {msg.sender === "user" ? "You" : "Jarvis"}
                    </div>
                    
                    <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed border select-text ${
                      msg.sender === "user" 
                        ? "bg-violet-600 text-white border-violet-500/20 rounded-br-none shadow-md" 
                        : "bg-white/[0.07] text-white/90 border-white/5 rounded-bl-none shadow-sm"
                    }`}>
                      {renderMessageText(msg.text, msg.id || String(i))}
                    </div>

                    {/* Deployed website URL Google style widget inside Chat Thread */}
                    {msg.htmlContent && (
                      <div className="mt-3.5 w-full rounded-xl overflow-hidden border border-green-500/25 bg-[#080d09] p-3 flex flex-col gap-2 shadow-lg">
                        <div className="flex items-center gap-1.5 text-[10px] text-green-400 font-mono font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />
                          LIVE GOOGLE SEARCH DEMOPARK LINK
                        </div>
                        
                        <div className="bg-[#0b140d] p-2.5 rounded-lg border border-green-500/10">
                          <div className="text-[9px] text-green-400/80 font-mono truncate font-medium">
                            https://jarvis.build/live-app-{msg.id.slice(-6)}
                          </div>
                          <div className="text-xs font-bold text-white/95 hover:underline cursor-pointer mt-0.5 line-clamp-1" onClick={() => {
                            setActiveMedia({
                              type: "website",
                              id: msg.id,
                              title: "Generated Website",
                              content: msg.htmlContent!
                            });
                          }}>
                            {msg.text ? msg.text.replace(/generate a website with this description:/i, "").trim() : "Interactive Web Page"}
                          </div>
                          <div className="text-[10px] text-white/40 mt-1 leading-snug">
                            This real website compiled successfully. Open to play with its interactive CSS/JS!
                          </div>
                        </div>
                        
                        <div className="flex gap-2.5 justify-end">
                          <button onClick={() => {
                            const blob = new Blob([msg.htmlContent!], { type: 'text/html' });
                            const url = URL.createObjectURL(blob);
                            window.open(url, '_blank');
                          }} className="text-[11px] text-violet-400 hover:text-violet-300 font-semibold flex items-center gap-1 transition-colors">
                            <ExternalLink size={11} /> Open in Tab
                          </button>
                          <button onClick={() => {
                            setActiveMedia({
                              type: "website",
                              id: msg.id,
                              title: "Generated Website",
                              content: msg.htmlContent!
                            });
                          }} className="text-[11px] text-green-400 hover:text-green-300 font-semibold flex items-center gap-1 transition-colors">
                            <Maximize2 size={11} /> Open in Center Screen
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Image or Video visual preview card inside Chat Thread */}
                    {msg.imageUrl && (
                      msg.imageUrl.startsWith("video-prompt:") ? (
                        (() => {
                          const parts = msg.imageUrl.split("||bg:");
                          const videoPrompt = parts[0].replace("video-prompt:", "");
                          const videoBg = parts[1] || "";
                          return (
                            <JarvisVideoPlayer prompt={videoPrompt} bgImage={videoBg} />
                          );
                        })()
                      ) : (
                        <div className="mt-3.5 w-full rounded-2xl overflow-hidden border border-white/15 bg-black/50 p-2 flex flex-col gap-2 shadow-xl">
                          <div className="relative rounded-xl overflow-hidden group">
                            <img 
                              src={msg.imageUrl} 
                              alt="Photorealistic Creation" 
                              referrerPolicy="no-referrer"
                              className="w-full h-36 object-cover rounded-xl transition-transform duration-300 group-hover:scale-105" 
                            />
                            <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/20 text-[10px] text-emerald-400 font-bold tracking-wide flex items-center gap-1.5 shadow">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Ultra-Realistic 8K Photo
                            </div>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <button 
                              onClick={() => {
                                setActiveMedia({
                                  type: "image",
                                  id: msg.id,
                                  title: "Ultra-Photorealistic AI Photo",
                                  content: msg.imageUrl!,
                                  prompt: msg.text
                                });
                              }}
                              className="w-full py-1.5 text-xs font-semibold bg-white/10 text-white hover:bg-white/15 rounded-lg transition-all text-center flex items-center justify-center gap-1.5 border border-white/10"
                            >
                              <Maximize2 size={13} className="text-violet-400" />
                              View Full Size in Middle Screen
                            </button>
                            {msg.sender === "zoya" && (
                              <a 
                                href={`/api/download-photo?url=${encodeURIComponent(msg.imageUrl)}`} 
                                download="Jarvis_Real_Photo.jpg" 
                                className="block w-full"
                              >
                                <button className="w-full py-2 bg-[#00ffcc] hover:bg-[#00e6b8] text-black font-extrabold rounded-lg transition-all text-xs flex items-center justify-center gap-1.5 shadow-md shadow-cyan-500/20 active:scale-95 cursor-pointer">
                                  <Download size={13} className="stroke-[2.5]" />
                                  <span>Download Real Photo (.JPG)</span>
                                </button>
                              </a>
                            )}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Suggestions & Submit Drawer */}
            <div className="p-3 border-t border-white/10 bg-white/[0.01] flex flex-col gap-2">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                <button
                  type="button"
                  onClick={() => setTextInput("Ek realistic sunset me camera se khichi hui real photo banao")}
                  className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-emerald-400 font-medium whitespace-nowrap transition-all flex items-center gap-1"
                >
                  <Camera size={12} />
                  <span>📸 Real Photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTextInput("A dynamic cinematic video clip of futuristic cyber city in rain")}
                  className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-pink-400 font-medium whitespace-nowrap transition-all flex items-center gap-1"
                >
                  <Sparkles size={12} />
                  <span>🎬 Video</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTextInput("Create a retro arcade snake game website")}
                  className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-cyan-400 font-medium whitespace-nowrap transition-all flex items-center gap-1"
                >
                  <Globe size={12} />
                  <span>🌐 Web App</span>
                </button>
              </div>

              {selectedImagePreview && (
                <div className="flex items-center gap-2 p-1.5 bg-white/5 border border-white/10 rounded-xl relative group max-w-max">
                  <img src={selectedImagePreview} alt="Preview" className="w-10 h-10 rounded-lg object-cover" />
                  <button 
                    type="button" 
                    onClick={() => { setSelectedImagePreview(null); setSelectedImageBase64(null); }}
                    className="absolute -top-1 -right-1 p-0.5 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                  >
                    <X size={8} />
                  </button>
                </div>
              )}
              <form onSubmit={handleTextSubmit} className="flex items-center gap-2 bg-white/[0.04] border border-white/10 rounded-xl p-1 pl-3">
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-all"
                  title="Upload Image"
                >
                  <Plus size={16} />
                </button>
                <input 
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Ask: 'Ek real cat photo banao', 'photo of...', etc."
                  className="flex-1 bg-transparent border-none outline-none text-xs text-white placeholder:text-white/25"
                />
                <button 
                  type="submit"
                  disabled={!textInput.trim() && !selectedImageBase64}
                  className="p-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 transition-colors"
                >
                  <Send size={14} />
                </button>
              </form>
            </div>
          </motion.div>

          {/* Right Panel: Creation Arena OR Speech Visualizer (Middle Screen) */}
          <div className="flex-1 h-full flex flex-col items-center justify-center relative pointer-events-auto">
            <AnimatePresence mode="wait">
              {activeMedia ? (
                <motion.div
                  key="active-creation-panel"
                  className="w-full h-full flex flex-col"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ type: "spring", damping: 25 }}
                >
                  <CreationArena 
                    activeMedia={activeMedia} 
                    onClose={() => setActiveMedia(null)} 
                  />
                  <div className="flex justify-between items-center px-4 mt-2.5">
                    <button 
                      onClick={() => setActiveMedia(null)}
                      className="px-4 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-white/50 hover:text-white transition-all flex items-center gap-1.5"
                    >
                      <X size={12} /> Minimize Preview Screen
                    </button>
                    {appState !== "idle" && (
                      <span className="text-[11px] text-cyan-300 flex items-center gap-1.5 italic animate-pulse">
                        <Loader2 size={12} className="animate-spin" />
                        Jarvis is actively thinking...
                      </span>
                    )}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="visualizer-panel"
                  className="w-full h-full flex flex-col items-center justify-center relative select-none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="scale-90 flex items-center justify-center w-full h-full max-h-[70%]">
                    <Visualizer state={appState} />
                  </div>
                  <div className="absolute bottom-6 text-center text-xs text-white/30 tracking-wide font-mono">
                    {appState === "idle" ? "START VOICE SESSION OR COMMAND THE CONSOLE" : appState === "listening" ? "● LISTENING..." : appState === "processing" ? "● SYNTHESIZING RESPONSE..." : "● SPEAKING..."}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Persistent Mic floating trigger when Chat Log is opened */}
          <div className="absolute bottom-6 right-6 z-50 pointer-events-auto">
            <button
              onClick={toggleListening}
              className={`p-4 rounded-full shadow-2xl border transition-all duration-300 flex items-center justify-center ${
                isSessionActive
                  ? "bg-red-500/25 border-red-500/50 text-red-400 hover:bg-red-500/40"
                  : "bg-violet-600 border-violet-500/30 text-white hover:bg-violet-500 hover:scale-105"
              }`}
              title={isSessionActive ? "Stop Voice Session" : "Start Voice Session"}
            >
              {isSessionActive ? <MicOff size={22} /> : <Mic size={22} />}
            </button>
          </div>
        </main>
      ) : (
        /* Ambient/Voice Full Screen Cinematic Interface */
        <main className="absolute inset-0 flex flex-row items-center justify-between w-full h-full z-10 overflow-hidden pt-20 pb-24 px-4 md:px-12 pointer-events-none">
          {/* Jarvis Status */}
          <div className="flex w-[30%] lg:w-[25%] h-full flex-col justify-center gap-4 z-10">
            <div className="h-6">
              <AnimatePresence>
                {appState === "processing" && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex items-center gap-2 text-cyan-300/80 text-sm md:text-base italic font-serif"
                  >
                    <Loader2 size={16} className="animate-spin" />
                    Replying...
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Visualizer center */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
            <Visualizer state={appState} />
          </div>

          {/* User Status */}
          <div className="flex w-[30%] lg:w-[25%] h-full flex-col justify-center gap-4 z-10">
            <div className="h-6 flex justify-end">
              <AnimatePresence>
                {appState === "listening" && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex items-center gap-2 text-violet-300/80 text-sm md:text-base italic"
                  >
                    <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                    Listening...
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </main>
      )}

      {/* Controls Footer (Only shown when not inside the chat-focused split workspace) */}
      {!showChatLog && (
        <footer className="absolute bottom-0 left-0 w-full flex flex-col items-center justify-center pb-6 md:pb-8 z-20 shrink-0 gap-4">
          <AnimatePresence>
            {showTextInput && (
              <div className="w-full max-w-md flex flex-col items-center gap-2">
                {selectedImagePreview && (
                  <div className="flex items-center gap-2 p-1.5 bg-white/5 border border-white/10 rounded-xl mb-1 relative group max-w-max self-start ml-4">
                    <img src={selectedImagePreview} alt="Preview" className="w-10 h-10 rounded-lg object-cover" />
                    <button 
                      type="button" 
                      onClick={() => { setSelectedImagePreview(null); setSelectedImageBase64(null); }}
                      className="absolute -top-1 -right-1 p-0.5 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                    >
                      <X size={8} />
                    </button>
                  </div>
                )}
                <motion.form 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  onSubmit={handleTextSubmit}
                  className="w-full flex items-center gap-2 bg-white/5 border border-white/10 rounded-full p-1 pl-3 backdrop-blur-md shadow-2xl"
                >
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-all"
                    title="Upload Image"
                  >
                    <Plus size={16} />
                  </button>
                  <input 
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Type a message to Jarvis..."
                    className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/30 text-sm"
                    autoFocus
                  />
                  <button 
                    type="submit"
                    disabled={!textInput.trim() && !selectedImageBase64}
                    className="p-2 rounded-full bg-violet-500 hover:bg-violet-600 disabled:opacity-50 disabled:hover:bg-violet-500 transition-colors"
                  >
                    <Send size={16} />
                  </button>
                </motion.form>
              </div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-4">
            <button
              onClick={toggleListening}
              className={`
                group relative flex items-center gap-3 px-8 py-4 rounded-full font-medium tracking-wide transition-all duration-300 shadow-2xl
                ${
                  isSessionActive
                    ? "bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30"
                    : "bg-white/10 text-white border border-white/20 hover:bg-white/20 hover:scale-105"
                }
              `}
            >
              {isSessionActive ? (
                <>
                  <MicOff size={20} />
                  <span>End Session</span>
                </>
              ) : (
                <>
                  <Mic size={20} className="group-hover:animate-bounce" />
                  <span>Start Session</span>
                </>
              )}
            </button>
            
            {!isSessionActive && (
              <button
                onClick={() => setShowTextInput(!showTextInput)}
                className="p-4 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors shadow-2xl"
                title="Type instead"
              >
                <Keyboard size={20} className="opacity-70" />
              </button>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}
