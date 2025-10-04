import { Metadata } from "next";
import Link from "next/link";
import SignUpForm from "@/components/auth/sign-up-form";

export const metadata: Metadata = {
  title: "Sign Up | Camio",
  description: "Sign up for Camio to transform your devices into security cameras.",
};

export default function SignUpPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">Sign Up</h1>
          <p className="text-muted-foreground">
            Create an account to start using Camio security cameras
          </p>
        </div>
        <SignUpForm />
        <div className="text-center text-sm">
          Already have an account?{" "}
          <Link href="/sign-in" className="underline underline-offset-4 hover:text-primary">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}