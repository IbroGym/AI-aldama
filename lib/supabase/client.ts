import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    // In client components we prefer a soft fallback so the UI can use mock data.
    // Server-side code should validate env strictly.
    if (typeof window !== 'undefined') {
      console.warn(
        '[supabase] Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. Returning null client.',
      )
    }
    return null
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
