// Ortam değişkenleri tek yerden okunur. Eksikse sessizce çalışmaz, patlar.

function zorunlu(ad: string, deger: string | undefined): string {
  if (!deger) {
    throw new Error(
      `Ortam değişkeni eksik: ${ad}. "npm run env" ile .env.local üret.`,
    )
  }
  return deger
}

export const SUPABASE_URL = zorunlu(
  'NEXT_PUBLIC_SUPABASE_URL',
  process.env.NEXT_PUBLIC_SUPABASE_URL,
)

export const SUPABASE_ANON_KEY = zorunlu(
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)

/** Sadece sunucu tarafında çağrılır (webhook, cron). Tarayıcıya asla sızmaz. */
export function servisAnahtari(): string {
  return zorunlu('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY)
}

/**
 * Telegram bot jetonu. Operiqo kurar (KAPSAM Bölüm 7).
 * Yoksa bildirim katmanı sessizce devre dışı kalır; mesaj akışı bundan etkilenmez.
 * Chat kimliği burada DEĞİL, settings tablosunda: Fatih Bey bota /start yazınca
 * panelden yakalanıp yazılır, jeton gibi gizli bir şey değil.
 */
export function telegramJetonu(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || null
}

/** Sistem arızası bildirimi buraya gider (KAPSAM Bölüm 5: "Sistem sorunu → Operiqo"). */
export function operiqoChatId(): string | null {
  return process.env.TELEGRAM_OPERIQO_CHAT_ID?.trim() || null
}

/**
 * Cron rotasının paylaşılan sırrı. Vercel Cron `Authorization: Bearer <sır>`
 * yollar. Yoksa üretimde cron rotası kendini kapatır (bkz. api/cron/route.ts).
 */
export function cronSirri(): string | null {
  return process.env.CRON_SECRET?.trim() || null
}

/** Bildirimlerdeki "Panelde aç" bağlantısının kökü. */
export function panelAdresi(): string {
  const acik = process.env.NEXT_PUBLIC_PANEL_ADRES?.trim()
  if (acik) return acik.replace(/\/+$/, '')
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  if (vercel) return `https://${vercel}`
  return 'http://localhost:3000'
}
