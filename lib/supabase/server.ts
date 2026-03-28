import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

/**
 * Especially important if using Fluid compute: Don't put this client in a
 * global variable. Always create a new client within each function when using
 * it.
 */
export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      [
        'Supabase env vars are missing.',
        'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local, then restart `npm run dev`.',
      ].join(' '),
    )
  }

  return createServerClientWithCookies(supabaseUrl, supabaseAnonKey)
}

/** Same session/cookies as createClient, but returns null if env is missing (mock fallbacks). */
export async function createClientOrNull(): Promise<SupabaseClient | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) return null
  return createServerClientWithCookies(supabaseUrl, supabaseAnonKey)
}

async function createServerClientWithCookies(
  supabaseUrl: string,
  supabaseAnonKey: string,
) {
  const cookieStore = await cookies()

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          )
        } catch {
          // The "setAll" method was called from a Server Component.
          // This can be ignored if you have proxy refreshing
          // user sessions.
        }
      },
    },
  })
}
