"use client";

import { useEffect, useState } from "react";
import { Metadata } from "next";
import { CameraCard } from "@/components/dashboard/camera-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PlusCircle, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { loadCameras, saveCameras, Camera as StorageCamera } from "@/lib/storage";

// Metadata is now defined in layout.tsx for client components

// Camera type definition
interface Camera {
  id: string;
  name: string;
  location: string;
  status: string;
  lastActivity: string;
  hasSecurity: boolean;
  thumbnailUrl?: string;
}

// Cameras are persisted by the user (no template cameras are added by default)
// We'll load cameras from localStorage; the register form writes to the same key.
// Key: 'camio:cameras' -> JSON array of cameras

// Alert type definition
interface Alert {
  id: string;
  camera: string;
  timestamp: string;
  type: string;
  description: string;
  severity: string;
}

// No alerts to start with
const recentAlert: Alert | null = null;

export default function DashboardPage() {
  const [cameras, setCameras] = useState<StorageCamera[]>([]);

  // Load cameras from storage on mount
  useEffect(() => {
    try {
      setCameras(loadCameras());
    } catch (e) {
      console.error('Failed to load cameras from storage', e);
      setCameras([]);
    }

    // Listen for updates when other parts of the app dispatch an event
    const handler = () => {
      try {
        setCameras(loadCameras());
      } catch (e) {
        console.error('Failed to refresh cameras from storage', e);
      }
    };

    window.addEventListener('camio:cameras:updated', handler as EventListener);
    // Also listen for storage events (other tabs)
    const storageHandler = (ev: StorageEvent) => {
      if (ev.key === 'camio:cameras') handler();
    };
    window.addEventListener('storage', storageHandler);

    return () => {
      window.removeEventListener('camio:cameras:updated', handler as EventListener);
      window.removeEventListener('storage', storageHandler);
    };
  }, []);
  // Animation variants
  const fadeIn = {
    hidden: { opacity: 0, y: 10 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        type: "spring" as const,
        stiffness: 100,
        damping: 15
      }
    }
  };
  
  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className="space-y-6"
    >
      <motion.div 
        variants={fadeIn}
        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
      >
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>

      </motion.div>
      
      {recentAlert && (
        <motion.div variants={fadeIn}>
          <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <AlertTitle className="text-destructive">Security Alert: {recentAlert.type}</AlertTitle>
            <AlertDescription>
              {recentAlert.description} at {recentAlert.camera}, {recentAlert.timestamp}. 
              <Button variant="link" className="p-0 h-auto ml-1">View Details</Button>
            </AlertDescription>
          </Alert>
        </motion.div>
      )}

      <motion.div variants={fadeIn} className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">Your Cameras</h3>
          <motion.div whileHover={{ x: 2 }} whileTap={{ scale: 0.98 }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                try {
                  if (!confirm('Clear all cameras? This will remove all cameras and their local recordings.')) return;
                  const current = loadCameras();
                  // Remove local recording blobs for each camera
                  current.forEach((c) => {
                    try { localStorage.removeItem(`camio:recordings:${c.id}`); } catch {}
                  });
                  // Clear camera list
                  saveCameras([]);
                  setCameras([]);
                } catch (e) {
                  console.error('Failed to clear all cameras', e);
                }
              }}
            >
              Clear All
            </Button>
          </motion.div>
        </div>
        <motion.div 
          variants={staggerContainer}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {cameras.map((camera, index) => (
            <motion.div
              key={camera.id}
              variants={fadeIn}
              custom={index}
            >
              <CameraCard camera={camera} />
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}