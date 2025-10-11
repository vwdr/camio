"use client";

import { useEffect, useState } from "react";
import { useParams } from 'next/navigation';
import { CameraDetail } from "@/components/dashboard/camera-detail";
import { Timeline } from "@/components/dashboard/timeline";
import { getTimeline } from '@/lib/timeline';
import { loadCameras, Camera as StorageCamera } from '@/lib/storage';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download } from "lucide-react";
import Link from "next/link";

// Define camera interface for CameraDetail component
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
  token?: string;
}

// Mock data for camera details - in a real app, this would come from the database based on ID
const cameras: Record<string, Camera> = {
  "camera-1": {
    id: "camera-1",
    name: "Front Door",
    location: "Entrance",
    status: "online",
    resolution: "1080p",
    frameRate: "30fps",
    lastActivity: "2 minutes ago",
    streamUrl: "https://static.videezy.com/system/resources/previews/000/044/479/original/alley.mp4", // Sample video
    model: "Camio Pro Outdoor",
    connected: "3 days ago",
  },
  "camera-2": {
    id: "camera-2",
    name: "Backyard",
    location: "Garden",
    status: "online",
    resolution: "1080p",
    frameRate: "30fps",
    lastActivity: "5 minutes ago",
    streamUrl: "https://static.videezy.com/system/resources/previews/000/050/692/original/DSC_7594.mp4", // Sample video
    model: "Camio Pro Outdoor",
    connected: "5 days ago",
  },
  "camera-3": {
    id: "camera-3",
    name: "Living Room",
    location: "Indoor",
    status: "online",
    resolution: "1080p",
    frameRate: "30fps",
    lastActivity: "Just now",
    streamUrl: "https://static.videezy.com/system/resources/previews/000/021/800/original/486204560.mp4", // Sample video
    model: "Camio Indoor",
    connected: "2 days ago",
  },
  "camera-4": {
    id: "camera-4",
    name: "Garage",
    location: "Exterior",
    status: "offline",
    resolution: "1080p",
    frameRate: "25fps",
    lastActivity: "3 hours ago",
    streamUrl: "",
    model: "Camio Pro Outdoor",
    connected: "7 days ago",
  },
  "camera-5": {
    id: "camera-5",
    name: "Kitchen",
    location: "Indoor",
    status: "online",
    resolution: "720p",
    frameRate: "30fps",
    lastActivity: "1 minute ago",
    streamUrl: "https://static.videezy.com/system/resources/previews/000/007/675/original/Tropical_Beach_Holiday_Travel.mp4", // Sample video
    model: "Camio Indoor Mini",
    connected: "1 day ago",
  }
};

  

export default function CameraDetailPage() {
  const params = useParams();
  const cameraId = params?.id as string | undefined;
  const [camera, setCamera] = useState<any | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);

  useEffect(() => {
    setTimelineEvents(getTimeline(cameraId || ''));
    const onUpdate = (e: any) => { if (!e?.detail || e.detail.cameraId === cameraId) setTimelineEvents(getTimeline(cameraId || '')); };
    window.addEventListener('camio:timeline:updated', onUpdate as EventListener);
    return () => window.removeEventListener('camio:timeline:updated', onUpdate as EventListener);
  }, [cameraId]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('camio:cameras');
      const list = raw ? JSON.parse(raw) as any[] : [];
      const found = list.find((c) => c.id === cameraId);
      if (found) {
        // Map storage camera to component camera format
        const mappedCamera = {
          id: found.id,
          name: found.name,
          location: found.location,
          status: found.status,
          resolution: '1080p',
          frameRate: '30fps',
          lastActivity: found.lastActivity,
          model: 'External Device',
          connected: found.registeredAt,
          isRecording: found.isRecording,
          isLocal: found.isLocal,
          token: found.token,
        };
        setCamera(mappedCamera);
        return;
      }

  // Fallback to bundled mocks if not found in local storage
  const fallback = cameraId ? cameras[cameraId] : undefined;
  setCamera(fallback || null);
    } catch (e) {
      console.error('Failed to load camera for detail page', e);
      setCamera(null);
    }
  }, [cameraId]);
  
  if (camera === null) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="mr-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h2 className="text-2xl font-semibold">Camera not found</h2>
        </div>
        <p className="text-sm text-muted-foreground">No camera data available for this ID.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="mr-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h2 className="text-3xl font-bold tracking-tight">{camera.name}</h2>
          <div className="ml-3 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold">
            {camera.status === "online" ? (
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 mr-1" />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 mr-1" />
            )}
            {camera.status}
          </div>
        </div>
        <Button variant="outline" disabled={camera.status !== "online"}>
          <Download className="mr-2 h-4 w-4" />
          Download Footage
        </Button>
      </div>
      
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CameraDetail camera={camera} />
        </div>
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Timeline</h3>
          <Timeline events={timelineEvents} />
        </div>
      </div>
    </div>
  );
}
