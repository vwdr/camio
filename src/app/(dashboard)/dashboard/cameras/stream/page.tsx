"use client";

import { CameraStream } from "@/components/camera/camera-stream";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function StreamCameraPage() {
  const searchParams = useSearchParams();
  const [activeTab] = useState<string>("stream");
  
  // Keep simple: always show the streaming portal; external devices will auto-start in the component.
  useEffect(() => {}, [searchParams]);
  
  const cameraName = searchParams?.get("camera") || "External Camera";
  const isExternal = searchParams?.get("external") === "true";
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center">
          {!isExternal && (
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" className="mr-2">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
          )}
          <h2 className="text-3xl font-bold tracking-tight">
            {isExternal ? `Streaming: ${cameraName}` : "Stream Camera"}
          </h2>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CameraStream />
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>How It Works</CardTitle>
              <CardDescription>
                Turn your device into an AI-powered security camera
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-semibold">1. Start Streaming</h4>
                  <p className="text-sm text-muted-foreground">
                    Click the Start button to begin streaming from your device's camera.
                    This will use your device's camera and microphone.
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">2. Enable AI Analysis</h4>
                  <p className="text-sm text-muted-foreground">
                    Click "Start AI Analysis" to enable real-time video processing.
                    The AI will detect people, objects, and unusual activities.
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">3. Record Footage</h4>
                  <p className="text-sm text-muted-foreground">
                    Use the Record button to save footage locally.
                    All recordings include timestamps and can be reviewed later.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Privacy Note</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                All video processing happens locally on your device first.
                Only analysis results and selected footage are sent to Camio's secure servers.
                We do not store raw video unless you explicitly save it.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
