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
  const [activeTab, setActiveTab] = useState("smartphone");
  const router = useRouter();
  
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
    
    // Try to get the current host (supports localhost, network IP, and deployed URLs)
    const baseUrl = lanBaseUrl ?? (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : 'http://localhost:3000');
    const pairingUrl = `${baseUrl}/pair?token=${uniqueToken}&name=${encodeURIComponent(form.getValues("name"))}`;
    setQrCode(pairingUrl);
    
    // Copy the pairing URL to clipboard
    navigator.clipboard.writeText(pairingUrl).then(() => {
      toast.success("Pairing link copied to clipboard!");
    }).catch(() => {
      toast.error("Failed to copy to clipboard");
    });
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
      
      // Use the new storage system
      const newCamera = addCamera({
        name: values.name,
        location: values.deviceType === 'current' ? 'This Device' : 'External Device',
        status: 'online',
        isRecording: true,
        isLocal: values.deviceType === 'current',
        lastActivity: new Date().toISOString(),
        hasSecurity: false,
        thumbnailUrl: undefined,
        token: uniqueToken,
      });

      toast.success("Camera registered successfully!");

      // If this is the current device, try to capture a short sample recording immediately
      if (values.deviceType === 'current') {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          const recorder = new MediaRecorder(stream);
          const chunks: Blob[] = [];
          recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
          recorder.onstop = async () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            // Try to save recording to IndexedDB to avoid localStorage quota issues
            try {
              const { saveRecording } = await import('@/lib/recordings');
              await saveRecording(newCamera.id, blob);
              window.dispatchEvent(new CustomEvent('camio:recordings:updated', { detail: { cameraId: newCamera.id } }));
            } catch (e) {
              // Fallback: store a data URL in localStorage (may hit quota)
              try {
                const reader = new FileReader();
                reader.onload = () => {
                  try {
                    const dataUrl = reader.result as string;
                    const key = `camio:recordings:${newCamera.id}`;
                    const rawR = localStorage.getItem(key);
                    const arr = rawR ? JSON.parse(rawR) as string[] : [];
                    arr.unshift(dataUrl);
                    localStorage.setItem(key, JSON.stringify(arr.slice(0,5)));
                    window.dispatchEvent(new CustomEvent('camio:recordings:updated', { detail: { cameraId: newCamera.id } }));
                  } catch (e2) {
                    console.error('Failed to save initial recording to localStorage', e2);
                  }
                };
                reader.readAsDataURL(blob);
              } catch (e2) {
                console.error('Failed to store initial recording', e2);
              }
            }
            // stop tracks
            stream.getTracks().forEach(t => t.stop());
          };
          recorder.start();
          setTimeout(() => { if (recorder.state !== 'inactive') recorder.stop(); }, 6000);
        } catch (e) {
          console.warn('Could not auto-capture from device at registration', e);
        }
      }
      
      // Generate the QR code after successful registration for external devices
      if (values.deviceType === "external") {
        generateQrCode();
      } else {
        // For current device, go back to dashboard where the camera will appear
        router.push("/dashboard");
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
                  <div className="bg-amber-50 border border-amber-200 rounded-md p-3 space-y-2">
                    <div className="flex items-center space-x-2">
                      <Info className="h-4 w-4 text-amber-600" />
                      <p className="text-sm font-medium text-amber-800">Network Access Required</p>
                    </div>
                    <div className="text-sm text-amber-700 space-y-1">
                      <p>• Ensure both devices are on the same WiFi network</p>
                      <p>• For external access, consider using ngrok or deploy to production</p>
                      <p>• Current URL: {lanBaseUrl ?? (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')}</p>
                    </div>
                  </div>
                  
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
          </motion.div>
        </form>
      </motion.div>
    </Form>
  );
}