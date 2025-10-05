"use client";

import { useRef, useState, useEffect } from "react";
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

export function CameraStream() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [deviceId, setDeviceId] = useState<string>("");
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [streamId] = useState<string>(`camio-${Math.random().toString(36).substring(2, 15)}`);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [isSecure, setIsSecure] = useState<boolean>(true);
  const [permissionHint, setPermissionHint] = useState<string>("");

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

  // Start/stop streaming
  const toggleStreaming = async () => {
    if (isStreaming && stream) {
      // Stop streaming
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsStreaming(false);
      
      if (isRecording) {
        stopRecording();
      }
      
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
        setStream(mediaStream);
        
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        
        setIsStreaming(true);
        toast.success("Camera streaming started");
      } catch (error: any) {
        console.error('Error accessing media devices:', error);
        let message = "Failed to access camera. Please check permissions.";
        if (error?.name === 'NotAllowedError') {
          message = "Camera permission denied. Allow camera access in your browser settings.";
        } else if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
          message = "No camera found. Please connect a camera or check system permissions.";
        } else if (error?.name === 'SecurityError') {
          message = "Camera blocked on insecure connection. Use HTTPS or localhost.";
        }
        setPermissionHint(message);
        toast.error(message);
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
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
    };
  }, [stream, isRecording]);
  
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
          )}
        </div>
      </CardContent>
    </Card>
  );
}