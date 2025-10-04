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

  // Generate QR code for external device registration
  const generateQrCode = () => {
    if (!form.getValues("name")) {
      toast.error("Please enter a camera name first");
      return;
    }
    
    // Generate a proper pairing URL using localhost
    const pairingUrl = `http://localhost:3000/pair?token=${uniqueToken}&name=${encodeURIComponent(form.getValues("name"))}`;
    setQrCode(pairingUrl);
    
    // Copy the pairing URL to clipboard
    navigator.clipboard.writeText(pairingUrl).then(() => {
      toast.info("Pairing link copied to clipboard. Scan the QR code or share the link with your device.", { duration: 5000 });
    });
  };
  
  // Copy the pairing token
  const copyPairingToken = () => {
    navigator.clipboard.writeText(uniqueToken);
    toast.success("Pairing token copied to clipboard");
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
      
      // Persist the camera to localStorage so the dashboard can load it
      const id = `camio-${Math.random().toString(36).substring(2, 10)}`;
      const newCamera = {
        id,
        name: values.name,
        location: values.deviceType === 'current' ? 'This Device' : 'External Device',
        // Default to online and actively recording per request
        status: 'online',
        isRecording: true,
        // Mark cameras created from this browser as local so we can access device
        isLocal: values.deviceType === 'current',
        lastActivity: new Date().toISOString(),
        hasSecurity: false,
        thumbnailUrl: undefined,
        registeredAt: new Date().toISOString(),
        token: uniqueToken,
      };

      try {
        const raw = localStorage.getItem('camio:cameras');
        const existing = raw ? (JSON.parse(raw) as any[]) : [];
        existing.unshift(newCamera);
        localStorage.setItem('camio:cameras', JSON.stringify(existing));

        // Notify other parts of the app (dashboard) to refresh
        window.dispatchEvent(new Event('camio:cameras:updated'));

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
                await saveRecording(id, blob);
                window.dispatchEvent(new CustomEvent('camio:recordings:updated', { detail: { cameraId: id } }));
              } catch (e) {
                // Fallback: store a data URL in localStorage (may hit quota)
                try {
                  const reader = new FileReader();
                  reader.onload = () => {
                    try {
                      const dataUrl = reader.result as string;
                      const key = `camio:recordings:${id}`;
                      const rawR = localStorage.getItem(key);
                      const arr = rawR ? JSON.parse(rawR) as string[] : [];
                      arr.unshift(dataUrl);
                      localStorage.setItem(key, JSON.stringify(arr.slice(0,5)));
                      window.dispatchEvent(new CustomEvent('camio:recordings:updated', { detail: { cameraId: id } }));
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
      } catch (e) {
        console.error('Failed to persist camera to localStorage', e);
        toast.error('Failed to save camera locally');
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
                  
                  <div className="flex items-center space-x-2">
                    <div className="font-mono text-xs bg-muted p-2 rounded flex-1">
                      {uniqueToken}
                    </div>
                    <Button variant="outline" size="sm" onClick={copyPairingToken}>
                      <Copy className="h-4 w-4" />
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
        
          <motion.div variants={fadeIn} className="flex justify-between items-center pt-4">
            <div>
              {/* QR code will appear here when generated */}
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
              {qrCode ? "Generate New Code" : "Register Camera"}
            </Button>
            
            {qrCode && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="w-full max-w-md bg-white rounded-lg p-4 shadow-md"
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="bg-white p-2 rounded-md">
                    <QRCodeSVG value={qrCode} size={160} />
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
          </motion.div>
        </form>
      </motion.div>
    </Form>
  );
}