"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PlayCircle, PauseCircle, Volume2, VolumeX, Maximize, MessageSquare } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { getRecordings, saveRecording } from '@/lib/recordings';
import { addTimelineEvent, getTimeline } from '@/lib/timeline';
import { Timeline as TimelineComp } from '@/components/dashboard/timeline';
import { acquireStream, getExistingStream, releaseStream } from '@/lib/localStream';
import { useVideoAnalyzer } from '@/lib/useVideoAnalyzer';

interface Camera {
  id: string;
  name: string;
  location: string;
  status: string;
  resolution?: string;
  frameRate?: string;
  lastActivity: string;
  streamUrl?: string;
  model?: string;
  connected?: string;
  isRecording?: boolean;
  isLocal?: boolean;
}

interface CameraDetailProps {
  camera: Camera;
}

export function CameraDetail({ camera }: CameraDetailProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { start: analyzerStart, stop: analyzerStop, detections, lastAnalysis, lastResult, loadingModels } = useVideoAnalyzer({ enabled: true, fps: 1 });

  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  
  // Toggle play/pause
  const togglePlayback = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };
  
  // Toggle mute
  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  // Load latest recording from localStorage if present
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const blobs = await getRecordings(camera.id);
        if (!mounted) return;
        if (Array.isArray(blobs) && blobs.length > 0) {
          const url = URL.createObjectURL(blobs[0]);
          setRecordingUrl(url);
          return;
        }
      } catch (e) {
        // ignore and fallback
      }

      try {
        const key = `camio:recordings:${camera.id}`;
        const raw = localStorage.getItem(key);
        const arr = raw ? JSON.parse(raw) as string[] : [];
        if (arr && arr.length) {
          setRecordingUrl(arr[0]);
        }
      } catch (e) {
        console.error('Failed to load recordings for detail view', e);
      }
    })();
    return () => { mounted = false; if (recordingUrl && recordingUrl.startsWith('blob:')) URL.revokeObjectURL(recordingUrl); };
  }, [camera.id]);

  // Attach shared live stream for local cameras so both card and portal can see realtime feed
  useEffect(() => {
    let attached = false;
    let localStream: MediaStream | undefined;
    const attach = async () => {
      if (camera.isLocal && camera.isRecording && videoRef.current) {
        try {
          // Try to reuse existing stream first
          const existing = getExistingStream(camera.id);
          if (existing) {
            localStream = existing;
          } else {
            localStream = await acquireStream(camera.id, { video: true, audio: false });
          }
          if (!videoRef.current) return;
          videoRef.current.srcObject = localStream as MediaStream;
          try { await videoRef.current.play(); } catch (e) { /* ignore */ }
          attached = true;
        } catch (e) {
          console.warn('Failed to attach shared live stream', e);
        }
      }
    };
    attach();
    return () => {
      if (attached && camera.isLocal) {
        try {
          releaseStream(camera.id);
        } catch (e) {
          // ignore
        }
      }
      if (videoRef.current) {
        // detach object
        try { (videoRef.current as HTMLVideoElement).srcObject = null; } catch (e) {}
      }
    };
  }, [camera.id, camera.isLocal, camera.isRecording]);

  // start/stop analyzer when appropriate
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

  // load timeline for this camera
  useEffect(() => {
    setTimelineEvents(getTimeline(camera.id));
    const onUpdate = (e: any) => { if (!e?.detail || e.detail.cameraId === camera.id) setTimelineEvents(getTimeline(camera.id)); };
    window.addEventListener('camio:timeline:updated', onUpdate as EventListener);
    return () => window.removeEventListener('camio:timeline:updated', onUpdate as EventListener);
  }, [camera.id]);

  // When analyzer yields a medium/high alert, add timeline event once
  const lastAlertRef = useRef<string | null>(null);
  useEffect(() => {
    if (!lastResult) return;
    const level = lastResult.alertLevel;
    // guard: only create an entry when level is medium or high
    if (level === 'medium' || level === 'high') {
      // avoid repeats in a short window
      const key = `${level}:${lastResult.summary}`;
      if (lastAlertRef.current === key) return;
      lastAlertRef.current = key;
      // create event
      const severity = level === 'high' ? 'high' : 'medium';
      const desc = level === 'high' ? 'Potential high severity incident detected' : 'Suspicious activity detected';
      addTimelineEvent(camera.id, {
        type: level === 'high' ? 'alert' : 'suspicious',
        description: desc,
        aiAnalysis: lastResult.summary,
        severity,
      });
      // refresh local timeline state
      setTimelineEvents(getTimeline(camera.id));
    }
  }, [lastResult, camera.id]);

  // render detection boxes
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = video.videoWidth || canvas.width;
    canvas.height = video.videoHeight || canvas.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    try {
  const dets = detections || [];
      dets.forEach((d: any) => {
        const { bbox, label } = d;
        const x = Math.max(0, Math.floor(bbox.x * canvas.width));
        const y = Math.max(0, Math.floor(bbox.y * canvas.height));
        const w = Math.max(0, Math.floor(bbox.width * canvas.width));
        const h = Math.max(0, Math.floor(bbox.height * canvas.height));
        ctx.strokeStyle = 'rgba(16,185,129,0.9)';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = 'rgba(16,185,129,0.9)';
        ctx.font = '14px sans-serif';
        ctx.fillText(label, x + 4, y + 16);
      });
    } catch (e) {
      // ignore
    }
  }, [detections, canvasRef.current, videoRef.current]);
  
  // We no longer show a manual AI analysis box; analysis runs automatically.
  // The analyzer writes timestamped events to the timeline when it detects medium/high alerts.

  const saveSuspectClip = async (seconds = 6) => {
    const stream = getExistingStream(camera.id);
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
        alert('Suspect clip saved locally');
      } catch (e) {
        console.error(e);
        alert('Failed to save suspect clip');
      }
    } catch (e) {
      console.error('Failed to record suspect clip', e);
      alert('Failed to record suspect clip');
    }
  };
  
  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        when: "beforeChildren" as const,
        staggerChildren: 0.1
      }
    }
  };
  
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0
    }
  };
  
  const itemTransition = {
    type: "spring" as const,
    stiffness: 100,
    damping: 15
  };
  
  const buttonVariants = {
    hover: {
      scale: 1.05
    },
    tap: { scale: 0.95 }
  };
  
  const buttonTransition = {
    type: "spring" as const,
    stiffness: 400,
    damping: 10
  };

  return (
    <motion.div 
      className="space-y-4"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <motion.div 
        variants={itemVariants}
        transition={itemTransition}
      >
        <Card>
          <CardContent className="p-0">
            <div className="relative aspect-video bg-black">
              {/* In a real app, this would be a real video stream */}
            {((recordingUrl) || (camera.streamUrl && camera.status === "online") || (camera.isLocal && camera.isRecording)) ? (
                <>
                  <video 
                    ref={videoRef}
                    className="w-full h-full object-contain"
                    autoPlay
                    playsInline
                    muted={isMuted}
                    loop
                  >
                    {recordingUrl ? (
                      <source src={recordingUrl} />
                    ) : (
                      // If this is a local camera and we are recording, attach the shared live stream
                      camera.isLocal && camera.isRecording ? (
                        // If an existing shared stream is present, attach its object URL via srcObject later
                        // We leave the <video> without <source> so we can set srcObject in effect
                        null
                      ) : (
                        <source src={camera.streamUrl} type="video/mp4" />
                      )
                    )}
                    Your browser does not support the video tag.
                  </video>
                  <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full bg-black text-white">
                  <span className="text-lg mb-2">
                    {camera.status === "online" 
                      ? "Camera feed not available" 
                      : "Camera is offline"}
                  </span>
                  <span className="text-sm text-gray-400">
                    {camera.status === "online"
                      ? "Please check camera settings" 
                      : "Please check camera connection"}
                  </span>
                </div>
              )}              {/* Video controls overlay */}
              <motion.div 
                className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className="flex items-center justify-center text-white">
                  <div className="flex items-center gap-2">
                        {/* show model loading or analysis alert */}
                        {loadingModels && (
                          <div className="text-xs bg-yellow-500 text-black px-2 py-1 rounded-md mr-2">Models loading…</div>
                        )}
                        {lastAnalysis && !loadingModels && (
                          (() => {
                            const parts = String(lastAnalysis).split(':');
                            const level = parts[0];
                            const summary = parts.slice(1).join(':');
                            if (!level || level === 'none') return null;
                            return (
                              <div className={`text-xs px-2 py-1 rounded-md ${level === 'high' ? 'bg-red-600 text-white' : level === 'medium' ? 'bg-yellow-500 text-black' : 'bg-green-500 text-white'}`}>
                                {level.toUpperCase()} {summary ? `• ${summary}` : ''}
                              </div>
                            );
                          })()
                        )}
                    <motion.div
                      whileHover="hover"
                      whileTap="tap"
                      variants={buttonVariants}
                      transition={buttonTransition}
                    >
                      <Button 
                        onClick={togglePlayback} 
                        variant="ghost" 
                        size="icon"
                        className="text-white hover:bg-white/20"
                      >
                        {isPlaying ? <PauseCircle className="h-6 w-6" /> : <PlayCircle className="h-6 w-6" />}
                      </Button>
                    </motion.div>
                    <motion.div
                      whileHover="hover"
                      whileTap="tap"
                      variants={buttonVariants}
                      transition={buttonTransition}
                    >
                      <Button 
                        onClick={toggleMute} 
                        variant="ghost" 
                        size="icon"
                        className="text-white hover:bg-white/20"
                      >
                        {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                      </Button>
                    </motion.div>
                    <span className="text-sm font-medium">{camera.name} - Live</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <motion.div
                          whileHover="hover"
                          whileTap="tap"
                          variants={buttonVariants}
                          transition={buttonTransition}
                        >
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="text-white hover:bg-white/20"
                          >
                            <MessageSquare className="h-5 w-5" />
                          </Button>
                        </motion.div>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Ask AI Assistant</DialogTitle>
                          <DialogDescription>
                            Get contextual advice based on the current situation.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="max-h-[300px] overflow-y-auto p-4 bg-muted rounded-md">
                            <p className="text-sm">
                              Ask questions like "What should I do if I see someone suspicious?" or
                              "What's happening in this camera view?"
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input placeholder="Type your question..." />
                            <Button>Send</Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                    
                    <motion.div
                      whileHover="hover"
                      whileTap="tap"
                      variants={buttonVariants}
                      transition={buttonTransition}
                    >
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="text-white hover:bg-white/20"
                      >
                        <Maximize className="h-5 w-5" />
                      </Button>
                    </motion.div>
                    
                    {/* Remove camera button (danger) */}
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={async () => {
                          if (!confirm('Remove this camera? This cannot be undone.')) return;
                          try {
                            const { loadCameras, saveCameras } = await import('@/lib/storage');
                            const list = loadCameras();
                            const filtered = list.filter((c) => c.id !== camera.id);
                            saveCameras(filtered);
                            window.location.href = '/dashboard';
                          } catch (e) {
                            console.error('Failed to remove camera', e);
                            alert('Failed to remove camera');
                          }
                        }}
                      >
                        Remove Camera
                      </Button>
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
      
      <div className="flex flex-col sm:flex-row gap-4">
        <motion.div 
          className="flex-1"
          variants={itemVariants}
          transition={itemTransition}
        >
          <Card>
            <CardContent className="p-4">
              <h3 className="font-medium mb-4">Recording Controls</h3>
              <p className="text-sm text-muted-foreground mb-3">The camera is {camera.status === 'online' ? 'online' : 'offline'} and {camera.isRecording ? 'recording' : 'not recording'}.</p>
              <div className="flex justify-center gap-2">{/* centered controls */}
                <Button onClick={async () => {
                  // toggle recording state in localStorage
                  try {
                    const { loadCameras, saveCameras } = await import('@/lib/storage');
                    const list = loadCameras();
                    const idx = list.findIndex((c) => c.id === camera.id);
                    if (idx !== -1) {
                      list[idx].isRecording = !list[idx].isRecording;
                      saveCameras(list);
                      window.location.reload();
                    }
                  } catch (e) {
                    console.error('Failed to toggle recording', e);
                  }
                }}>
                  {camera.isRecording ? 'Stop Recording' : 'Start Recording'}
                </Button>
                <Button variant="outline" onClick={() => {
                  // quick download placeholder: capture current frame if available
                  alert('Download functionality not implemented yet');
                }}>Download</Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}