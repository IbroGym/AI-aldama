"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Bus,
  LayoutDashboard,
  Map,
  MapPin,
  Route,
  MessageSquare,
  Activity,
  Bell,
  Settings,
  Monitor,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { useI18n } from "@/components/i18n-provider"

const mainNavItems = [
  { title: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { title: "Map", href: "/dashboard/map", icon: Map },
  { title: "Fleet", href: "/dashboard/fleet", icon: Bus },
  { title: "Stops", href: "/dashboard/stops", icon: MapPin },
  { title: "Routes", href: "/dashboard/routes", icon: Route },
]

const monitoringItems = [
  { title: "AI Queries", href: "/dashboard/queries", icon: MessageSquare },
  { title: "Metrics", href: "/dashboard/metrics", icon: Activity },
  { title: "Alerts", href: "/dashboard/alerts", icon: Bell },
]

const systemItems = [
  { title: "Kiosk Demo", href: "/kiosk", icon: Monitor },
  { title: "Settings", href: "/dashboard/settings", icon: Settings },
]

export function DashboardSidebar() {
  const { t } = useI18n()
  const pathname = usePathname()

  async function signOut() {
    const supabase = createClient()
    await supabase?.auth.signOut()
    window.location.href = "/auth/login"
  }

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
            <Bus className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <div className="font-semibold text-sidebar-foreground">{t("common.smartBus")}</div>
            <div className="text-xs text-sidebar-foreground/60">{t("common.transitSystem")}</div>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("dashboard.groupNavigation")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>
                        {item.title === "Map"
                          ? t("dashboard.nav.map")
                          : t(
                              `dashboard.nav.${item.title.toLowerCase()}`,
                              item.title,
                            )}
                      </span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>{t("dashboard.groupMonitoring")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {monitoringItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title === "AI Queries" ? t("dashboard.nav.queries") : item.title === "Metrics" ? t("dashboard.nav.metrics") : item.title === "Alerts" ? t("dashboard.nav.alerts") : item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>{t("dashboard.groupSystem")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {systemItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title === "Kiosk Demo" ? t("dashboard.kioskDemo") : item.title === "Settings" ? t("dashboard.settings") : item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-xs text-sidebar-foreground/60">{t("dashboard.systemOnline")}</span>
          </div>
          <Button variant="secondary" className="w-full" onClick={signOut}>
            {t("dashboard.signOut")}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
