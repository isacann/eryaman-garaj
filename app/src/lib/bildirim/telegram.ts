// Telegram taşıma katmanı. Sadece "mesajı Telegram'a ver" işini bilir.
// Hangi olayda kime bildirim gideceği bir üst katmanın işi (bkz. index.ts).
//
// KAPSAM Bölüm 7: bot'u Operiqo kurar, Fatih Bey /start yazar. Jeton ortam
// değişkeninde (gizli), chat kimliği settings tablosunda (gizli değil, panelden
// yakalanır). Bu ayrım bilinçli: jeton depoya/panele hiçbir koşulda düşmesin.
//
// KURAL: Bildirim gönderimi hiçbir zaman mesaj akışını patlatmaz. Telegram
// çökse de müşteriye cevap gitmeye devam eder; hata sadece loglanır.

import 'server-only'

import { panelAdresi, telegramJetonu } from '@/lib/env'

const API_KOK = 'https://api.telegram.org'
/** Telegram yavaşsa bot cevabını bekletmeyelim. */
const ZAMAN_ASIMI_MS = 8_000

export type TelegramSonuc =
  | { basarili: true; mesajId: number }
  | { basarili: false; hata: string }

/** Telegram HTML parse_mode'unda kaçırılması zorunlu üç karakter. */
export function htmlKacir(metin: string): string {
  return metin.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export type Buton = { metin: string; url: string }

async function telegramCagir(
  yontem: string,
  govde: Record<string, unknown>,
): Promise<{ tamam: true; sonuc: unknown } | { tamam: false; hata: string }> {
  const jeton = telegramJetonu()
  if (!jeton) return { tamam: false, hata: 'TELEGRAM_BOT_TOKEN tanımlı değil' }

  const kontrol = AbortSignal.timeout(ZAMAN_ASIMI_MS)
  try {
    const cevap = await fetch(`${API_KOK}/bot${jeton}/${yontem}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(govde),
      signal: kontrol,
      cache: 'no-store',
    })

    const yuk = (await cevap.json()) as { ok?: boolean; result?: unknown; description?: string }
    if (!cevap.ok || !yuk.ok) {
      return { tamam: false, hata: yuk.description ?? `HTTP ${cevap.status}` }
    }
    return { tamam: true, sonuc: yuk.result }
  } catch (e) {
    const sebep = e instanceof Error ? e.message : 'bilinmeyen hata'
    return { tamam: false, hata: sebep }
  }
}

/**
 * Tek bir Telegram mesajı gönderir.
 * `metin` HTML kabul eder; değişken içerik htmlKacir()'den geçirilmiş olmalı.
 */
export async function telegramGonder(
  chatId: string,
  metin: string,
  butonlar: Buton[] = [],
): Promise<TelegramSonuc> {
  const govde: Record<string, unknown> = {
    chat_id: chatId,
    text: metin,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  }

  // Telegram yalnızca https bağlantılı butona izin verir; localhost'ta
  // (geliştirme) buton eklenmezse mesajın kendisi yine de gider.
  const gecerli = butonlar.filter((b) => b.url.startsWith('https://'))
  if (gecerli.length > 0) {
    govde.reply_markup = {
      inline_keyboard: [gecerli.map((b) => ({ text: b.metin, url: b.url }))],
    }
  }

  const cevap = await telegramCagir('sendMessage', govde)
  if (!cevap.tamam) return { basarili: false, hata: cevap.hata }

  const sonuc = cevap.sonuc as { message_id?: number } | null
  return { basarili: true, mesajId: sonuc?.message_id ?? 0 }
}

/** Konuşmanın panel bağlantısı. Bildirimlerdeki "Panelde aç" butonu bunu kullanır. */
export function konusmaBaglantisi(konusmaId: string): string {
  return `${panelAdresi()}/sohbet/${konusmaId}`
}

/**
 * Bota en son kim yazdıysa onun chat kimliğini döndürür.
 *
 * Kurulum akışı (KAPSAM Bölüm 7): Fatih Bey bota /start yazar, panelden
 * "Bağlantıyı yakala" denir, kimlik settings'e yazılır. Kimliği elle sormaktan
 * çok daha az hata yapılan yol.
 */
export async function sonChatIdYakala(): Promise<
  { basarili: true; chatId: string; ad: string | null } | { basarili: false; hata: string }
> {
  const cevap = await telegramCagir('getUpdates', { limit: 20, timeout: 0 })
  if (!cevap.tamam) return { basarili: false, hata: cevap.hata }

  type Guncelleme = {
    message?: {
      chat?: { id?: number; first_name?: string; title?: string; username?: string }
    }
  }
  const guncellemeler = (cevap.sonuc as Guncelleme[] | null) ?? []

  for (let i = guncellemeler.length - 1; i >= 0; i -= 1) {
    const sohbet = guncellemeler[i]?.message?.chat
    if (sohbet?.id === undefined) continue
    return {
      basarili: true,
      chatId: String(sohbet.id),
      ad: sohbet.first_name ?? sohbet.title ?? sohbet.username ?? null,
    }
  }

  return {
    basarili: false,
    hata: 'Bota henüz kimse yazmamış. Telegram\'da bota /start yazıp tekrar deneyin.',
  }
}
