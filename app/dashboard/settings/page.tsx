import { DashboardHeader } from "@/components/dashboard/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Settings, Database, Cpu, Wifi, Shield } from "lucide-react"

export default function SettingsPage() {
  return (
    <div className="flex flex-col">
      <DashboardHeader title="Settings" description="System configuration and status" />

      <main className="flex-1 space-y-6 p-6">
        <div className="grid gap-6 md:grid-cols-2">
          {/* System Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Cpu className="h-4 w-4" />
                System Status
              </CardTitle>
              <CardDescription>Current system health and configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">API Service</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                  <Badge variant="outline" className="text-green-600">Online</Badge>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">AI Question Handler</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                  <Badge variant="outline" className="text-green-600">Active</Badge>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Real-time Updates</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                  <Badge variant="outline" className="text-green-600">Connected</Badge>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">ETA Prediction Engine</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                  <Badge variant="outline" className="text-green-600">Running</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Database */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-4 w-4" />
                Database
              </CardTitle>
              <CardDescription>Supabase PostgreSQL database</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Connection</span>
                <Badge variant="outline" className="text-green-600">Connected</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Tables</span>
                <span className="text-sm font-medium text-foreground">11</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">RLS Enabled</span>
                <Badge variant="outline" className="text-green-600">Yes</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Realtime</span>
                <Badge variant="outline" className="text-green-600">Enabled</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Network */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wifi className="h-4 w-4" />
                Network & API
              </CardTitle>
              <CardDescription>External connections and integrations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">API Gateway</span>
                <Badge variant="outline" className="text-green-600">HTTPS</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Rate Limiting</span>
                <span className="text-sm font-medium text-foreground">100 req/min</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">AI Provider</span>
                <span className="text-sm font-medium text-foreground">OpenAI</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Speech API</span>
                <span className="text-sm font-medium text-foreground">Web Speech</span>
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4" />
                Security
              </CardTitle>
              <CardDescription>Authentication and access control</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Authentication</span>
                <Badge variant="outline" className="text-green-600">Supabase Auth</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Row Level Security</span>
                <Badge variant="outline" className="text-green-600">Enabled</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">API Auth</span>
                <span className="text-sm font-medium text-foreground">JWT Tokens</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Public Access</span>
                <span className="text-sm font-medium text-foreground">Kiosk Only</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Architecture Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings className="h-4 w-4" />
              System Architecture
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 text-sm md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-secondary p-4">
                <div className="font-semibold text-foreground">Physical Layer</div>
                <p className="mt-1 text-muted-foreground">
                  Bus stop devices with digital screens, microphones, speakers, and physical buttons
                </p>
              </div>
              <div className="rounded-lg bg-secondary p-4">
                <div className="font-semibold text-foreground">Network Layer</div>
                <p className="mt-1 text-muted-foreground">
                  HTTPS API Gateway with authentication, rate limiting, and secure connections
                </p>
              </div>
              <div className="rounded-lg bg-secondary p-4">
                <div className="font-semibold text-foreground">Backend & AI Layer</div>
                <p className="mt-1 text-muted-foreground">
                  Real-time API service, NLP question handler, and ETA prediction engine
                </p>
              </div>
              <div className="rounded-lg bg-secondary p-4">
                <div className="font-semibold text-foreground">Data Layer</div>
                <p className="mt-1 text-muted-foreground">
                  PostgreSQL database with GPS data, timetables, config, and ETA cache
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
