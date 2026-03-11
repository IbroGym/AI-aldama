import React from "react"
import Link from "next/link"
import { Bus, LayoutDashboard, Monitor, Mic, MapPin, Activity } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Bus className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Smart Bus Stop</h1>
              <p className="text-sm text-muted-foreground">Transit Management System</p>
            </div>
          </div>
          <nav className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <Button asChild>
              <Link href="/kiosk">Kiosk Demo</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-12">
        <section className="mb-16 text-center">
          <h2 className="mb-4 text-balance text-4xl font-bold tracking-tight text-foreground">
            Intelligent Transit Infrastructure
          </h2>
          <p className="mx-auto max-w-2xl text-pretty text-lg text-muted-foreground">
            Real-time bus tracking, AI-powered passenger assistance, and comprehensive 
            transit management for modern cities.
          </p>
        </section>

        <section className="mb-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<MapPin className="h-6 w-6" />}
            title="Real-Time Tracking"
            description="GPS-enabled buses provide live location data with accurate ETA predictions powered by machine learning."
          />
          <FeatureCard
            icon={<Mic className="h-6 w-6" />}
            title="Voice Assistant"
            description="Natural language processing enables passengers to ask questions about routes, schedules, and arrivals."
          />
          <FeatureCard
            icon={<Monitor className="h-6 w-6" />}
            title="Digital Displays"
            description="Bus stops equipped with screens showing real-time arrivals, alerts, and transit information."
          />
          <FeatureCard
            icon={<Activity className="h-6 w-6" />}
            title="Predictive ETAs"
            description="AI models analyze traffic patterns, historical data, and current conditions for accurate arrival times."
          />
          <FeatureCard
            icon={<LayoutDashboard className="h-6 w-6" />}
            title="Operations Dashboard"
            description="Centralized monitoring of fleet status, system health, passenger queries, and service alerts."
          />
          <FeatureCard
            icon={<Bus className="h-6 w-6" />}
            title="Fleet Management"
            description="Track vehicle positions, monitor routes, and manage schedules across the entire transit network."
          />
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <Card className="overflow-hidden">
            <CardHeader className="bg-sidebar text-sidebar-foreground">
              <CardTitle className="flex items-center gap-2">
                <LayoutDashboard className="h-5 w-5" />
                Admin Dashboard
              </CardTitle>
              <CardDescription className="text-sidebar-foreground/70">
                Monitor and manage transit operations
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <ul className="mb-6 space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Real-time fleet tracking with live map
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  System metrics and performance analytics
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  AI query logs and passenger insights
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Service alerts and notifications
                </li>
              </ul>
              <Button asChild className="w-full">
                <Link href="/dashboard">Open Dashboard</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="bg-foreground text-background">
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                Bus Stop Kiosk
              </CardTitle>
              <CardDescription className="text-background/70">
                Interactive passenger display simulator
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <ul className="mb-6 space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  Live arrival times and ETA display
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  Voice-activated AI assistant
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  Service alerts and announcements
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  Text-to-speech responses
                </li>
              </ul>
              <Button variant="secondary" asChild className="w-full">
                <Link href="/kiosk">Launch Kiosk</Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto max-w-7xl px-6 py-6 text-center text-sm text-muted-foreground">
          Smart Bus Stop System - Real-time transit infrastructure
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ 
  icon, 
  title, 
  description 
}: { 
  icon: React.ReactNode
  title: string
  description: string 
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <h3 className="mb-2 font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}
