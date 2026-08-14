import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { SUPABASE_ANON_KEY, SUPABASE_URL, servisAnahtari } from '@/lib/env'
import type { Database } from '@/lib/db/types'

/** Sunucu bileşenleri ve route handler'lar için. Oturum çerezden okunur, RLS geçerli. */
export async function supabaseSunucu() {
  const cerezler = await cookies()
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cerezler.getAll()
      },
      setAll(liste) {
        try {
          for (const { name, value, options } of liste) {
            cerezler.set(name, value, options)
          }
        } catch {
          // Sunucu bileşeninden çağrıldıysa yazılamaz; oturumu middleware tazeliyor.
        }
      },
    },
  })
}

/**
 * Service role istemcisi. RLS'i baypas eder.
 * SADECE sunucu tarafı: webhook, cron, kanal gönderimi. Bileşene sokma.
 */
export function supabaseServis() {
  return createClient<Database>(SUPABASE_URL, servisAnahtari(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
