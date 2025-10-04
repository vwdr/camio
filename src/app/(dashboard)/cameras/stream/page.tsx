"use client";

import { CameraStream } from "@/components/camera/camera-stream";
import { CameraViewer } from "@/components/camera/camera-viewer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Video, Eye } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function StreamCameraPage() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<string>("stream");
  
  // Check for connect parameter to determine if we're viewing a shared stream
  useEffect(() => {
    const connectParam = searchParams?.get("connect");
    if (connectParam) {
      setActiveTab("view");
    }
  }, [searchParams]);
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="mr-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h2 className="text-3xl font-bold tracking-tight">
            {activeTab === "stream" ? "Stream Camera" : "View Camera Stream"}
          </h2>
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="stream" className="flex items-center gap-2">
            <Video className="h-4 w-4" />
            Stream Camera
          </TabsTrigger>
          <TabsTrigger value="view" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            View Stream
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="stream" className="mt-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
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
                    
                    <div className="space-y-2">
                      <h4 className="font-semibold">4. Share Your Stream</h4>
                      <p className="text-sm text-muted-foreground">
                        Use the "Share Stream" button to generate a link others can use to view your stream.
                        Anyone with the link can connect and view the stream in real-time.
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
        </TabsContent>
        
        <TabsContent value="view" className="mt-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <CameraViewer />
            </div>
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Connect to a Stream</CardTitle>
                  <CardDescription>
                    View a shared camera stream from another user
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h4 className="font-semibold">1. Get a Stream ID</h4>
                      <p className="text-sm text-muted-foreground">
                        Ask the person sharing their camera for their Stream ID or link.
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="font-semibold">2. Connect</h4>
                      <p className="text-sm text-muted-foreground">
                        Enter the Stream ID and click Connect to start viewing the shared stream.
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="font-semibold">3. Watch Securely</h4>
                      <p className="text-sm text-muted-foreground">
                        The connection is end-to-end encrypted using WebRTC technology.
                        No one else can access this stream.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Troubleshooting</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Make sure the Stream ID is correct</li>
                    <li>• Verify that the camera is currently streaming</li>
                    <li>• Check your network connection</li>
                    <li>• Try refreshing the page if connection fails</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}