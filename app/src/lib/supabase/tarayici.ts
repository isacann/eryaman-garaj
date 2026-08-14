'use client'

import { createBrowserClient } from '@supabase/ssr'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env'
import type { Database } from '@/lib/db/types'

let istemci: ReturnType<typeof createBrowserClient<Database>> | null = null

/** Tarayıcı istemcisi. Anon anahtar + RLS ile çalışır. */
export function supabaseTarayici() {
  if (!istemci) {
    istemci = createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)
  }
  return istemci
}
