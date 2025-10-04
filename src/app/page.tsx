import { Button } from "@/components/ui/button";
import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Camio - Intelligent Video Surveillance",
  description:
    "Transform any device into a smart security camera with real-time AI analysis, instant alerts, and detailed security reports.",
};

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Navigation */}
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <Image
              src="/camera-logo.svg"
              alt="Camio Logo"
              width={28}
              height={28}
              className="mr-1"
            />
            <span className="text-lg font-bold">Camio</span>
          </div>
          <nav className="ml-auto flex gap-6">
            <Link
              href="#features"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Features
            </Link>
            <Link
              href="#how-it-works"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              How It Works
            </Link>
            <Link
              href="#pricing"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Pricing
            </Link>
          </nav>
          <div className="ml-6 flex items-center gap-4">
            <Link href="/sign-in">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link href="/sign-up">
              <Button size="sm">Sign Up</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex-1 bg-gradient-to-b from-background to-muted/30">
        <div className="container mx-auto flex flex-col items-center gap-12 px-4 py-16 text-center md:flex-row md:text-left lg:gap-16 lg:py-24">
          <div className="space-y-6 md:w-1/2">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Turn Any Device Into an <span className="text-primary">Intelligent</span>{" "}
              Security Camera
            </h1>
            <p className="text-lg text-muted-foreground">
              Camio transforms your old phones, tablets, and webcams into
              AI-powered security cameras. Get real-time alerts, detailed
              incident reports, and peace of mind.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
              <Link href="/sign-up" className="flex-1 sm:flex-none">
                <Button size="lg" className="w-full">
                  Get Started
                </Button>
              </Link>
              <Link href="#demo" className="flex-1 sm:flex-none">
                <Button size="lg" variant="outline" className="w-full">
                  Watch Demo
                </Button>
              </Link>
            </div>
          </div>
          <div className="md:w-1/2 relative">
            <div className="relative h-96 w-full rounded-lg bg-gradient-to-br from-primary/10 to-primary/30 overflow-hidden shadow-2xl">
              <div className="absolute inset-0 flex items-center justify-center">
                <img
                  src="/dashboard-preview.png"
                  alt="Camio Dashboard Preview"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="bg-background py-16 lg:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Powerful Security Features
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Camio combines advanced AI with intuitive design to keep you safe and informed.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1 */}
            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Image 
                  src="/ai-analysis.svg"
                  alt="AI Analysis"
                  width={24}
                  height={24}
                />
              </div>
              <h3 className="mb-2 text-xl font-semibold">Real-Time AI Analysis</h3>
              <p className="text-muted-foreground">
                Google's Gemini Visual Language Model analyzes video streams to
                detect suspicious activities and safety concerns in real-time.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Image 
                  src="/notifications.svg"
                  alt="Instant Alerts"
                  width={24}
                  height={24}
                />
              </div>
              <h3 className="mb-2 text-xl font-semibold">Instant Alerts</h3>
              <p className="text-muted-foreground">
                Receive immediate phone and email notifications when suspicious
                activities or emergencies are detected.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Image 
                  src="/dashboard.svg"
                  alt="Intuitive Dashboard"
                  width={24}
                  height={24}
                />
              </div>
              <h3 className="mb-2 text-xl font-semibold">Intuitive Dashboard</h3>
              <p className="text-muted-foreground">
                Monitor all your cameras from a single, user-friendly
                dashboard with detailed incident timelines and reports.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Image 
                  src="/assistant.svg"
                  alt="AI Assistant"
                  width={24}
                  height={24}
                />
              </div>
              <h3 className="mb-2 text-xl font-semibold">AI Assistant</h3>
              <p className="text-muted-foreground">
                Get contextual advice and support from our OpenAI-powered
                assistant during security incidents.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Image 
                  src="/timeline.svg"
                  alt="Event Timeline"
                  width={24}
                  height={24}
                />
              </div>
              <h3 className="mb-2 text-xl font-semibold">Event Timeline</h3>
              <p className="text-muted-foreground">
                Access a detailed timeline of all security events with
                video evidence and AI analysis.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Image 
                  src="/device.svg"
                  alt="Any Device"
                  width={24}
                  height={24}
                />
              </div>
              <h3 className="mb-2 text-xl font-semibold">Use Any Device</h3>
              <p className="text-muted-foreground">
                Transform old smartphones, tablets, or webcams into
                sophisticated security cameras within minutes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="bg-muted py-16 lg:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              How Camio Works
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Get started with Camio in three simple steps
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {/* Step 1 */}
            <div className="relative rounded-lg bg-background p-6 shadow-sm">
              <div className="absolute -top-4 -left-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <span className="text-xl font-bold">1</span>
              </div>
              <div className="mt-4">
                <h3 className="text-xl font-semibold">Create an Account</h3>
                <p className="mt-2 text-muted-foreground">
                  Sign up for Camio in seconds. No credit card required to get started.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative rounded-lg bg-background p-6 shadow-sm">
              <div className="absolute -top-4 -left-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <span className="text-xl font-bold">2</span>
              </div>
              <div className="mt-4">
                <h3 className="text-xl font-semibold">Register Your Device</h3>
                <p className="mt-2 text-muted-foreground">
                  Connect your smartphone, tablet, or webcam to use as a security camera.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative rounded-lg bg-background p-6 shadow-sm">
              <div className="absolute -top-4 -left-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <span className="text-xl font-bold">3</span>
              </div>
              <div className="mt-4">
                <h3 className="text-xl font-semibold">Monitor Your Space</h3>
                <p className="mt-2 text-muted-foreground">
                  Access your dashboard to view live feeds and receive security alerts.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-12 text-center">
            <Link href="/sign-up">
              <Button size="lg">Get Started Now</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Community Section */}
      <section id="community" className="bg-background py-16 lg:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Built for the Community
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Camio is a free, open solution for everyone
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <div className="mb-4">
                <h3 className="text-xl font-semibold">Free Forever</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  No hidden costs or premium features
                </p>
              </div>
              <ul className="space-y-3 text-sm">
                <li className="flex items-center">
                  <svg
                    className="mr-2 h-4 w-4 text-green-500"
                    fill="none"
                    height="24"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    width="24"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  Unlimited Cameras
                </li>
                <li className="flex items-center">
                  <svg
                    className="mr-2 h-4 w-4 text-green-500"
                    fill="none"
                    height="24"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    width="24"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  Full Video History
                </li>
                <li className="flex items-center">
                  <svg
                    className="mr-2 h-4 w-4 text-green-500"
                    fill="none"
                    height="24"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    width="24"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  Advanced AI Detection
                </li>
                <li className="flex items-center">
                  <svg
                    className="mr-2 h-4 w-4 text-green-500"
                    fill="none"
                    height="24"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    width="24"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  Real-time Notifications
                </li>
              </ul>
              <div className="mt-6">
                <Link href="/sign-up" className="w-full">
                  <Button className="w-full">Get Started</Button>
                </Link>
              </div>
            </div>

            {/* Community Support */}
            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <div className="mb-4">
                <h3 className="text-xl font-semibold">Community Support</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Built by the community, for the community
                </p>
              </div>
              <ul className="space-y-3 text-sm">
                <li className="flex items-center">
                  <svg
                    className="mr-2 h-4 w-4 text-green-500"
                    fill="none"
                    height="24"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    width="24"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  Up to 5 Cameras
                </li>
                <li className="flex items-center">
                  <svg
                    className="mr-2 h-4 w-4 text-green-500"
                    fill="none"
                    height="24"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    width="24"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  Online Documentation
                </li>
                <li className="flex items-center">
                  <svg
                    className="mr-2 h-4 w-4 text-green-500"
                    fill="none"
                    height="24"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    width="24"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  Community Forums
                </li>
                <li className="flex items-center">
                  <svg
                    className="mr-2 h-4 w-4 text-green-500"
                    fill="none"
                    height="24"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    width="24"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  Issue Tracking
                </li>
                <li className="flex items-center">
                  <svg
                    className="mr-2 h-4 w-4 text-green-500"
                    fill="none"
                    height="24"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    width="24"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  Knowledge Base
                </li>
              </ul>
              <div className="mt-6">
                <Link href="/sign-up" className="w-full">
                  <Button className="w-full">Join Community</Button>
                </Link>
              </div>
            </div>

            {/* Open Source */}
            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <div className="mb-4">
                <h3 className="text-xl font-semibold">Open Source</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Contribute to the project
                </p>
              </div>
              <ul className="space-y-3 text-sm">
                <li className="flex items-center">
                  <svg
                    className="mr-2 h-4 w-4 text-green-500"
                    fill="none"
                    height="24"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    width="24"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  Access Source Code
                </li>
                <li className="flex items-center">
                  <svg
                    className="mr-2 h-4 w-4 text-green-500"
                    fill="none"
                    height="24"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    width="24"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  Submit Pull Requests
                </li>
                <li className="flex items-center">
                  <svg
                    className="mr-2 h-4 w-4 text-green-500"
                    fill="none"
                    height="24"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    width="24"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  Contribute to AI Models
                </li>
                <li className="flex items-center">
                  <svg
                    className="mr-2 h-4 w-4 text-green-500"
                    fill="none"
                    height="24"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    width="24"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  Join Development Team
                </li>
                <li className="flex items-center">
                  <svg
                    className="mr-2 h-4 w-4 text-green-500"
                    fill="none"
                    height="24"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    width="24"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  Community Feedback
                </li>
              </ul>
              <div className="mt-6">
                <Link href="https://github.com" target="_blank" rel="noopener noreferrer" className="w-full">
                  <Button variant="outline" className="w-full">
                    View on GitHub
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted py-8 md:py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center gap-6 md:flex-row md:justify-between">
            <div className="flex items-center gap-2">
              <Image
                src="/camera-logo.svg"
                alt="Camio Logo"
                width={24}
                height={24}
                className="mr-1"
              />
              <span className="text-lg font-bold">Camio</span>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-center text-sm text-muted-foreground">
              <Link href="#" className="hover:text-foreground">
                Terms
              </Link>
              <Link href="#" className="hover:text-foreground">
                Privacy
              </Link>
              <Link href="#" className="hover:text-foreground">
                Support
              </Link>
              <Link href="#" className="hover:text-foreground">
                Contact
              </Link>
            </div>
            <div className="text-center text-sm text-muted-foreground">
              © {new Date().getFullYear()} Camio Inc. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
