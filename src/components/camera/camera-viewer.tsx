"use client";

import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Camera, 
  Volume2,
  VolumeX,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { SignalingServer } from '@/lib/webrtc/signaling-server';
import { PeerConnection } from '@/lib/webrtc/peer-connection';
import type { SupabaseClient } from '@supabase/supabase-js';

export function CameraViewer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [streamId, setStreamId] = useState<string>("");
  const [signaling, setSignaling] = useState<SignalingServer | null>(null);
  const pcRef = useRef<PeerConnection | null>(null);

  useEffect(() => {
    return () => {
      try { pcRef.current?.close(); } catch (e) { console.warn('Error closing pc', e); }
      try { signaling?.disconnect(); } catch (e) { /* ignore */ }
    };
  }, [signaling]);
  
  // Handle stream ID input
  const handleConnect = () => {
    if (!streamId) {
      toast.error("Please enter a Stream ID to connect");
      return;
    }

    setIsLoading(true);

    if (!isSupabaseConfigured) {
      toast.error('Remote viewing is disabled: Supabase signaling is not configured.');
      setIsLoading(false);
      return;
    }

    (async () => {
      try {
        const viewerId = `viewer-${Math.random().toString(36).substring(2, 12)}`;
        const supabaseClient = supabase as SupabaseClient;

        // Tear down any existing signaling session before creating a new one
        if (signaling) {
          try { signaling.disconnect(); } catch (err) { console.warn('Failed to disconnect previous signaling session', err); }
        }

        const ss = new SignalingServer(supabaseClient, viewerId);
        await ss.connect();
        setSignaling(ss);

        const pc = new PeerConnection(ss, undefined, {
          onError: (e) => { console.error('Viewer PC error', e); toast.error('Connection error'); },
          onConnectionStateChange: (s) => console.log('Viewer connection state', s),
          onRemoteStream: (stream) => {
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
              videoRef.current.play().catch(() => {});
            }
          }
        });
        pcRef.current = pc;

        await pc.initializeAsViewer(streamId);

        toast.success(`Connected to stream ${streamId}`);
        setIsLoading(false);
      } catch (err: any) {
        console.error('Failed to connect to stream', err);
        toast.error('Failed to connect to stream');
        setIsLoading(false);
      }
    })();
  };
  
  // Toggle audio mute
  const toggleMute = () => {
    setIsMuted(!isMuted);
    
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
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
            muted={isMuted}
            className="w-full h-full object-cover"
          />
          
          {isLoading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white">
              <Camera className="h-16 w-16 mb-2 opacity-50" />
              <p className="text-lg font-medium mb-4">Connect to a Camera</p>
              
              <div className="w-64 space-y-4">
                <div className="relative">
                  <input
                    type="text"
                    value={streamId}
                    onChange={(e) => setStreamId(e.target.value)}
                    placeholder="Enter Stream ID"
                    className="w-full px-4 py-2 rounded bg-black/50 border border-white/20 text-white placeholder:text-white/50"
                  />
                </div>
                
                <Button 
                  onClick={handleConnect} 
                  className="w-full"
                  disabled={!streamId}
                >
                  Connect
                </Button>
              </div>
            </div>
          ) : (
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
              <Button 
                variant="outline" 
                size="icon" 
                className="bg-black/50 border-white/20 text-white hover:bg-black/70"
                onClick={toggleMute}
              >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              
              <div className="flex items-center gap-2">
                <span className="text-xs text-white bg-black/60 px-2 py-1 rounded-full">
                  Viewing: {streamId}
                </span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// cleanup handled by React unmount via effect inside component