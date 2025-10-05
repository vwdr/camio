import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Navigation */}
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            {/* Make the logo visible on dark backgrounds */}
            <Image
              src="/camera-logo.svg"
              alt="Camio Logo"
              width={28}
              height={28}
              className="mr-1 rounded bg-white p-1"
            />
            <span className="text-lg font-bold">Camio</span>
          </div>
          <nav className="ml-auto hidden gap-6 sm:flex">
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
          </nav>
          <div className="ml-auto sm:ml-6 flex items-center gap-2 sm:gap-4">
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

      {/* Hero Section (centered, no dashboard preview image) */}
      <section className="flex-1 bg-gradient-to-b from-background to-muted/30">
        <div className="container mx-auto flex flex-col items-center gap-10 px-4 py-16 text-center lg:gap-16 lg:py-24">
          <div className="space-y-6 max-w-3xl">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Turn Any Device Into an <span className="text-primary">Intelligent</span>{" "}
              Security Camera
            </h1>
            <p className="text-lg text-muted-foreground">
              Camio transforms your old phones, tablets, and webcams into AI-powered security cameras.
              Get real-time alerts, detailed incident reports, and peace of mind.
            </p>
            <div className="mx-auto flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:gap-4">
              <Link href="/sign-up" className="flex-1">
                <Button size="lg" className="w-full">Get Started</Button>
              </Link>
              <Link href="#how-it-works" className="flex-1">
                <Button size="lg" variant="outline" className="w-full">How It Works</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-background py-16 lg:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Powerful Security Features</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Camio combines advanced AI with intuitive design to keep you safe and informed.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1 */}
            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Image src="/ai-analysis.svg" alt="AI Analysis" width={24} height={24} className="dark:invert" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">Real-Time AI Analysis</h3>
              <p className="text-muted-foreground">
                Analyze video streams to detect suspicious activities and safety concerns in real-time.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Image src="/notifications.svg" alt="Instant Alerts" width={24} height={24} className="dark:invert" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">Instant Alerts</h3>
              <p className="text-muted-foreground">
                Receive immediate notifications when suspicious activities or emergencies are detected.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Image src="/dashboard.svg" alt="Intuitive Dashboard" width={24} height={24} className="dark:invert" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">Intuitive Dashboard</h3>
              <p className="text-muted-foreground">
                Monitor all your cameras from a single, user-friendly dashboard with detailed timelines and reports.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Image src="/assistant.svg" alt="AI Assistant" width={24} height={24} className="dark:invert" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">AI Assistant</h3>
              <p className="text-muted-foreground">
                Get contextual guidance from an assistant during security incidents.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Image src="/timeline.svg" alt="Event Timeline" width={24} height={24} className="dark:invert" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">Event Timeline</h3>
              <p className="text-muted-foreground">
                Review a detailed timeline of security events with evidence and analysis.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Image src="/device.svg" alt="Any Device" width={24} height={24} className="dark:invert" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">Use Any Device</h3>
              <p className="text-muted-foreground">
                Turn old smartphones, tablets, or webcams into powerful security cameras in minutes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="bg-muted py-16 lg:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">How Camio Works</h2>
            <p className="mt-4 text-lg text-muted-foreground">Get started in three simple steps</p>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {/* Step 1 */}
            <div className="relative rounded-lg bg-background p-6 shadow-sm">
              <div className="absolute -top-4 -left-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <span className="text-xl font-bold">1</span>
              </div>
              <div className="mt-4">
                <h3 className="text-xl font-semibold">Create an Account</h3>
                <p className="mt-2 text-muted-foreground">Sign up in seconds. No credit card required.</p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative rounded-lg bg-background p-6 shadow-sm">
              <div className="absolute -top-4 -left-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <span className="text-xl font-bold">2</span>
              </div>
              <div className="mt-4">
                <h3 className="text-xl font-semibold">Register Your Device</h3>
                <p className="mt-2 text-muted-foreground">Connect your phone, tablet, or webcam as a camera.</p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative rounded-lg bg-background p-6 shadow-sm">
              <div className="absolute -top-4 -left-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <span className="text-xl font-bold">3</span>
              </div>
              <div className="mt-4">
                <h3 className="text-xl font-semibold">Monitor Your Space</h3>
                <p className="mt-2 text-muted-foreground">View live feeds and receive alerts from your dashboard.</p>
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
                className="mr-1 dark:invert"
              />
              <span className="text-lg font-bold">Camio</span>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-center text-sm text-muted-foreground">
              <Link href="#" className="hover:text-foreground">Terms</Link>
              <Link href="#" className="hover:text-foreground">Privacy</Link>
              <Link href="#" className="hover:text-foreground">Support</Link>
              <Link href="#" className="hover:text-foreground">Contact</Link>
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
