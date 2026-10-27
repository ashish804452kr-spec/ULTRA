import React, { useEffect, useRef, useState } from "react";
import { Play, Pause, Download, Volume2, VolumeX, Film, Loader2, Sparkles, Check } from "lucide-react";

interface JarvisVideoPlayerProps {
  prompt: string;
  bgImage: string;
}

export default function JarvisVideoPlayer({ prompt, bgImage }: JarvisVideoPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileProgress, setCompileProgress] = useState(0);
  const [compiledUrl, setCompiledUrl] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  
  const imageRef = useRef<HTMLImageElement | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const oscillatorsRef = useRef<OscillatorNode[]>([]);

  // Load Background Image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = bgImage;
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
    };
    img.onerror = () => {
      // Fallback: reload without anonymous if CORS fails
      const imgFallback = new Image();
      imgFallback.src = bgImage;
      imgFallback.onload = () => {
        imageRef.current = imgFallback;
        setImageLoaded(true);
      };
    };
  }, [bgImage]);

  // Audio Synthesis Loop for Cinematic Ambient Sound
  const startAudio = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      // Create main gain node
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(isMuted ? 0 : 0.15, ctx.currentTime);
      masterGain.connect(ctx.destination);
      gainNodeRef.current = masterGain;

      // Deep cinematic synth pad oscillator
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();

      osc1.type = "sawtooth";
      osc1.frequency.setValueAtTime(55, ctx.currentTime); // A1 note
      
      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(110, ctx.currentTime); // A2 note

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(300, ctx.currentTime);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(masterGain);

      osc1.start();
      osc2.start();
      oscillatorsRef.current = [osc1, osc2];

      // Play ambient sound effects based on prompt
      const lowPrompt = prompt.toLowerCase();
      if (lowPrompt.includes("rain") || lowPrompt.includes("water") || lowPrompt.includes("storm")) {
        // Synthesize rain noise
        const bufferSize = ctx.sampleRate * 2;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }
        const whiteNoise = ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = "bandpass";
        noiseFilter.frequency.setValueAtTime(400, ctx.currentTime);

        whiteNoise.connect(noiseFilter);
        noiseFilter.connect(masterGain);
        whiteNoise.start();
        oscillatorsRef.current.push(whiteNoise as any);
      } else if (lowPrompt.includes("space") || lowPrompt.includes("star") || lowPrompt.includes("future")) {
        // Space futuristic cosmic wind filter sweep
        const sweepFilter = ctx.createBiquadFilter();
        sweepFilter.type = "lowpass";
        sweepFilter.frequency.setValueAtTime(100, ctx.currentTime);
        sweepFilter.Q.setValueAtTime(10, ctx.currentTime);

        const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseBuffer.length; i++) {
          output[i] = Math.random() * 2 - 1;
        }
        const spaceNoise = ctx.createBufferSource();
        spaceNoise.buffer = noiseBuffer;
        spaceNoise.loop = true;

        spaceNoise.connect(sweepFilter);
        sweepFilter.connect(masterGain);
        spaceNoise.start();
        oscillatorsRef.current.push(spaceNoise as any);

        // Slow frequency sweep animation
        let dir = 1;
        let freq = 100;
        const sweepInterval = setInterval(() => {
          if (!isPlaying || isMuted) return;
          freq += dir * 2;
          if (freq > 800 || freq < 100) dir = -dir;
          sweepFilter.frequency.setValueAtTime(freq, ctx.currentTime);
        }, 30);
        
        return () => clearInterval(sweepInterval);
      }
    } catch (e) {
      console.error("Audio synthesis failed:", e);
    }
  };

  const stopAudio = () => {
    try {
      oscillatorsRef.current.forEach(osc => {
        try { osc.stop(); } catch(e) {}
      });
      oscillatorsRef.current = [];
    } catch (e) {}
  };

  // Toggle Mute State
  useEffect(() => {
    if (gainNodeRef.current && audioCtxRef.current) {
      gainNodeRef.current.gain.setValueAtTime(isMuted ? 0 : 0.15, audioCtxRef.current.currentTime);
    }
  }, [isMuted]);

  // Audio start/stop on play state
  useEffect(() => {
    if (isPlaying && !isMuted) {
      startAudio();
    } else {
      stopAudio();
    }
    return () => stopAudio();
  }, [isPlaying, isMuted]);

  // Particle and Canvas Animation System
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageLoaded || !isPlaying) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width = 600;
    const height = canvas.height = 600;

    // Define custom particle structures based on prompt
    const lowPrompt = prompt.toLowerCase();
    let particles: Array<{
      x: number;
      y: number;
      size: number;
      speedY: number;
      speedX: number;
      alpha: number;
      color: string;
      angle?: number;
    }> = [];

    const numParticles = lowPrompt.includes("rain") ? 80 
                       : lowPrompt.includes("snow") ? 60 
                       : lowPrompt.includes("star") || lowPrompt.includes("space") ? 100
                       : lowPrompt.includes("city") || lowPrompt.includes("future") || lowPrompt.includes("cyber") ? 50
                       : 40; // Default embers

    // Particle initializer
    for (let i = 0; i < numParticles; i++) {
      if (lowPrompt.includes("rain")) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: Math.random() * 2 + 1,
          speedY: Math.random() * 8 + 8,
          speedX: Math.random() * 1 - 0.5,
          alpha: Math.random() * 0.4 + 0.3,
          color: "rgba(174, 219, 255, 0.7)"
        });
      } else if (lowPrompt.includes("snow")) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: Math.random() * 3 + 1,
          speedY: Math.random() * 1 + 0.5,
          speedX: Math.random() * 0.6 - 0.3,
          alpha: Math.random() * 0.5 + 0.4,
          color: "rgba(255, 255, 255, 0.8)",
          angle: Math.random() * Math.PI * 2
        });
      } else if (lowPrompt.includes("space") || lowPrompt.includes("star") || lowPrompt.includes("galaxy")) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: Math.random() * 1.5 + 0.5,
          speedY: 0,
          speedX: 0,
          alpha: Math.random(),
          color: `rgba(255, 255, 255, ${Math.random()})`,
          angle: Math.random() * 0.05 + 0.01 // Twinkle speed
        });
      } else if (lowPrompt.includes("city") || lowPrompt.includes("future") || lowPrompt.includes("cyber") || lowPrompt.includes("neon")) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: Math.random() * 2 + 1,
          speedY: -(Math.random() * 2 + 1), // Rise up
          speedX: 0,
          alpha: Math.random() * 0.6 + 0.2,
          color: i % 2 === 0 ? "rgba(0, 255, 204, 0.8)" : "rgba(236, 72, 153, 0.8)"
        });
      } else {
        // Default warm embers drifting up
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height + height/2,
          size: Math.random() * 3 + 1,
          speedY: -(Math.random() * 1.5 + 0.5),
          speedX: Math.random() * 0.8 - 0.4,
          alpha: Math.random() * 0.6 + 0.4,
          color: i % 2 === 0 ? "rgba(249, 115, 22, 0.8)" : "rgba(239, 68, 68, 0.8)" // Orange/Red embers
        });
      }
    }

    let frame = 0;
    
    const draw = () => {
      if (!isPlaying || !canvas || !ctx) return;
      frame++;

      ctx.clearRect(0, 0, width, height);

      // 1. Draw Background Image with Cinematic Ken Burns Zoom
      if (imageRef.current) {
        // Pan/scale oscillates with sine wave
        const scale = 1.05 + Math.sin(frame * 0.002) * 0.05; // Gentle scaling between 1.0 and 1.10
        const panX = Math.cos(frame * 0.0015) * 15;
        const panY = Math.sin(frame * 0.001) * 15;

        ctx.save();
        ctx.translate(width / 2 + panX, height / 2 + panY);
        ctx.scale(scale, scale);
        ctx.drawImage(imageRef.current, -width / 2, -height / 2, width, height);
        ctx.restore();
      }

      // 2. Overlay Vignette / Cinematic Lighting
      const gradient = ctx.createRadialGradient(width/2, height/2, width/4, width/2, height/2, width * 0.7);
      gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0.65)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // 3. Draw and Update Particles
      particles.forEach((p, idx) => {
        ctx.save();
        
        if (lowPrompt.includes("rain")) {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.speedX * 2, p.y + 12);
          ctx.stroke();

          // Update position
          p.y += p.speedY;
          p.x += p.speedX;
          if (p.y > height) {
            p.y = -10;
            p.x = Math.random() * width;
          }
        } 
        else if (lowPrompt.includes("snow")) {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();

          // Gentle sway using sine of angle
          p.angle = (p.angle || 0) + 0.02;
          p.y += p.speedY;
          p.x += p.speedX + Math.sin(p.angle) * 0.3;
          if (p.y > height) {
            p.y = -10;
            p.x = Math.random() * width;
          }
        } 
        else if (lowPrompt.includes("space") || lowPrompt.includes("star") || lowPrompt.includes("galaxy")) {
          // Twinkling stars
          p.alpha += p.angle || 0.01;
          if (p.alpha > 1 || p.alpha < 0) {
            p.angle = -(p.angle || 0.01);
            p.alpha = Math.max(0, Math.min(1, p.alpha));
          }
          ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } 
        else if (lowPrompt.includes("city") || lowPrompt.includes("future") || lowPrompt.includes("cyber") || lowPrompt.includes("neon")) {
          // Digital code streams/glowing data beams
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 10;
          ctx.shadowColor = p.color;
          ctx.fillRect(p.x, p.y, p.size, p.size * 6);
          
          p.y += p.speedY;
          if (p.y < -30) {
            p.y = height + 10;
            p.x = Math.random() * width;
          }
        } 
        else {
          // Ember particles
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 8;
          ctx.shadowColor = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();

          p.y += p.speedY;
          p.x += p.speedX + Math.sin(frame * 0.02 + idx) * 0.2;
          p.alpha -= 0.002;
          if (p.y < -10 || p.alpha <= 0) {
            p.y = height + Math.random() * 50;
            p.x = Math.random() * width;
            p.alpha = Math.random() * 0.6 + 0.4;
          }
        }
        ctx.restore();
      });

      // 4. Subtle glowing film grains / overlays
      ctx.fillStyle = "rgba(255, 255, 255, 0.015)";
      for (let j = 0; j < 5; j++) {
        ctx.fillRect(Math.random() * width, Math.random() * height, 2, 2);
      }

      animationFrameId.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [isPlaying, imageLoaded, prompt]);

  // Compile Canvas to REAL WebM Video file
  const compileVideo = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsCompiling(true);
    setCompileProgress(10);

    const stream = canvas.captureStream(30); // Capture at 30 FPS
    
    // Check supported types
    let mimeType = "video/webm;codecs=vp9";
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = "video/webm";
    }

    try {
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      // Progress animation simulation
      const progressInterval = setInterval(() => {
        setCompileProgress(prev => {
          if (prev >= 95) {
            clearInterval(progressInterval);
            return 95;
          }
          return prev + 5;
        });
      }, 250);

      recorder.onstop = () => {
        clearInterval(progressInterval);
        const videoBlob = new Blob(chunks, { type: "video/webm" });
        const videoUrl = URL.createObjectURL(videoBlob);
        setCompiledUrl(videoUrl);
        setCompileProgress(100);
        
        // Trigger download automatically
        const link = document.createElement("a");
        link.href = videoUrl;
        link.download = `${slugify(prompt || "cinematic_video")}.webm`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => {
          setIsCompiling(false);
        }, 1200);
      };

      // Record exactly 5 seconds
      recorder.start();
      setTimeout(() => {
        recorder.stop();
      }, 5000);

    } catch (err) {
      console.error("Recording error:", err);
      setIsCompiling(false);
    }
  };

  const slugify = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^\w\-]+/g, "");
  };

  return (
    <div className="w-full bg-[#0c0c10]/95 border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col my-3">
      {/* Video screen container */}
      <div className="relative aspect-square w-full bg-black flex items-center justify-center overflow-hidden">
        {!imageLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/40 bg-[#07070a]">
            <Loader2 className="animate-spin text-violet-500" size={32} />
            <p className="text-xs font-medium tracking-wide">Synthesizing cinematic visuals...</p>
          </div>
        )}

        <canvas 
          ref={canvasRef} 
          className="w-full h-full object-cover transition-opacity duration-500"
          style={{ opacity: imageLoaded ? 1 : 0 }}
        />

        {/* Video Prompt Overlay Badge */}
        <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-[10px] text-violet-300 font-semibold uppercase tracking-wider flex items-center gap-1.5 shadow-lg">
          <Film size={11} className="animate-pulse" />
          AI Cinematic Video
        </div>

        {/* Compiling/Downloading Progress Overlay */}
        {isCompiling && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-10 transition-all">
            <div className="relative mb-4">
              <Loader2 className="animate-spin text-[#00ffcc]" size={48} />
              <Sparkles className="absolute -top-1 -right-1 text-yellow-400 animate-bounce" size={16} />
            </div>
            <h3 className="text-sm font-extrabold tracking-wide text-white mb-1 uppercase">Compiling Video File</h3>
            <p className="text-[11px] text-white/50 max-w-xs mb-4">Encoding cinematic particles, animations, and sound effects to local storage...</p>
            
            {/* Progress bar */}
            <div className="w-full max-w-xs bg-white/10 h-1.5 rounded-full overflow-hidden border border-white/5">
              <div 
                className="bg-[#00ffcc] h-full transition-all duration-300 shadow-[0_0_10px_#00ffcc]"
                style={{ width: `${compileProgress}%` }}
              />
            </div>
            <span className="text-[10px] text-[#00ffcc] font-mono mt-1.5 font-bold">{compileProgress}% Completed</span>
          </div>
        )}
      </div>

      {/* Control Panel Footer */}
      <div className="p-3 bg-white/[0.02] border-t border-white/5 flex items-center justify-between gap-3">
        {/* Play/Pause controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            disabled={!imageLoaded}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white hover:scale-105 active:scale-95 transition-all border border-white/5 disabled:opacity-40"
            title={isPlaying ? "Pause Video" : "Play Video"}
          >
            {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
          </button>

          <button
            onClick={() => setIsMuted(!isMuted)}
            disabled={!imageLoaded}
            className={`p-2.5 rounded-xl transition-all border ${
              isMuted 
                ? "bg-white/5 border-white/5 text-white/50 hover:text-white" 
                : "bg-violet-600/20 border-violet-500/30 text-violet-400 hover:bg-violet-600/30"
            } hover:scale-105 active:scale-95`}
            title={isMuted ? "Unmute Ambient Sound" : "Mute Ambient Sound"}
          >
            {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
        </div>

        {/* Download Button */}
        <button
          onClick={compileVideo}
          disabled={!imageLoaded || isCompiling}
          className="flex-1 max-w-[180px] py-2 px-3 bg-[#00ffcc] hover:bg-[#00e6b8] text-black hover:scale-[1.02] active:scale-95 font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-xs shadow-lg shadow-cyan-500/10 disabled:opacity-50 border-none"
        >
          {compiledUrl ? <Check size={14} className="stroke-[3px]" /> : <Download size={14} className="stroke-[3px]" />}
          <span>{compiledUrl ? "Video Downloaded" : "Download Video"}</span>
        </button>
      </div>
      
      {/* Mini info overlay */}
      <div className="px-3 pb-3 text-[10px] text-white/30 italic font-mono flex items-center gap-1.5 justify-center">
        <Sparkles size={10} className="text-violet-400" />
        Kinetic particle dynamics rendered in real-time
      </div>
    </div>
  );
}
