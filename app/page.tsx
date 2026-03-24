"use client"

import React from "react"
import Link from "next/link"
import { Bus, LayoutDashboard, Monitor, Mic, MapPin, Activity } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useI18n } from "@/components/i18n-provider"
import { LanguageSwitcher } from "@/components/language-switcher"

export default function HomePage() {
  const { t } = useI18n()

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
              <p className="text-sm text-muted-foreground">{t("common.transitSystem")}</p>
            </div>
          </div>
          <nav className="flex items-center gap-3">
            <LanguageSwitcher />
            <Button variant="ghost" asChild>
              <Link href="/dashboard">{t("home.dashboard")}</Link>
            </Button>
            <Button asChild>
              <Link href="/kiosk">{t("home.kioskDemo")}</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-12">
        <section className="mb-16 text-center">
          <h2 className="mb-4 text-balance text-4xl font-bold tracking-tight text-foreground">
            {t("home.heroTitle")}
          </h2>
          <p className="mx-auto max-w-2xl text-pretty text-lg text-muted-foreground">
            {t("home.heroSubtitle")}
          </p>
        </section>

        <section className="mb-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<MapPin className="h-6 w-6" />}
            title={t("home.feature.realtime.title")}
            description={t("home.feature.realtime.desc")}
          />
          <FeatureCard
            icon={<Mic className="h-6 w-6" />}
            title={t("home.feature.voice.title")}
            description={t("home.feature.voice.desc")}
          />
          <FeatureCard
            icon={<Monitor className="h-6 w-6" />}
            title={t("home.feature.display.title")}
            description={t("home.feature.display.desc")}
          />
          <FeatureCard
            icon={<Activity className="h-6 w-6" />}
            title={t("home.feature.eta.title")}
            description={t("home.feature.eta.desc")}
          />
          <FeatureCard
            icon={<LayoutDashboard className="h-6 w-6" />}
            title={t("home.feature.ops.title")}
            description={t("home.feature.ops.desc")}
          />
          <FeatureCard
            icon={<Bus className="h-6 w-6" />}
            title={t("home.feature.fleet.title")}
            description={t("home.feature.fleet.desc")}
          />
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <Card className="overflow-hidden">
            <CardHeader className="bg-sidebar text-sidebar-foreground">
              <CardTitle className="flex items-center gap-2">
                <LayoutDashboard className="h-5 w-5" />
                {t("home.adminCard.title")}
              </CardTitle>
              <CardDescription className="text-sidebar-foreground/70">
                {t("home.adminCard.desc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <ul className="mb-6 space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  {t("home.adminCard.b1")}
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  {t("home.adminCard.b2")}
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  {t("home.adminCard.b3")}
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  {t("home.adminCard.b4")}
                </li>
              </ul>
              <Button asChild className="w-full">
                <Link href="/dashboard">{t("home.openDashboard")}</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="bg-foreground text-background">
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                {t("home.kioskCard.title")}
              </CardTitle>
              <CardDescription className="text-background/70">
                {t("home.kioskCard.desc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <ul className="mb-6 space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  {t("home.kioskCard.b1")}
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  {t("home.kioskCard.b2")}
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  {t("home.kioskCard.b3")}
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  {t("home.kioskCard.b4")}
                </li>
              </ul>
              <Button variant="secondary" asChild className="w-full">
                <Link href="/kiosk">{t("home.launchKiosk")}</Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto max-w-7xl px-6 py-6 text-center text-sm text-muted-foreground">
          {t("home.footer")}
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
