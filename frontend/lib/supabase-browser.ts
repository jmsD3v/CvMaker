import { createBrowserClient } from '@supabase/ssr'

// Cliente para componentes del navegador ('use client'). No importa next/headers.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
