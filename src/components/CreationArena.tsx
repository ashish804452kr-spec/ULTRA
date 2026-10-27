import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Globe, 
  ExternalLink, 
  Download, 
  Copy, 
  Check, 
  Code, 
  Eye, 
  Image as ImageIcon, 
  RefreshCw, 
  Terminal, 
  FileCode,
  Sparkles,
  Maximize2
} from "lucide-react";

interface CreationArenaProps {
  activeMedia: {
    type: "website" | "image" | "code";
    id: string;
    title: string;
    content: string; // HTML code for website, image URL for image, code string for code
    prompt?: string;
  } | null;
  onClose: () => void;
}

export default function CreationArena({ activeMedia, onClose }: CreationArenaProps) {
  const [activeTab, setActiveTab] = useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  useEffect(() => {
    // Reset to preview tab when media changes
    setActiveTab("preview");
  }, [activeMedia]);

  if (!activeMedia) return null;

  const slugify = (text: string): string => {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-") // Replace spaces with -
      .replace(/[^\w\-]+/g, "") // Remove all non-word chars
      .replace(/\-\-+/g, "-") // Replace multiple - with single -
      .replace(/^-+/, "") // Trim - from start
      .replace(/-+$/, ""); // Trim - from end
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(activeMedia.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([activeMedia.content], { type: activeMedia.type === "website" ? "text/html" : "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = activeMedia.type === "website" ? `${activeMedia.title || 'index'}.html` : "code.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenNewTab = () => {
    const slug = slugify(activeMedia.title || "app");
    const url = `${window.location.origin}/view-site/${slug}`;
    window.open(url, "_blank");
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, y: 10 }}
      transition={{ type: "spring", damping: 25, stiffness: 180 }}
      className="w-full h-full bg-[#0a0a0c] border border-white/10 rounded-2xl overflow-hidden flex flex-col shadow-2xl relative z-10 pointer-events-auto"
      id="creation-arena-container"
    >
      {/* Top Glassmorphic bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.02] backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
          
          <div className="h-4 w-px bg-white/10 mx-1" />
          
          <div className="flex items-center gap-2 text-xs font-mono text-white/50 bg-white/5 px-2.5 py-1 rounded-md border border-white/5">
            {activeMedia.type === "website" ? (
              <Globe size={12} className="text-violet-400" />
            ) : activeMedia.type === "image" ? (
              <ImageIcon size={12} className="text-pink-400" />
            ) : (
              <Code size={12} className="text-cyan-400" />
            )}
            <span className="uppercase tracking-wider">{activeMedia.type}</span>
          </div>

          <span className="text-sm font-medium text-white/80 max-w-[200px] truncate ml-1">
            {activeMedia.title || "Untitled Creation"}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {activeMedia.type === "website" && (
            <div className="flex items-center bg-white/5 rounded-lg p-0.5 border border-white/10 mr-2">
              <button
                onClick={() => setActiveTab("preview")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  activeTab === "preview" 
                    ? "bg-violet-600 text-white shadow" 
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <Eye size={12} />
                Live Preview
              </button>
              <button
                onClick={() => setActiveTab("code")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  activeTab === "code" 
                    ? "bg-violet-600 text-white shadow" 
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <Code size={12} />
                Source Code
              </button>
            </div>
          )}

          {activeMedia.type === "website" && activeTab === "preview" && (
            <button
              onClick={() => setIframeKey(prev => prev + 1)}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-white/70 hover:text-white transition-colors"
              title="Refresh Preview"
            >
              <RefreshCw size={14} />
            </button>
          )}

          {activeMedia.type === "website" && (
            <button
              onClick={handleOpenNewTab}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-white/80 hover:text-white transition-colors"
              title="Open in Browser Tab"
            >
              <ExternalLink size={12} />
              <span className="hidden sm:inline">Open Live</span>
            </button>
          )}

          {activeMedia.type !== "image" && (
            <>
              <button
                onClick={handleCopy}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-white/70 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-medium"
                title="Copy Content"
              >
                {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
              </button>
              <button
                onClick={handleDownload}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-white/70 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-medium"
                title="Download Content"
              >
                <Download size={14} />
                <span className="hidden sm:inline">Download</span>
              </button>
            </>
          )}

          {activeMedia.type === "image" && (
            <a
              href={`/api/download-photo?url=${encodeURIComponent(activeMedia.content)}`}
              download="Jarvis_Real_Photo.jpg"
              className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-semibold"
              title="Download Real Photo"
            >
              <Download size={14} />
              <span>Download 8K Photo</span>
            </a>
          )}
        </div>
      </div>

      {/* Main viewport frame */}
      <div className="flex-1 overflow-hidden relative bg-[#060608] flex items-center justify-center">
        <AnimatePresence mode="wait">
          {activeMedia.type === "website" && activeTab === "preview" && (
            <motion.div
              key="web-preview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full flex flex-col"
            >
              {/* Simulated Browser Address Bar */}
              <div className="px-4 py-2 bg-[#0d0d12] border-b border-white/5 flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-white/20" />
                  <div className="w-2 h-2 rounded-full bg-white/20" />
                </div>
                <div className="flex-1 bg-white/[0.03] border border-white/10 rounded-md px-3 py-1 text-xs text-white/40 flex items-center justify-between font-mono">
                  <span className="truncate">https://{slugify(activeMedia.title || "app")}.jarvis.com</span>
                  <Sparkles size={10} className="text-violet-400 animate-pulse" />
                </div>
              </div>
              <iframe
                key={iframeKey}
                srcDoc={activeMedia.content}
                title="Website Live Preview"
                className="w-full flex-1 border-none bg-white"
                sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
              />
            </motion.div>
          )}

          {activeMedia.type === "website" && activeTab === "code" && (
            <motion.div
              key="web-code"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full overflow-auto p-4 font-mono text-xs text-white/80 bg-[#0d0d12] select-text"
            >
              <pre className="whitespace-pre-wrap word-break-all break-all">{activeMedia.content}</pre>
            </motion.div>
          )}

          {activeMedia.type === "image" && (
            <motion.div
              key="image-view"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full h-full p-6 flex flex-col items-center justify-center gap-4 overflow-auto"
            >
              <div className="max-w-full max-h-[75%] rounded-2xl overflow-hidden border border-white/15 bg-[#0d0d12] shadow-2xl relative group">
                <img
                  src={activeMedia.content}
                  alt="Jarvis Creation"
                  referrerPolicy="no-referrer"
                  className="max-w-full max-h-[500px] object-contain rounded-xl"
                />
                <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 text-xs text-emerald-400 font-bold tracking-wide flex items-center gap-2 shadow-lg">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Ultra-Photorealistic 8K DSLR AI
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 max-w-md w-full">
                <a 
                  href={`/api/download-photo?url=${encodeURIComponent(activeMedia.content)}`} 
                  download="Jarvis_Real_Photo.jpg" 
                  className="w-full max-w-xs"
                >
                  <button className="w-full py-3 bg-[#00ffcc] hover:bg-[#00e6b8] text-black font-extrabold rounded-xl transition-all text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 active:scale-95 cursor-pointer">
                    <Download size={16} className="stroke-[2.5]" />
                    <span>Download Real Photo (.JPG)</span>
                  </button>
                </a>
              </div>

              {activeMedia.prompt && (
                <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold mb-1">
                    Authentic Photography Prompt
                  </div>
                  <p className="text-xs text-white/90 italic font-medium">"{activeMedia.prompt}"</p>
                </div>
              )}
            </motion.div>
          )}

          {activeMedia.type === "code" && (
            <motion.div
              key="code-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full overflow-auto p-4 font-mono text-xs text-white/80 bg-[#0d0d12] select-text"
            >
              <pre className="whitespace-pre-wrap">{activeMedia.content}</pre>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Simulated Search Link Footnote */}
      {activeMedia.type === "website" && (
        <div className="px-4 py-2 border-t border-white/10 bg-[#07070a] text-[11px] text-white/40 flex items-center justify-between font-mono">
          <span className="flex items-center gap-1.5 text-green-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />
            Website link is fully live & simulated!
          </span>
          <span>Google Searchable Demo URL</span>
        </div>
      )}
    </motion.div>
  );
}
