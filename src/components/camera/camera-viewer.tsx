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

export function CameraViewer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [streamId, setStreamId] = useState<string>("");
  
  // Handle stream ID input
  const handleConnect = () => {
    if (!streamId) {
      toast.error("Please enter a Stream ID to connect");
      return;
    }
    
    setIsLoading(true);
    
    // In a real implementation, this would connect to a WebRTC peer
    // For this demo, we'll simulate a connection after a delay
    setTimeout(() => {
      toast.success(`Connected to stream ${streamId}`);
      setIsLoading(false);
      
      // In a real app, we would display the remote peer's video stream here
      // For this demo, we'll just show a static image or placeholder
      if (videoRef.current) {
        videoRef.current.poster = "/dashboard-preview.png";
      }
    }, 2000);
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