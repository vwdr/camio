import { Metadata } from "next";
import { RegisterCameraForm } from "@/components/camera/register-camera-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Register Camera | Camio",
  description: "Register a new device as a security camera.",
};

export default function RegisterCameraPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold tracking-tight">Register New Camera</h2>
          <p className="text-muted-foreground">
            Connect a new device to use as a security camera in your Camio dashboard.
          </p>
        </div>
        <Card>
          <CardHeader className="text-center">
            <CardTitle>Camera Details</CardTitle>
            <CardDescription>Enter information about the camera you want to register.</CardDescription>
          </CardHeader>
          <CardContent>
            <RegisterCameraForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}