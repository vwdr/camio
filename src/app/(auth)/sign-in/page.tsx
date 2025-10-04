import { Metadata } from "next";
import Link from "next/link";
import SignInForm from "@/components/auth/sign-in-form";

export const metadata: Metadata = {
  title: "Sign In | Camio",
  description: "Sign in to your Camio account to access your security cameras.",
};

export default function SignInPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">Sign In</h1>
          <p className="text-muted-foreground">
            Enter your email and password to sign in to your account
          </p>
        </div>
        <SignInForm />
        <div className="text-center text-sm">
          Don&apos;t have an account?{" "}
          <Link href="/sign-up" className="underline underline-offset-4 hover:text-primary">
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}