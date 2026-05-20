import type { SupabaseClient, User } from "@supabase/supabase-js"

export type DashboardRole = "admin" | "operator" | "viewer"

export function canManageAlerts(role: DashboardRole | null | undefined): boolean {
  return role === "admin" || role === "operator"
}

export function canDeleteAlerts(role: DashboardRole | null | undefined): boolean {
  return role === "admin"
}

export async function getDashboardSession(
  supabase: SupabaseClient
): Promise<{ user: User | null; role: DashboardRole | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { user: null, role: null }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  const role = profile?.role as DashboardRole | undefined
  if (role === "admin" || role === "operator" || role === "viewer") {
    return { user, role }
  }
  return { user, role: "viewer" }
}
