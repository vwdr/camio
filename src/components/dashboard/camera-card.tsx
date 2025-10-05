"use client";

import { useState } from "react";
import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { acquireStream, releaseStream } from '@/lib/localStream';
import { getRecordings, saveRecording } from '@/lib/recordings';
import { useVideoAnalyzer } from '@/lib/useVideoAnalyzer';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CameraOff, PlayCircle, Shield, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface Camera {
  id: string;
  name: string;
  location: string;
  status: string;
  lastActivity: string;
  hasSecurity: boolean;
  isRecording?: boolean;
  isLocal?: boolean;
  thumbnailUrl?: string;
}

interface CameraCardProps {
  camera: Camera;
}

export function CameraCard({ camera }: CameraCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isLocalStreaming, setIsLocalStreaming] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const currentStreamCameraId = useRef<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { start: analyzerStart, stop: analyzerStop, detections, lastAnalysis, loadingModels } = useVideoAnalyzer({ enabled: true, fps: 1 });
  
  // In a real application, this would trigger a real camera stream
  const handleViewLive = () => {
    setIsLoading(true);
    // Redirect to the camera detail page
    window.location.href = `/cameras/${camera.id}`;
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const blobs = await getRecordings(camera.id);
        if (!mounted) return;
        if (Array.isArray(blobs) && blobs.length > 0) {
          const url = URL.createObjectURL(blobs[0]);
          setRecordingUrl(url);
          setHasRecording(true);
          return;
        }
      } catch (e) {
        // ignore and fallback
      }

      // Fallback to localStorage (data URLs)
      try {
        const raw = localStorage.getItem(`camio:recordings:${camera.id}`);
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr) && arr.length > 0) {
            setRecordingUrl(arr[0]);
            setHasRecording(true);
          }
        }
      } catch (e2) {
        console.error('Failed to read recordings', e2);
      }
    })();

    // If this is a local camera and it's marked recording but we have no saved recording yet,
    // show a live preview by requesting getUserMedia and attaching it to the video element.
  const startPreviewIfNeeded = async () => {
      if (camera.isLocal && camera.isRecording && !recordingUrl && !mediaStreamRef.current) {
        try {
          const stream = await acquireStream(camera.id);
          mediaStreamRef.current = stream;
          currentStreamCameraId.current = camera.id;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            try { await videoRef.current.play(); } catch (e) { /* ignore */ }
            setIsLocalStreaming(true);
          }
        } catch (e) {
          console.warn('Unable to start local preview', e);
        }
      }
    };

  startPreviewIfNeeded();

    return () => {
      mounted = false;
      if (recordingUrl && recordingUrl.startsWith('blob:')) URL.revokeObjectURL(recordingUrl);
  if (mediaStreamRef.current) {
        try {
          if (currentStreamCameraId.current) releaseStream(currentStreamCameraId.current as string);
        } catch (e) {
          mediaStreamRef.current?.getTracks().forEach(t => t.stop());
        } finally {
          mediaStreamRef.current = null;
          currentStreamCameraId.current = null;
        }
      }
    };
  }, [camera.id]);

  // start/stop analyzer when videoRef and canvasRef are available
  useEffect(() => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (v && c && camera.isLocal && camera.isRecording) {
      analyzerStart(v, c);
    } else {
      analyzerStop();
    }
    return () => analyzerStop();
  }, [videoRef.current, canvasRef.current, camera.isLocal, camera.isRecording]);

  // Render detection boxes into canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = video.videoWidth || canvas.width;
    canvas.height = video.videoHeight || canvas.height;
    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    try {
  const dets = detections || [];
      dets.forEach((d: any) => {
        const { bbox, label } = d;
        const x = Math.max(0, Math.floor(bbox.x * canvas.width));
        const y = Math.max(0, Math.floor(bbox.y * canvas.height));
        const w = Math.max(0, Math.floor(bbox.width * canvas.width));
        const h = Math.max(0, Math.floor(bbox.height * canvas.height));
        ctx.strokeStyle = 'rgba(16,185,129,0.9)'; // green
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = 'rgba(16,185,129,0.9)';
        ctx.font = '14px sans-serif';
        ctx.fillText(label, x + 4, y + 16);
      });
    } catch (e) {
      // ignore drawing errors
    }
  }, [detections, canvasRef.current, videoRef.current]);

  // Helper to convert blob to dataURL
  const blobToDataUrl = (blob: Blob) => new Promise<string>((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result as string);
    reader.onerror = rej;
    reader.readAsDataURL(blob);
  });

  // Save a short suspect clip from the current shared stream into IndexedDB
  const saveSuspectClip = async (seconds = 6) => {
    const stream = mediaStreamRef.current;
    if (!stream) {
      alert('No live stream available to record from');
      return;
    }
    try {
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      const p = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });
      recorder.start();
      await new Promise((r) => setTimeout(r, seconds * 1000));
      if (recorder.state !== 'inactive') recorder.stop();
      await p;
      const blob = new Blob(chunks, { type: 'video/webm' });
      try {
        await saveRecording(camera.id, blob);
        window.dispatchEvent(new CustomEvent('camio:recordings:updated', { detail: { cameraId: camera.id } }));
        setHasRecording(true);
        alert('Suspect clip saved locally');
      } catch (e) {
        // fallback to localStorage if IndexedDB fails
        const dataUrl = await blobToDataUrl(blob);
        const key = `camio:recordings:${camera.id}`;
        const raw = localStorage.getItem(key);
        const arr = raw ? JSON.parse(raw) as string[] : [];
        arr.unshift(dataUrl);
        localStorage.setItem(key, JSON.stringify(arr.slice(0,5)));
        window.dispatchEvent(new CustomEvent('camio:recordings:updated', { detail: { cameraId: camera.id } }));
        setHasRecording(true);
        alert('Suspect clip saved locally (fallback)');
      }
    } catch (e) {
      console.error('Failed to record suspect clip', e);
      alert('Failed to record suspect clip');
    }
  };

  const startLocalRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      mediaStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        try {
          const dataUrl = await blobToDataUrl(blob);
          const key = `camio:recordings:${camera.id}`;
          const raw = localStorage.getItem(key);
          const arr = raw ? JSON.parse(raw) as string[] : [];
          arr.unshift(dataUrl);
          // keep only last 5 recordings to avoid bloating storage
          localStorage.setItem(key, JSON.stringify(arr.slice(0,5)));
          window.dispatchEvent(new CustomEvent('camio:recordings:updated', { detail: { cameraId: camera.id } }));
          setHasRecording(true);
        } catch (e) {
          console.error('Failed to save recording', e);
        }
        // stop tracks
        mediaStreamRef.current?.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        setIsLocalStreaming(false);
      };
      recorder.start();
      setIsLocalStreaming(true);
      // auto-stop after 6 seconds for demo
      setTimeout(() => {
        if (recorder.state !== 'inactive') recorder.stop();
      }, 6000);
    } catch (e) {
      console.error('Failed to start local recording', e);
      alert('Camera access denied or not available');
    }
  };

  const stopLocalRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };
  
  // Card animation variants
  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { 
        type: "spring" as const, 
        stiffness: 100, 
        damping: 15 
      } 
    },
    hover: { 
      y: -5, 
      scale: 1.02,
      transition: {
        type: "spring" as const,
        stiffness: 400,
        damping: 10
      }
    }
  };
  
  const statusVariants = {
    online: {
      scale: [1, 1.15, 1],
      opacity: [0.7, 1, 0.7],
      transition: {
        repeat: Infinity,
        duration: 2
      }
    },
    offline: {
      opacity: 0.7
    }
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      whileHover="hover"
      variants={cardVariants}
    >
      <Card className={cn(
        "overflow-hidden",
        camera.status === "offline" && "opacity-70"
      )}>
      <CardHeader className="p-4">
        <div className="flex justify-between items-center">
          <CardTitle className="text-base">{camera.name}</CardTitle>
          <motion.div 
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
              camera.status === "online" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
            )}
            animate={camera.status === "online" ? "online" : "offline"}
            variants={statusVariants}
          >
            {camera.status === "online" ? (
              <>
                <motion.span 
                  className="h-1.5 w-1.5 rounded-full bg-green-500 mr-1"
                  animate={{
                    scale: [1, 1.5, 1],
                    opacity: [0.7, 1, 0.7],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 2,
                    ease: "easeInOut"
                  }}
                />
                Online
              </>
            ) : (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-gray-500 mr-1" />
                Offline
              </>
            )}
          </motion.div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative aspect-video bg-muted">
          {camera.isLocal && recordingUrl ? (
            <div className="relative w-full h-full overflow-hidden">
              <video
                src={recordingUrl}
                autoPlay
                muted
                loop
                className="absolute w-full h-full object-cover"
              />
              <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                LIVE
              </div>
            </div>
          ) : camera.isLocal && camera.isRecording && !recordingUrl ? (
            <div className="relative w-full h-full overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="absolute w-full h-full object-cover"
              />
              {/* overlay canvas for AI detections */}
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
              <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                LIVE
              </div>
            </div>
          ) : camera.status === "online" ? (
            camera.thumbnailUrl ? (
              <div className="relative w-full h-full overflow-hidden">
                {/* This would be a real video stream in a production app */}
                <video
                  autoPlay
                  muted
                  loop
                  className="absolute w-full h-full object-cover"
                  poster={camera.thumbnailUrl}
                >
                  {/* For demo purposes, we don't have actual video streams */}
                  {/* In a real app, we would use a WebRTC connection here */}
                </video>
                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                  LIVE
                </div>
              </div>
            ) : (
              <img
                src="/dashboard-preview.png"
                alt={camera.name}
                className="w-full h-full object-cover"
              />
            )
          ) : (
            camera.thumbnailUrl ? (
              <div className="relative w-full h-full">
                <Image 
                  src={camera.thumbnailUrl} 
                  alt={camera.name} 
                  fill
                  className="object-cover grayscale" 
                />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <CameraOff className="h-12 w-12 text-white/70" />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <CameraOff className="h-12 w-12 text-muted-foreground opacity-50" />
              </div>
            )
          )}
          
          {camera.hasSecurity && (
            <motion.div 
              className="absolute top-2 right-2"
              initial={{ scale: 0, rotate: -15 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ 
                type: "spring",
                stiffness: 260,
                damping: 20,
                delay: 0.3 
              }}
              whileHover={{ 
                rotate: [-5, 5, -5, 0],
                scale: 1.2,
                transition: { duration: 0.5 }
              }}
            >
              <Shield className="h-5 w-5 text-primary drop-shadow-md" />
            </motion.div>
          )}
          {camera.isRecording && (
            <div className="absolute top-2 left-2 inline-flex items-center gap-2 bg-red-600 text-white text-xs px-2 py-1 rounded-full">
              <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
              REC
            </div>
          )}
          {/* Model loading / analysis alert */}
          {loadingModels && (
            <div className="absolute bottom-2 left-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded-md">Loading models…</div>
          )}
          {lastAnalysis && !loadingModels && (
            (() => {
              const parts = lastAnalysis.split(':');
              const level = parts[0];
              const summary = parts.slice(1).join(':');
              return level && level !== 'none' ? (
                <div className={`absolute top-2 left-2 text-xs px-2 py-1 rounded-md ${level === 'high' ? 'bg-red-600 text-white' : level === 'medium' ? 'bg-yellow-500 text-black' : 'bg-green-500 text-white'}`}>
                  {level.toUpperCase()} {summary ? `• ${summary}` : ''}
                </div>
              ) : null;
            })()
          )}
          
        </div>
      </CardContent>
      <CardFooter className="flex justify-between p-4">
        <div>
          <div className="text-sm text-muted-foreground">{camera.location}</div>
        </div>
        <Link href={`/cameras/${camera.id}`}>
          <motion.div
            whileHover={{ x: 3 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button variant="ghost" size="sm">
              View Details
            </Button>
          </motion.div>
        </Link>
      </CardFooter>
    </Card>
    </motion.div>
  );
}