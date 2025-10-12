"use client";

import { useRef, useState, useEffect } from "react";
import type { SupabaseClient } from '@supabase/supabase-js';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Camera, 
  RotateCcw, 
  Settings, 
  Share2,
  Video, 
  VideoOff,
  Pause,
  Play
} from "lucide-react";
import { toast } from "sonner";
import { saveRecording } from '@/lib/recordings';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { SignalingServer } from '@/lib/webrtc/signaling-server';
import { PeerConnection } from '@/lib/webrtc/peer-connection';
import type {
  SignalingMessage,
  StreamerInfoRequestPayload,
} from '@/lib/webrtc/types';

const toError = (error: unknown): Error => (error instanceof Error ? error : new Error(String(error)));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isStreamerInfoRequestMessage = (
  message: SignalingMessage
): message is SignalingMessage<StreamerInfoRequestPayload> => {
  if (message.type !== 'streamer-info-request' || !isRecord(message.data)) {
    return false;
  }
  const candidate = message.data as Record<string, unknown>;
  return typeof candidate.viewerId === 'string';
};

const isRegisterAckMessage = (message: SignalingMessage): boolean =>
  message.type === 'register-ack';

export function CameraStream() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isStreamingRef = useRef<boolean>(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [deviceId, setDeviceId] = useState<string>("");
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [streamId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const pairingToken = params.get('token')?.trim();
      if (pairingToken) {
        return pairingToken;
      }

      try {
        const persisted = window.localStorage.getItem('camio:last-stream-id');
        if (persisted) {
          return persisted;
        }
      } catch (err) {
        console.warn('Failed to read persisted stream id:', err);
      }
    }

    return `camio-${Math.random().toString(36).substring(2, 15)}`;
  });
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [isSecure, setIsSecure] = useState<boolean>(true);
  const [permissionHint, setPermissionHint] = useState<string>("");
  const signalingRef = useRef<SignalingServer | null>(null);
  const peerConnectionRef = useRef<PeerConnection | null>(null);
  const infoResponderAttachedRef = useRef(false);
  const activeViewerRef = useRef<string | null>(null);
  const offerInFlightViewerRef = useRef<string | null>(null);
  const lastOfferTimestampRef = useRef<number>(0);
  
  // External device parameters
  const tokenParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('token') : null;
  const isExternal = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('external') === 'true' : false;
  const cameraName = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('camera') || 'External Camera' : 'External Camera';
  const autoStart = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('autostart') === 'true' : false;
  const [registered, setRegistered] = useState<boolean>(false);
  const registrationListenerAttachedRef = useRef(false);
  const registrationConfirmedRef = useRef(false);
  const signalingErrorShownRef = useRef(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('camio:last-stream-id', streamId);
      } catch (err) {
        console.warn('Failed to persist stream id:', err);
      }
    }
  }, [streamId]);

  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  const maybeOfferViewer = async (viewerId: string | null) => {
    if (!viewerId) {
      console.log('⚠️ maybeOfferViewer called with no viewerId');
      return;
    }

    const peer = peerConnectionRef.current;
    const stream = streamRef.current;

    if (!peer || !stream) {
      console.log('⚠️ Cannot offer - peer:', !!peer, 'stream:', !!stream);
      return;
    }

    const now = Date.now();

    if (offerInFlightViewerRef.current === viewerId) {
      console.log('⏳ Offer already in flight for', viewerId);
      return;
    }

    if (activeViewerRef.current === viewerId && now - lastOfferTimestampRef.current < 3000) {
      console.log('⏱️ Offer sent recently to', viewerId, '- skipping');
      return;
    }

    console.log('🚀 Sending offer to viewer', viewerId);
    offerInFlightViewerRef.current = viewerId;
    lastOfferTimestampRef.current = now;

    try {
      await peer.initializeAsStreamer(stream, viewerId);
      activeViewerRef.current = viewerId;
      console.log('✅ Successfully sent offer to viewer', viewerId);
    } catch (err) {
      console.error('❌ Failed to initialize streamer for viewer', viewerId, err);
    } finally {
      if (offerInFlightViewerRef.current === viewerId) {
        offerInFlightViewerRef.current = null;
      }
    }
  };

  const ensureSignalingConnection = async (): Promise<SignalingServer | null> => {
    if (!isSupabaseConfigured) {
      return null;
    }

    if (signalingRef.current) {
      return signalingRef.current;
    }

    try {
  const ss = new SignalingServer(
    supabase as SupabaseClient,
    streamId,
    `stream:${streamId}`
  );
      await ss.connect();
      if (!infoResponderAttachedRef.current) {
        ss.onMessage(async (msg) => {
          if (!isStreamerInfoRequestMessage(msg)) {
            return;
          }

          console.log('📩 Received streamer-info-request from', msg.sender);

          try {
            const viewerId = msg.data.viewerId || msg.sender;
            
            // Check if we're truly ready: have stream, peer connection, and peer has local stream set
            const peerReady = Boolean(
              peerConnectionRef.current && 
              streamRef.current &&
              isStreamingRef.current
            );
            
            const payload: Record<string, unknown> = {
              streamId,
              isStreaming: peerReady,
              hasStream: peerReady,
            };
            await ss.sendMessage(msg.sender, 'streamer-info', payload);
            console.log('📤 Sent streamer-info response:', payload);
            
            // Proactively send offer if we're ready
            if (peerReady) {
              console.log('🎬 Attempting to send proactive offer to viewer', viewerId);
              void maybeOfferViewer(viewerId ?? msg.sender);
            } else {
              console.log('⏸️ Not ready to send offer - streaming:', isStreamingRef.current, 'stream:', !!streamRef.current, 'peer:', !!peerConnectionRef.current);
            }
          } catch (err) {
            console.warn('Failed to respond to streamer-info-request:', toError(err));
          }
        });
        infoResponderAttachedRef.current = true;
      }
      signalingRef.current = ss;
      return ss;
    } catch (error) {
      console.error('❌ Failed to connect to signaling server:', error);
      if (!signalingErrorShownRef.current) {
        toast.error('Remote viewing unavailable: signaling server connection failed.');
        signalingErrorShownRef.current = true;
      }
      return null;
    }
  };

  const teardownRemoteStreaming = async (reason: string) => {
    const peer = peerConnectionRef.current;
    const ss = signalingRef.current;

    if (peer && ss) {
      const remoteId = peer.getRemoteUserId();
      if (remoteId) {
        try {
          await ss.sendMessage(remoteId, 'stream-ended', { reason });
        } catch (err) {
          console.warn('Failed to notify viewer about stream end:', err);
        }
      }
    }

    if (peer) {
      try {
        peer.close();
      } catch (err) {
        console.error('Error closing peer connection:', err);
      }
      peerConnectionRef.current = null;
    }

    if (ss) {
      try {
        ss.disconnect();
      } catch (err) {
        console.error('Error disconnecting signaling server:', err);
      }
      signalingRef.current = null;
      registrationListenerAttachedRef.current = false;
      signalingErrorShownRef.current = false;
      infoResponderAttachedRef.current = false;
    }

    activeViewerRef.current = null;
    offerInFlightViewerRef.current = null;
    lastOfferTimestampRef.current = 0;
  };

  const setupRemoteStreaming = async (mediaStream: MediaStream) => {
    if (!isSupabaseConfigured) {
      console.warn('Supabase not configured; remote viewing disabled');
      return;
    }

    const ss = await ensureSignalingConnection();
    if (!ss) return;

    // Close any existing peer connection before creating a new one
    if (peerConnectionRef.current) {
      const existingViewer = peerConnectionRef.current.getRemoteUserId();
      if (existingViewer) {
        try {
          await ss.sendMessage(existingViewer, 'stream-ended', { reason: 'Streamer restarted broadcast' });
        } catch (err) {
          console.warn('Failed to notify previous viewer about restart:', err);
        }
      }
      try {
        peerConnectionRef.current.close();
      } catch (err) {
        console.error('Error closing previous peer connection:', err);
      }
      peerConnectionRef.current = null;
      activeViewerRef.current = null;
    }

    // Create peer connection that will handle both info requests and viewer-connect messages
    const peer = new PeerConnection(ss, undefined, {
      onConnectionStateChange: (state) => {
        if (state === 'connected') {
          console.log('✅ Viewer connected to stream');
          activeViewerRef.current = peerConnectionRef.current?.getRemoteUserId() ?? activeViewerRef.current;
        }
        if (state === 'disconnected' || state === 'failed' || state === 'closed') {
          console.log('❌ Viewer disconnected from stream');
          activeViewerRef.current = null;
        }
      },
      onError: (error) => {
        console.error('Streamer peer error:', error);
        toast.error('Remote streaming encountered an error.');
      }
    });

    peer.setLocalStream(mediaStream);
    peerConnectionRef.current = peer;
    console.log('🎥 Streamer peer connection ready with local stream');
  };

  // Function to get available cameras
  useEffect(() => {
    // Detect secure context; getUserMedia requires HTTPS or localhost
    setIsSecure(typeof window !== 'undefined' ? window.isSecureContext : true);

    async function getAvailableCameras() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setAvailableCameras(videoDevices);
        
        if (videoDevices.length > 0 && !deviceId) {
          setDeviceId(videoDevices[0].deviceId);
        }
      } catch (error) {
        console.error('Error getting available cameras:', error);
        toast.error("Could not access camera devices");
      }
    }
    
    getAvailableCameras();
  }, [deviceId]);

  // External device registration
  const registerWithDashboard = async () => {
    if (!isExternal || !tokenParam || !isSupabaseConfigured || registrationConfirmedRef.current) {
      return;
    }

    try {
      console.log('🔄 Registering external device with dashboard...');
      const ss = await ensureSignalingConnection();
      if (!ss) {
        throw new Error('Signaling server unavailable');
      }

      if (!registrationListenerAttachedRef.current) {
        ss.onMessage((msg) => {
          if (!isRegisterAckMessage(msg) || registrationConfirmedRef.current) {
            return;
          }

          console.log('✅ Registration acknowledged by dashboard');
          registrationConfirmedRef.current = true;
          setRegistered(true);
          toast.success('Registration confirmed!');
        });
        registrationListenerAttachedRef.current = true;
      }

      console.log('📤 Sending register-camera message:', {
        to: tokenParam,
        id: streamId,
        name: cameraName,
        token: streamId,
      });

      await ss.sendMessage(tokenParam, 'register-camera', {
        id: streamId,
        name: cameraName,
        token: streamId,
      });

      console.log('✅ Registration message sent to dashboard');
      toast.info('Registration request sent. Waiting for confirmation...');

    } catch (error) {
      console.error('❌ Failed to register with dashboard:', error);
      toast.error('Failed to register with dashboard');
    }
  };

  // Auto-start for external devices
  useEffect(() => {
    if (isExternal && autoStart && !isStreaming) {
      console.log('🚀 Auto-starting external device...');
      toggleStreaming();
    }
  }, [isExternal, autoStart, isStreaming]);

  // Start/stop streaming
  const toggleStreaming = async () => {
    if (isStreaming && stream) {
      // Stop streaming
      stream.getTracks().forEach(track => track.stop());
  streamRef.current = null;
      setStream(null);
      setIsStreaming(false);
      
      if (isRecording) {
        stopRecording();
      }

      await teardownRemoteStreaming('Streamer stopped broadcasting');
      
      toast.info("Camera streaming stopped");
    } else {
      if (!isSecure) {
        const host = typeof window !== 'undefined' ? window.location.host : '';
        const proto = typeof window !== 'undefined' ? window.location.protocol : '';
        setPermissionHint(
          `Camera access is blocked because this page is not secure (${proto}//${host}). Use HTTPS or localhost to enable the camera.`
        );
        toast.error("Camera requires a secure (HTTPS) connection or localhost");
        return;
      }
      // Start streaming
      try {
        const constraints = {
          audio: true,
          video: {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        };
        
    const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    streamRef.current = mediaStream;
    setStream(mediaStream);
        
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        
        console.log('📹 Local stream acquired, setting up remote streaming...');
        console.log('State before setup - stream:', !!streamRef.current, 'peer:', !!peerConnectionRef.current, 'isStreaming:', isStreamingRef.current);
        
        await setupRemoteStreaming(mediaStream);
        
        console.log('State after setup - stream:', !!streamRef.current, 'peer:', !!peerConnectionRef.current, 'isStreaming:', isStreamingRef.current);
        
        // Update ref IMMEDIATELY before state to avoid race condition
        isStreamingRef.current = true;
        setIsStreaming(true);
        toast.success("Camera streaming started");
        console.log('✅ Remote streaming setup complete, now accepting viewers');
        console.log('Final state - stream:', !!streamRef.current, 'peer:', !!peerConnectionRef.current, 'isStreaming:', isStreamingRef.current);

        // For external devices, register with dashboard
        if (isExternal && tokenParam) {
          await registerWithDashboard();
        }
      } catch (error) {
        const err = toError(error);
        console.error('Error accessing media devices:', err);
        let message = "Failed to access camera. Please check permissions.";
        const errorName = (error as { name?: string } | undefined)?.name;
        if (errorName === 'NotAllowedError') {
          message = "Camera permission denied. Allow camera access in your browser settings.";
        } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
          message = "No camera found. Please connect a camera or check system permissions.";
        } else if (errorName === 'SecurityError') {
          message = "Camera blocked on insecure connection. Use HTTPS or localhost.";
        }
        setPermissionHint(message);
        toast.error(message);
        await teardownRemoteStreaming('Failed to access camera');
        streamRef.current = null;
      }
    }
  };
  
  // Toggle recording
  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };
  
  // Start recording
  const startRecording = () => {
    if (!stream) return;
    
    try {
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        setRecordedChunks(chunks);
        
        if (chunks.length > 0) {
          const blob = new Blob(chunks, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          
          // Create download link for the recording
          const a = document.createElement('a');
          document.body.appendChild(a);
          a.style.display = 'none';
          a.href = url;
          a.download = `camio-recording-${new Date().toISOString()}.webm`;
          a.click();
          window.URL.revokeObjectURL(url);
          
          toast.success("Recording saved");
        }
      };
      
      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      toast.info("Recording started");
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error("Failed to start recording");
    }
  };
  
  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      toast.info("Recording stopped");
    }
  };
  
  // Clean up on unmount ONLY
  useEffect(() => {
    return () => {
      const currentStream = streamRef.current;
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
      streamRef.current = null;
      
      if (mediaRecorderRef.current) {
        try {
          mediaRecorderRef.current.stop();
        } catch (e) {
          // Already stopped
        }
      }

      void teardownRemoteStreaming('Device navigated away');
    };
    // Empty deps = only run on mount/unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Switch camera
  const switchCamera = async () => {
    if (!availableCameras.length) return;
    
    const currentIndex = availableCameras.findIndex(device => device.deviceId === deviceId);
    const nextIndex = (currentIndex + 1) % availableCameras.length;
    const nextDeviceId = availableCameras[nextIndex].deviceId;
    
    // Stop current stream
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    streamRef.current = null;
    
    setDeviceId(nextDeviceId);
    
    if (isStreaming) {
      // Restart stream with new device
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: {
            deviceId: { exact: nextDeviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
        
  streamRef.current = mediaStream;
  setStream(mediaStream);
        
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        
        toast.success("Camera switched");
      } catch (error) {
        console.error('Error switching camera:', error);
        toast.error("Failed to switch camera");
        setIsStreaming(false);
      }
    }
  };
  
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0 relative">
        <div className="aspect-video bg-black relative overflow-hidden">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover"
          />
          
          {!isStreaming && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white">
              <Camera className="h-16 w-16 mb-2 opacity-50" />
              <p className="text-lg font-medium mb-4">Camera Preview</p>
              {permissionHint && (
                <div className="mb-4 max-w-md text-center text-sm text-red-300">
                  {permissionHint}
                  {!isSecure && (
                    <div className="mt-2 text-xs text-white/80">
                      Tip: Open this page over HTTPS (for example, via an HTTPS tunnel like ngrok) or run on localhost to grant camera access.
                    </div>
                  )}
                </div>
              )}
              <Button onClick={toggleStreaming} className="bg-primary" disabled={!isSecure} title={!isSecure ? 'Use HTTPS or localhost to enable camera' : undefined}>
                <Video className="mr-2 h-4 w-4" />
                Start Streaming
              </Button>
            </div>
          )}
          
          {isStreaming && (
            <>
              {/* Status indicator at top */}
              <div className="absolute top-4 left-4 right-4 flex flex-col items-start gap-2">
                <div className="flex items-center gap-2 bg-black/70 px-3 py-2 rounded-full">
                  <div className={`w-3 h-3 rounded-full ${peerConnectionRef.current ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
                  <span className="text-white text-sm font-medium">
                    {peerConnectionRef.current ? 'Ready for Viewers' : 'Setting up...'}
                  </span>
                </div>
                {/* Debug info - force re-render every second to show current state */}
                <div className="bg-black/70 px-2 py-1 rounded text-white text-xs font-mono">
                  Stream: {stream ? '✓' : '✗'} | Peer: {peerConnectionRef.current ? '✓' : '✗'} | State: {isStreaming ? 'ON' : 'OFF'}
                </div>
                {isExternal && registered && (
                  <div className="bg-green-500/80 px-3 py-2 rounded-full">
                    <span className="text-white text-xs font-medium">Registered ✓</span>
                  </div>
                )}
              </div>
              
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-center space-x-2">
              <Button 
                variant="outline" 
                size="icon" 
                className="bg-black/50 border-white/20 text-white hover:bg-black/70"
                onClick={toggleStreaming}
              >
                <VideoOff className="h-4 w-4" />
              </Button>
              
              <Button 
                variant="outline" 
                size="icon"
                className="bg-black/50 border-white/20 text-white hover:bg-black/70"
                onClick={toggleRecording}
              >
                {isRecording ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              
              {availableCameras.length > 1 && (
                <Button 
                  variant="outline" 
                  size="icon"
                  className="bg-black/50 border-white/20 text-white hover:bg-black/70"
                  onClick={switchCamera}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
              
              <div className="flex-1" />
              <Button
                variant="outline"
                size="icon"
                className="bg-black/50 border-white/20 text-white hover:bg-black/70"
                onClick={async () => {
                  if (!stream) { toast.error('No live stream'); return; }
                  try {
                    const recorder = new MediaRecorder(stream);
                    const chunks: Blob[] = [];
                    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
                    const p = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });
                    recorder.start();
                    // record short suspect clip
                    await new Promise(r => setTimeout(r, 6000));
                    if (recorder.state !== 'inactive') recorder.stop();
                    await p;
                    const blob = new Blob(chunks, { type: 'video/webm' });
                    try {
                      await saveRecording(streamId, blob);
                      toast.success('Saved suspect clip');
                    } catch (e) {
                      toast.error('Failed to save clip');
                    }
                  } catch (e) {
                    console.error(e);
                    toast.error('Failed to record');
                  }
                }}
              >
                <Share2 className="h-4 w-4" />
              </Button>

              <div className="flex items-center gap-2">
                <span className="text-xs text-white bg-black/60 px-2 py-1 rounded-full flex items-center">
                  Stream ID: {streamId}
                </span>
                
                {isRecording && (
                  <span className="flex items-center text-xs bg-red-500/80 px-2 py-1 rounded-full">
                    <span className="h-2 w-2 rounded-full bg-white animate-pulse mr-1" />
                    REC
                  </span>
                )}
              </div>
            </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}