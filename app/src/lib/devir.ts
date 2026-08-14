// 15 dakika kuralı. KAPSAM karar 4:
// "Devir istendiğinde ekip 15 dakika yazmazsa bot 'ekibimiz birazdan dönecek'
//  der, müşteri soğumaz."
//
// Sayaç, botun devir bayrağını kaldırdığı andır (conversations.meta.devir_bayrak_at,
// bkz. src/lib/bot.ts). Ekip panelden yazdığı anda sayaç silinir (eylemler.ts),
// yani bu hatırlatma yalnızca gerçekten kimsenin dönmediği durumda gider.
//
// Hatırlatma konuşma başına BİR kez gönderilir: müşteriyi oyalayan tekrar eden
// mesaj, hiç mesaj atmamaktan daha kötüdür.

import 'server-only'

import { gidenMesajGonder } from '@/lib/mesajlar'
import { mesaiDisiMi } from '@/lib/motor/saat'
import { supabaseServis } from '@/lib/supabase/sunucu'
import type { Json } from '@/lib/db/types'

export const DEVIR_BEKLEME_DK = 15

/** KAPSAM'daki cümlenin birebir karşılığı. */
export const HATIRLATMA_METNI = 'Ekibimiz birazdan size dönüş yapacak.'

/**
 * Devir bayrağı kalkmış ama ekip hâlâ yazmamış yazışmalara hatırlatma gönderir.
 * Cron'un işi.
 */
export async function devirHatirlatmalariniIslet(
  an: Date = new Date(),
): Promise<{ gonderildi: number }> {
  // Mesai dışında müşteriye mesaj gitmez (KAPSAM karar 5). Sabah cron tekrar
  // bakacak; 15 dakikalık söz gece için verilmiş sayılmaz.
  if (mesaiDisiMi(an)) return { gonderildi: 0 }

  const db = supabaseServis()
  const esik = new Date(an.getTime() - DEVIR_BEKLEME_DK * 60_000).toISOString()

  // Bayrak alanı meta içinde; sorguyu dar tutmak için sadece bot durumundaki
  // yazışmalara bakıyoruz. Hacim küçük (aynı anda onlarca değil, birkaç tane).
  const { data: adaylar } = await db
    .from('conversations')
    .select('id, meta, durum')
    .eq('durum', 'bot')
    .not('meta->>devir_bayrak_at', 'is', null)
    .lte('meta->>devir_bayrak_at', esik)
    .limit(50)

  let gonderildi = 0

  for (const konusma of adaylar ?? []) {
    const meta = (konusma.meta ?? {}) as Record<string, unknown>

    // Zaten hatırlatıldıysa bir daha yazma.
    if (meta.devir_hatirlatma_at) continue

    const bayrak = typeof meta.devir_bayrak_at === 'string' ? meta.devir_bayrak_at : null
    if (!bayrak) continue
    if (an.getTime() - new Date(bayrak).getTime() < DEVIR_BEKLEME_DK * 60_000) continue

    // Ekip bayraktan sonra mesaj yazmışsa kural zaten karşılanmış.
    const { data: ekipMesaji } = await db
      .from('messages')
      .select('id')
      .eq('conversation_id', konusma.id)
      .eq('gonderen', 'ekip')
      .gte('created_at', bayrak)
      .limit(1)
      .maybeSingle()

    if (ekipMesaji) {
      const kalan = { ...meta }
      delete kalan.devir_bayrak_at
      await db.from('conversations').update({ meta: kalan as Json }).eq('id', konusma.id)
      continue
    }

    try {
      await gidenMesajGonder(konusma.id, HATIRLATMA_METNI, 'bot', {
        devir_hatirlatmasi: true,
      } as Json)

      await db
        .from('conversations')
        .update({
          meta: { ...meta, devir_hatirlatma_at: an.toISOString() } as Json,
        })
        .eq('id', konusma.id)

      await db.from('activity_log').insert({
        aktor: 'bot',
        tip: 'devir_hatirlatmasi',
        payload: { konusma_id: konusma.id } as Json,
      })

      gonderildi += 1
    } catch (e) {
      console.error('[devir] hatırlatma gönderilemedi:', e)
    }
  }

  return { gonderildi }
}
