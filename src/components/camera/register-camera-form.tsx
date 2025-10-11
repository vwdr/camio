"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CameraIcon, Smartphone, Monitor, Info, Copy } from "lucide-react";
import { addCamera } from "@/lib/storage";
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { SignalingServer } from '@/lib/webrtc/signaling-server';

// Form schema with validation
const formSchema = z.object({
  name: z.string().min(2, {
    message: "Camera name must be at least 2 characters.",
  }),
  deviceType: z.enum(["external", "current"]),
});

type FormValues = z.infer<typeof formSchema>;

export function RegisterCameraForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [lanBaseUrl, setLanBaseUrl] = useState<string | null>(null);
  const [uniqueToken, setUniqueToken] = useState<string>("");
  const [pairingServer, setPairingServer] = useState<SignalingServer | null>(null);
  const [waitingForDevice, setWaitingForDevice] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState("smartphone");
  const router = useRouter();
  // Read a public base URL from environment (NEXT_PUBLIC_BASE_URL) if provided.
  // In client bundles, process.env is replaced at build time; we also check window for runtime overrides.
  const publicBase = (typeof window !== 'undefined' && (window as any).__NEXT_PUBLIC_BASE_URL)
    || (process && process.env && process.env.NEXT_PUBLIC_BASE_URL)
    || null;
  const [publicBaseReachable, setPublicBaseReachable] = useState<boolean | null>(null);

  // If a public base URL is configured, probe it to ensure it's online. Use an opaque fetch (no-cors)
  // to distinguish network-level failures (ngrok offline) from CORS issues. If the fetch rejects,
  // we mark it unreachable; if it resolves, we mark reachable. This avoids pointing QR to an offline ngrok.
  useEffect(() => {
    if (!publicBase) {
      setPublicBaseReachable(null);
      return;
    }

    let didCancel = false;
    const probe = async () => {
      try {
        // Attempt a no-cors fetch; this will either resolve (opaque) or reject on network errors.
        await fetch(publicBase, { method: 'GET', mode: 'no-cors' as RequestMode });
        if (!didCancel) setPublicBaseReachable(true);
      } catch (e) {
        if (!didCancel) setPublicBaseReachable(false);
      }
    };

    probe();

    return () => { didCancel = true; };
  }, [publicBase]);
  
  // Animation variants
  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 100, damping: 10 } }
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
  
  // Generate a unique token when the component mounts
  useEffect(() => {
    // Generate a unique token for device pairing
    const token = `camio-${Math.random().toString(36).substring(2, 10)}-${Date.now().toString(36)}`;
    setUniqueToken(token);
  }, []);
  
  // Initialize the form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      deviceType: "external",
    },
  });

  useEffect(() => {
    // Fetch LAN-aware base URL once on mount
    const fetchBase = async () => {
      try {
        const res = await fetch('/api/base-url');
        if (!res.ok) throw new Error('Failed to resolve base URL');
        const data = await res.json();
        setLanBaseUrl(data.baseUrl || null);
      } catch (e) {
        setLanBaseUrl(null);
      }
    };
    fetchBase();
  }, []);

  // Generate QR code for external device registration
  const generateQrCode = () => {
    if (!form.getValues("name")) {
      toast.error("Please enter a camera name first");
      return;
    }
    
    // Prefer a configured public base URL (e.g. ngrok) only if we probed it reachable, otherwise fall back
    let baseUrl: string;
    if (publicBase && publicBaseReachable === true) {
      baseUrl = publicBase;
    } else {
      if (publicBase && publicBaseReachable === false) {
        toast.error('Configured public base URL (ngrok) appears offline; using LAN/base origin instead');
      }
      baseUrl = lanBaseUrl ?? (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : 'http://localhost:3000');
    }
    const pairingUrl = `${baseUrl}/stream?external=true&token=${uniqueToken}&camera=${encodeURIComponent(form.getValues("name"))}&autostart=true`;
    setQrCode(pairingUrl);
    
    // Copy the pairing URL to clipboard
    navigator.clipboard.writeText(pairingUrl).then(() => {
      toast.success("Pairing link copied to clipboard!");
    }).catch(() => {
      toast.error("Failed to copy to clipboard");
    });

    // Start listening for the external device to register itself using the pairing token.
    if (!isSupabaseConfigured) {
      toast.error('Signaling is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local and restart the dev server.');
      console.error('Supabase not configured: cannot start pairing listener');
      return;
    }

    if (supabase) {
      try {
        const ss = new SignalingServer(supabase, uniqueToken);
        ss.connect().then(() => {
          setPairingServer(ss);
          setWaitingForDevice(true);
          toast.info('Waiting for external device to complete registration...');

          ss.onMessage(async (msg: any) => {
            try {
              if (msg.type === 'register-camera' && msg.data?.id) {
                const deviceId = msg.data.id;
                const deviceName = msg.data.name || form.getValues('name');

                // Create camera entry
                const newCamera = addCamera({
                  name: deviceName,
                  location: 'External Device',
                  status: 'online',
                  isRecording: true,
                  isLocal: false,
                  lastActivity: new Date().toISOString(),
                  hasSecurity: false,
                  token: deviceId,
                });

                toast.success(`Device "${deviceName}" registered!`);

                // Send acknowledgement back to the device
                await ss.sendMessage(deviceId, 'register-ack', { cameraId: newCamera.id });

                setWaitingForDevice(false);
                ss.disconnect();
                
                // Redirect to the new camera's detail page
                router.push(`/dashboard/cameras/${newCamera.id}`);
                toast.info(`Redirecting to ${deviceName} camera view...`);
              }
            } catch (e) {
              console.error('Error processing registration message', e);
              toast.error('Failed to process device registration.');
            }
          });
        });
      } catch (e) {
        console.error('Failed to start pairing listener', e);
      }
    }
  };
  


  // Handle form submission
  async function onSubmit(values: FormValues) {
    setIsLoading(true);
    
    try {
      // Add the current date and unique token to the submission
      const submission = {
        ...values,
        registeredAt: new Date().toISOString(),
        token: uniqueToken,
        status: 'pending' // Initial status - waiting for device to connect
      };
      
      console.log('Registering camera:', submission);
      
      // If this is the current device, create the camera entry and redirect to the stream page
      if (values.deviceType === 'current') {
        const newCamera = addCamera({
          name: values.name,
          location: 'This Device',
          status: 'online',
          isRecording: true,
          isLocal: true,
          lastActivity: new Date().toISOString(),
          hasSecurity: false,
          thumbnailUrl: undefined,
          token: uniqueToken,
        });

        toast.success("Camera registered successfully!");

        // Redirect to stream page and auto-start streaming there
        const params = new URLSearchParams();
        params.set('camera', values.name);
        params.set('token', uniqueToken);
        params.set('autostart', 'true');
        router.push(`/dashboard/cameras/stream?${params.toString()}`);
      } else {
        // For external devices: generate QR and start pairing listener; user will scan QR and complete registration from their device.
        generateQrCode();
      }
      
    } catch (error) {
      console.error("Registration error:", error);
      toast.error("Failed to register camera. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
      >
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-4">
            <motion.div variants={fadeIn}>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Camera Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Front Door Camera" {...field} />
                    </FormControl>
                    <FormDescription>
                      Choose a descriptive name to identify this camera.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </motion.div>
          

          
            <motion.div variants={fadeIn} className="pt-2">
              <div className="text-sm font-medium mb-2">Camera Type</div>
              <Tabs defaultValue="external" className="w-full" onValueChange={(value) => form.setValue("deviceType", value as "external" | "current")}>
                <TabsList className="grid grid-cols-2 mb-4">
                  <TabsTrigger value="external">
                    <Smartphone className="h-4 w-4 mr-2" />External Device
                  </TabsTrigger>
                  <TabsTrigger value="current">
                    <Monitor className="h-4 w-4 mr-2" />Current Device
                  </TabsTrigger>
                </TabsList>
              
              <TabsContent value="external" className="space-y-4 border rounded-md p-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <Info className="h-4 w-4 text-blue-500" />
                    <p className="text-sm text-muted-foreground">
                      Turn your smartphone or external camera into a security camera by scanning a QR code
                    </p>
                  </div>
                  
                  {/* Network Access Information */}
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-sm text-muted-foreground text-center max-w-sm">
                      Scan the generated QR on your external device to open the stream page. Once the device
                      starts streaming, press "Register" on that device to link it with this dashboard.
                    </p>

                    <div className="flex justify-center">
                      <Button 
                        type="button"
                        onClick={generateQrCode}
                        variant="outline"
                        disabled={!form.watch("name")}
                      >
                        Generate QR Code
                      </Button>
                    </div>
                  </div>
                </motion.div>
              </TabsContent>
              
              <TabsContent value="current" className="space-y-4 border rounded-md p-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-center space-x-2">
                    <Info className="h-4 w-4 text-blue-500" />
                    <p className="text-sm text-muted-foreground">
                      Use this device's camera as a security camera. Access to your camera will be requested.
                    </p>
                  </div>
                </motion.div>
              </TabsContent>
              

              

            </Tabs>
            </motion.div>
          </div>
        
            <motion.div variants={fadeIn} className="flex flex-col-reverse md:flex-row md:justify-between items-center gap-4 pt-4">
              <div className="flex-1 flex justify-center">
                {/* QR code will appear here when generated */}
                {qrCode && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }} 
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    className="w-full max-w-md bg-white rounded-lg p-4 shadow-md"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="bg-white p-2 rounded-md">
                        <QRCodeSVG value={qrCode} size={180} />
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">
                          Scan this code with your device to connect.
                        </p>
                        <a 
                          href={qrCode}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-sm text-primary underline mt-2 truncate max-w-xs"
                        >
                          {qrCode}
                        </a>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              <div className="flex-shrink-0">
                {/* For current/local device show Register; for external scanning flow we hide the submit because
                    the dashboard will wait for the external device to 'register' itself via signaling. */}
                {form.watch('deviceType') === 'current' ? (
                  <Button 
                    type="submit" 
                    className="min-w-32"
                    disabled={isLoading}
                  >
                    {isLoading && (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="mr-2"
                      >
                        <CameraIcon className="h-4 w-4" />
                      </motion.div>
                    )}
                    Register Camera
                  </Button>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    {waitingForDevice ? 'Waiting for device to complete registration...' : 'Generate the QR to start pairing.'}
                  </div>
                )}
              </div>
            </motion.div>
        </form>
      </motion.div>
    </Form>
  );
}