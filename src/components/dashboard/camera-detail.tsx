"use client";

import { useState, useRef, useEffect } from "react";
import type { SupabaseClient } from '@supabase/supabase-js';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PlayCircle, PauseCircle, Volume2, VolumeX, Maximize, MessageSquare, Copy } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { getRecordings, saveRecording } from '@/lib/recordings';
import { addTimelineEvent, getTimeline, type TimelineEvent } from '@/lib/timeline';
import { acquireStream, getExistingStream, releaseStream } from '@/lib/localStream';
import { useVideoAnalyzer, type Detection } from '@/lib/useVideoAnalyzer';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { SignalingServer } from '@/lib/webrtc/signaling-server';
import { PeerConnection } from '@/lib/webrtc/peer-connection';
import type { SignalingMessage } from '@/lib/webrtc/types';
import { updateCamera } from '@/lib/storage';

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
  // When this camera represents an external device, token stores the device's signaling id
  token?: string;
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
  // Reconnect link + QR (public base preferred when available)
  const [lanBaseUrl, setLanBaseUrl] = useState<string | null>(null);
  const [publicBaseReachable, setPublicBaseReachable] = useState<boolean | null>(null);
  const [reconnectUrl, setReconnectUrl] = useState<string | null>(null);
  // Fallback: show a tap overlay only if autoplay fails after robust retries
  const [needsUserGesture, setNeedsUserGesture] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { start: analyzerStart, stop: analyzerStop, detections, lastAnalysis, lastResult, loadingModels } = useVideoAnalyzer({ enabled: true, fps: 1 });
  const [viewerState, setViewerState] = useState<'idle'|'connecting'|'connected'|'error'>('idle');
  const signalingRef = useRef<SignalingServer | null>(null);
  const pcRef = useRef<PeerConnection | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const componentActiveRef = useRef(true);
  const streamerTargetRef = useRef<string | null>(camera.token ?? null);
  const viewerIdRef = useRef<string | null>(null);
  // Prevent parallel connection attempts
  const connectingRef = useRef<boolean>(false);

  useEffect(() => {
    componentActiveRef.current = true;
    return () => {
      componentActiveRef.current = false;
    };
  }, []);

  useEffect(() => {
    streamerTargetRef.current = camera.token ?? null;
  }, [camera.token]);

  type StreamerInfo = { streamId: string; hasStream: boolean };

  const resolveStreamerTarget = async (ss: SignalingServer): Promise<StreamerInfo | null> => {
    const initialTarget = streamerTargetRef.current ?? camera.token ?? camera.id ?? null;
    if (!initialTarget) {
      console.warn('No streamer identifier available for camera', camera.id);
      return null;
    }

    return await new Promise<StreamerInfo | null>((resolve) => {
      let settled = false;
      let resendIntervalId: ReturnType<typeof setInterval> | undefined;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      let lastKnownStreamId: string | null = streamerTargetRef.current ?? camera.token ?? null;
      let lastHasStream = false;

      const cleanup = () => {
        if (resendIntervalId) {
          clearInterval(resendIntervalId);
          resendIntervalId = undefined;
        }
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }
      };

      const resolveOnce = (value: StreamerInfo | null) => {
        if (settled) return;
        settled = true;
        cleanup();
        ss.offMessage(handler);
        resolve(value);
      };

      const handler = (msg: SignalingMessage) => {
        if (msg.type === 'streamer-info' && isRecord(msg.data) && 'streamId' in msg.data) {
          const payload = msg.data as Record<string, unknown>;
          const streamId = String(payload.streamId);
          const hasStream = Boolean(payload.hasStream);
          streamerTargetRef.current = streamId;
          lastKnownStreamId = streamId;
          lastHasStream = hasStream;
          if (streamId !== camera.token) {
            try {
              updateCamera(camera.id, { token: streamId });
            } catch (err) {
              console.warn('Failed to persist updated streamer token', err);
            }
          }
          if (hasStream) {
            resolveOnce({ streamId, hasStream: true });
          }
        }
      };

      ss.onMessage(handler);

      const sendRequest = () => {
        const targetId = streamerTargetRef.current ?? lastKnownStreamId ?? initialTarget;
        if (!targetId) {
          return;
        }

        ss.sendMessage(targetId, 'streamer-info-request', {
          viewerId: ss.getUserId(),
          cameraId: camera.id,
        }).catch((err: unknown) => {
          console.error('Failed to request streamer info:', toError(err));
        });
      };

      sendRequest();
      resendIntervalId = setInterval(sendRequest, 2000);
      timeoutId = setTimeout(() => {
        const fallbackId = streamerTargetRef.current ?? lastKnownStreamId ?? initialTarget;
        if (fallbackId) {
          resolveOnce({ streamId: fallbackId, hasStream: lastHasStream });
        } else {
          resolveOnce(null);
        }
      }, 10000);
    });
  };

  const waitForStreamerReady = async (ss: SignalingServer): Promise<string | null> => {
    let attempt = 0;
    while (componentActiveRef.current) {
      const info = await resolveStreamerTarget(ss);
      if (!componentActiveRef.current) {
        return null;
      }

      if (!info) {
        return null;
      }

      const { streamId, hasStream } = info;
      streamerTargetRef.current = streamId;

      if (hasStream) {
        return streamId;
      }

      if (attempt === 0) {
        console.log('Streamer responded but is not streaming yet; waiting for broadcast to start...');
      }
      attempt += 1;

      // Wait briefly before requesting status again
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    return null;
  };

  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);

  const toError = (error: unknown): Error => (error instanceof Error ? error : new Error(String(error)));
  const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
  
  const connectToRemoteCamera = async (retry = false) => {
    if (camera.isLocal || !camera.token) {
      console.log('Cannot connect: camera is local or has no token');
      return;
    }

    if (!isSupabaseConfigured) {
      console.warn('Supabase is not configured; remote viewing is unavailable');
      setViewerState('error');
      return;
    }

    if (!componentActiveRef.current) {
      return;
    }

    if (retry) {
      reconnectAttemptsRef.current += 1;
    } else {
      reconnectAttemptsRef.current = 0;
    }

    // Guard against parallel connection attempts
    if (connectingRef.current && !retry) {
      console.log('⏳ Connection already in progress, skipping duplicate attempt');
      return;
    }
    connectingRef.current = true;

    // Tear down any existing connection before creating a new one
    if (pcRef.current) {
      try { pcRef.current.close(); } catch (e) { console.error('Error closing previous peer connection', e); }
      pcRef.current = null;
    }
    if (signalingRef.current) {
      try { signalingRef.current.disconnect(); } catch (e) { console.error('Error disconnecting previous signaling session', e); }
      signalingRef.current = null;
    }

    setViewerState('connecting');

  try {
      // Use consistent viewerId to maintain connection with streamer - persist across sessions
      if (!viewerIdRef.current) {
        // Try to get existing viewer ID from localStorage first
        const storedViewerId = localStorage.getItem(`camio-viewer-${camera.id}`);
        if (storedViewerId) {
          viewerIdRef.current = storedViewerId;
          console.log('🆔 Retrieved stored viewer ID:', viewerIdRef.current);
        } else {
          // Generate new viewer ID and store it
          viewerIdRef.current = `viewer-${Math.random().toString(36).substring(2, 10)}`;
          localStorage.setItem(`camio-viewer-${camera.id}`, viewerIdRef.current);
          console.log('🆔 Generated new viewer ID:', viewerIdRef.current);
        }
      }
      console.log('🆔 Using viewer ID:', viewerIdRef.current);
      // Join the same stream-specific channel as the streamer
      const streamChannel = streamerTargetRef.current ?? camera.token ?? camera.id;
      const ss = new SignalingServer(
        supabase as SupabaseClient,
        viewerIdRef.current,
        `stream:${streamChannel}`
      );
      await ss.connect();
      if (!componentActiveRef.current) {
        ss.disconnect();
        return;
      }
      signalingRef.current = ss;

      const resolvedStreamId = await waitForStreamerReady(ss);
      if (!componentActiveRef.current) {
        ss.disconnect();
        return;
      }

      if (!resolvedStreamId) {
        console.warn('Unable to determine streamer target for camera', camera.id);
        setViewerState('error');
        ss.disconnect();
        return;
      }

      const peer = new PeerConnection(ss, undefined, {
        onConnectionStateChange: (state) => {
          if (state === 'connected') {
            setViewerState('connected');
            reconnectAttemptsRef.current = 0;
          }
          if (state === 'disconnected' || state === 'failed' || state === 'closed') {
            setViewerState('error');
            if (reconnectAttemptsRef.current < 5 && camera.status === 'online') {
              setTimeout(() => {
                if (componentActiveRef.current) {
                  connectToRemoteCamera(true);
                }
              }, 2000);
            }
          }
        },
        onError: (error) => {
          console.error('Viewer peer error:', error);
          setViewerState('error');
          if (reconnectAttemptsRef.current < 5 && camera.status === 'online') {
            setTimeout(() => {
              if (componentActiveRef.current) {
                connectToRemoteCamera(true);
              }
            }, 2000);
          }
        },
        onRemoteStream: async (remoteStream) => {
          const v = videoRef.current;
          if (!v) return;
          // Avoid thrashing srcObject/play if the same stream arrives again (e.g., separate audio/video tracks)
          if (v.srcObject !== remoteStream) {
            v.srcObject = remoteStream;
          }
          // Ensure autoplay-friendly flags are set as properties
          v.muted = true;
          v.playsInline = true as any;
          // Clear any previous listener and set a new one to hide overlay when playing
          const onPlayingHideOverlay = () => setNeedsUserGesture(false);
          v.removeEventListener?.('playing', onPlayingHideOverlay as any);
          v.addEventListener('playing', onPlayingHideOverlay as any, { once: true } as any);

          // Wait for the element to have enough metadata to play
          const waitForReady = async () => {
            if (v.readyState >= 2) return; // HAVE_CURRENT_DATA
            await new Promise<void>((resolve) => {
              let settled = false;
              const on = () => { if (settled) return; settled = true; v.removeEventListener('loadedmetadata', on); v.removeEventListener('canplay', on); resolve(); };
              v.addEventListener('loadedmetadata', on, { once: true } as any);
              v.addEventListener('canplay', on, { once: true } as any);
              // Fallback timeout
              setTimeout(() => { if (!settled) { settled = true; v.removeEventListener('loadedmetadata', on); v.removeEventListener('canplay', on); resolve(); } }, 400);
            });
          };

          // Defer to next frame, then wait for readiness
          await new Promise<void>((r) => requestAnimationFrame(() => r()));
          await waitForReady();

          // Retry play a few times to overcome transient AbortError; wait until we get 'playing'
          const ensurePlaying = async () => {
            for (let i = 0; i < 4; i++) {
              try {
                // eslint-disable-next-line no-await-in-loop
                await v.play();
                if (!v.paused) return;
              } catch (e) {
                // ignore and retry
              }
              // eslint-disable-next-line no-await-in-loop
              await new Promise((res) => setTimeout(res, 200));
            }
          };
          const played = new Promise<void>((resolve) => {
            const onPlaying = () => { v.removeEventListener('playing', onPlaying); resolve(); };
            v.addEventListener('playing', onPlaying, { once: true } as any);
          });
          await Promise.race([ensurePlaying(), played]);

          // If still paused, surface a small tap-to-start overlay
          if (v.paused) {
            setNeedsUserGesture(true);
          }

          setViewerState('connected');
          reconnectAttemptsRef.current = 0;
          if (canvasRef.current) {
            // Start analyzer after playback is confirmed
            analyzerStart(v, canvasRef.current);
          }
        },
        onStreamEnded: (reason) => {
          console.log('Remote stream ended:', reason);
          setViewerState('idle');
          analyzerStop();
          if (camera.status === 'online') {
            setTimeout(() => {
              if (componentActiveRef.current) {
                connectToRemoteCamera(true);
              }
            }, 2000);
          }
        }
      });

      pcRef.current = peer;

      try {
        await peer.initializeAsViewer(resolvedStreamId);
      } catch (connectionError) {
        console.error('Failed to initialize viewer peer connection:', connectionError);
        setViewerState('error');
        if (reconnectAttemptsRef.current < 5 && camera.status === 'online') {
          setTimeout(() => {
            if (componentActiveRef.current) {
              connectToRemoteCamera(true);
            }
          }, 2000);
        }
      }
    } catch (error) {
      console.error('❌ FAILED to connect:', error);
      setViewerState('error');
      if (reconnectAttemptsRef.current < 5 && camera.status === 'online') {
        setTimeout(() => {
          if (componentActiveRef.current) {
            connectToRemoteCamera(true);
          }
        }, 2000);
      }
    } finally {
      connectingRef.current = false;
    }
  };

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

  // Resolve LAN base URL once
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/base-url');
        if (res.ok) {
          const data = await res.json();
          setLanBaseUrl(data.baseUrl || null);
        }
      } catch (e) {
        setLanBaseUrl(null);
      }
    })();
  }, []);

  // Probe public base URL (e.g., ngrok) if configured
  useEffect(() => {
    const publicBase = (typeof window !== 'undefined' && (window as any).__NEXT_PUBLIC_BASE_URL)
      || (typeof process !== 'undefined' && (process as any).env && (process as any).env.NEXT_PUBLIC_BASE_URL)
      || null;
    if (!publicBase) {
      setPublicBaseReachable(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await fetch(publicBase, { method: 'GET', mode: 'no-cors' as RequestMode });
        if (!cancelled) setPublicBaseReachable(true);
      } catch {
        if (!cancelled) setPublicBaseReachable(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Build reconnect URL (external cameras only)
  useEffect(() => {
    if (camera.isLocal) { setReconnectUrl(null); return; }
    const token = camera.token;
    if (!token || !camera.name) { setReconnectUrl(null); return; }

    const publicBase = (typeof window !== 'undefined' && (window as any).__NEXT_PUBLIC_BASE_URL)
      || (typeof process !== 'undefined' && (process as any).env && (process as any).env.NEXT_PUBLIC_BASE_URL)
      || null;

    let base: string;
    if (publicBase && publicBaseReachable === true) {
      base = publicBase;
    } else if (lanBaseUrl) {
      base = lanBaseUrl;
    } else if (typeof window !== 'undefined') {
      base = `${window.location.protocol}//${window.location.host}`;
    } else {
      base = '';
    }

    if (base) {
      const params = new URLSearchParams();
      params.set('external', 'true');
      params.set('token', token);
      params.set('camera', camera.name);
      params.set('autostart', 'true');
      setReconnectUrl(`${base}/stream?${params.toString()}`);
    } else {
      setReconnectUrl(null);
    }
  }, [camera.isLocal, camera.token, camera.name, lanBaseUrl, publicBaseReachable]);

  // Attach shared live stream for local cameras so both card and portal can see realtime feed
  useEffect(() => {
    let attached = false;
    let localStream: MediaStream | undefined;
    const abortRef = { cancelled: false };

    const attach = async () => {
      if (camera.isLocal && camera.isRecording && videoRef.current) {
        try {
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
      } else if (!camera.isLocal && camera.status === 'online' && camera.token) {
        await connectToRemoteCamera();
      }
    };

    attach();

    return () => {
      abortRef.cancelled = true;
      if (attached && camera.isLocal) {
        try {
          releaseStream(camera.id);
        } catch (e) {
          // ignore
        }
      }
      if (videoRef.current) {
        try { (videoRef.current as HTMLVideoElement).srcObject = null; } catch (e) {}
      }
      if (pcRef.current && signalingRef.current) {
        const remoteId = pcRef.current.getRemoteUserId();
        if (remoteId) {
          void signalingRef.current.sendMessage(remoteId, 'disconnect', {});
        }
      }
      if (pcRef.current) {
        try { pcRef.current.close(); } catch (e) { /* ignore */ }
        pcRef.current = null;
      }
      if (signalingRef.current) {
        try { signalingRef.current.disconnect(); } catch (e) { /* ignore */ }
        signalingRef.current = null;
      }
      setViewerState('idle');
      analyzerStop();
    };
  }, [camera.id, camera.isLocal, camera.isRecording]);

  // start/stop analyzer when appropriate
  useEffect(() => {
    const v = videoRef.current;
    const c = canvasRef.current;
    const shouldAnalyzeLocal = camera.isLocal && camera.isRecording;
    if (v && c && shouldAnalyzeLocal) {
      analyzerStart(v, c);
    } else if (!shouldAnalyzeLocal) {
      // For remote streams, analyzerStart is triggered when onRemoteStream fires
      analyzerStop();
    }
    return () => analyzerStop();
  }, [videoRef.current, canvasRef.current, camera.isLocal, camera.isRecording]);

  // load timeline for this camera
  useEffect(() => {
    setTimelineEvents(getTimeline(camera.id));
    const onUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ cameraId?: string }>).detail;
      if (!detail || detail.cameraId === camera.id) {
        setTimelineEvents(getTimeline(camera.id));
      }
    };
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
      const dets: Detection[] = detections || [];
      dets.forEach((d) => {
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
              {/* Live/recorded/local/remote video */}
            {((recordingUrl)
              || (camera.streamUrl && camera.status === "online")
              || (camera.isLocal && camera.isRecording)
              || (viewerState === 'connecting' || viewerState === 'connected')) ? (
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
                        // For remote WebRTC viewer, srcObject will be set by the connection handler
                        camera.streamUrl ? <source src={camera.streamUrl} type="video/mp4" /> : null
                      )
                    )}
                    Your browser does not support the video tag.
                  </video>
                  {needsUserGesture && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                      <Button
                        variant="outline"
                        className="bg-white/10 text-white border-white/30 hover:bg-white/20"
                        onClick={async () => {
                          const v = videoRef.current;
                          if (!v) return;
                          try {
                            await v.play();
                            setNeedsUserGesture(false);
                          } catch (e) {
                            console.warn('User-gesture play() failed:', e);
                          }
                        }}
                      >
                        Tap to Start Live Video
                      </Button>
                    </div>
                  )}
                  {(!camera.isLocal && camera.status === 'online' && viewerState === 'error') && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white space-y-3">
                      <span className="text-sm">Could not connect to the remote camera.</span>
                      <Button variant="outline" size="sm" onClick={() => connectToRemoteCamera(true)}>
                        Retry Connection
                      </Button>
                    </div>
                  )}
                  {(viewerState === 'connecting') && (
                    <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                      Connecting…
                    </div>
                  )}
                  {(viewerState === 'connected') && (
                    <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                      LIVE (remote)
                    </div>
                  )}
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

              {/* Reconnect area for external devices */}
              {!camera.isLocal && camera.token && (
                <div className="mt-6 border-t pt-4">
                  <h4 className="font-medium mb-2">Reconnect External Device</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    If your device disconnects, open this link or scan the QR on the device to resume streaming.
                  </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                      <div className="flex justify-center sm:justify-start">
                        <div className="p-2 rounded-md">
                          <QRCodeSVG value={reconnectUrl || ''} size={128} />
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <div className="flex flex-col gap-2">
                          <div className="text-xs text-muted-foreground">Pairing</div>
                          <div className="flex items-center gap-3">
                            {reconnectUrl ? (
                              <a
                                href={reconnectUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm underline text-primary"
                              >
                                Pairing link
                              </a>
                            ) : (
                              <span className="text-sm text-muted-foreground">Resolving…</span>
                            )}
                            <Button
                              variant="outline"
                              size="icon"
                              title="Copy link"
                              onClick={async () => {
                                try {
                                  if (reconnectUrl) {
                                    await navigator.clipboard.writeText(reconnectUrl);
                                    alert('Link copied');
                                  }
                                } catch (e) {
                                  console.warn('Copy failed', e);
                                }
                              }}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                          {publicBaseReachable === false && (
                            <div className="text-xs text-yellow-600">
                              Public base URL appears offline. Using local network address instead.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}