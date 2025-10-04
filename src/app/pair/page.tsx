"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Camera, ArrowLeft, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function PairPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPaired, setIsPaired] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Get the token, name, and location from the URL
  const token = searchParams?.get("token");
  const name = searchParams?.get("name");
  const location = searchParams?.get("location");
  
  // Complete the pairing process
  const completePairing = async () => {
    if (!token) {
      toast.error("Invalid pairing token");
      return;
    }
    
    setIsLoading(true);
    
    try {
      // In a real implementation, this would make an API call
      // For this demo, we'll just simulate a successful pairing
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setIsPaired(true);
      toast.success("Device paired successfully!");
      
      // Automatically redirect after successful pairing
      setTimeout(() => {
        router.push("/dashboard");
      }, 3000);
    } catch (error) {
      toast.error("Failed to pair device. Please try again.");
      console.error("Pairing error:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Automatically start pairing if token exists
  useEffect(() => {
    if (token && name) {
      completePairing();
    }
  }, [token, name]);
  
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="p-6 flex items-center">
        <Button variant="ghost" size="icon" className="mr-2 text-white" asChild>
          <a href="/">
            <ArrowLeft className="h-4 w-4" />
          </a>
        </Button>
        <h1 className="text-lg font-semibold">Pair Device</h1>
      </header>
      
      <main className="flex-1 flex flex-col items-center justify-center p-6">
        {isPaired ? (
          <div className="text-center space-y-6 max-w-md mx-auto">
            <div className="flex justify-center">
              <CheckCircle className="h-24 w-24 text-green-500" />
            </div>
            
            <h2 className="text-2xl font-bold">Device Paired!</h2>
            
            <p className="text-gray-400">
              Your device has been successfully paired as "{name}".
            </p>
            
            <p className="text-sm text-gray-500">
              Redirecting to dashboard...
            </p>
          </div>
        ) : (
          <div className="text-center space-y-6 max-w-md mx-auto">
            <div className="flex justify-center">
              <Camera className="h-24 w-24 opacity-50" />
            </div>
            
            <h2 className="text-2xl font-bold">Pair Your Device</h2>
            
            {token ? (
              <>
                <p className="text-gray-400">
                  {isLoading
                    ? `Pairing device "${name}"...`
                    : `Ready to pair device "${name}"`}
                </p>
                
                <Button 
                  onClick={completePairing} 
                  className="bg-white text-black hover:bg-gray-200"
                  disabled={isLoading}
                >
                  {isLoading ? "Pairing..." : "Complete Pairing"}
                </Button>
              </>
            ) : (
              <>
                <p className="text-gray-400">
                  No pairing token provided. Please scan a valid QR code or enter your pairing token below.
                </p>
                
                <div className="space-y-4">
                  <div>
                    <input
                      type="text"
                      placeholder="Enter pairing token"
                      className="w-full px-4 py-2 rounded bg-white/10 border border-white/20"
                    />
                  </div>
                  
                  <Button className="w-full">
                    Pair Device
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}