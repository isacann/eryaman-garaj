// Test kanalı. Paneldeki test konsolunun (/test) taşıma katmanı.
//
// Fatih Bey konsolda müşteri gibi yazar, bot cevaplar. Kayıtlar gerçek tablolara
// düşer ama kanal 'test' olduğu için gerçek yazışmalarla karışmaz ve dışarı
// hiçbir mesaj gitmez: giden taraf sadece activity_log'a iz bırakır, cevabı
// müşteriye değil konsol ekranına gösteririz.
//
// mock kanalıyla farkı: mock betikle (curl / npm run mock:gonder) beslenir,
// test panelin içindeki konsoldan gelir. İkisi de üretimde kullanılmaz.

import { supabaseServis } from '@/lib/supabase/sunucu'
import type { Json } from '@/lib/db/types'
import type { GelenMesaj, GonderimSonucu, Kanal } from './types'

export const TEST_KIMLIK_ONEK = 'konsol-'

export const testKanal: Kanal = {
  ad: 'test',

  async mesajGonder(konusmaId: string, metin: string): Promise<GonderimSonucu> {
    const hariciId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    const db = supabaseServis()
    const { error } = await db.from('activity_log').insert({
      aktor: 'sistem',
      tip: 'test_gonderim',
      payload: { konusma_id: konusmaId, metin, harici_id: hariciId } as Json,
    })
    if (error) return { basarili: false, hata: error.message }

    return { basarili: true, hariciId }
  },

  async medyaGonder(
    konusmaId: string,
    medyaUrl: string,
    altYazi?: string | null,
  ): Promise<GonderimSonucu> {
    const hariciId = `test-medya-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    const db = supabaseServis()
    const { error } = await db.from('activity_log').insert({
      aktor: 'sistem',
      tip: 'test_medya_gonderim',
      payload: { konusma_id: konusmaId, medya_url: medyaUrl, alt_yazi: altYazi ?? null } as Json,
    })
    if (error) return { basarili: false, hata: error.message }

    return { basarili: true, hariciId }
  },

  async webhookDogrula(): Promise<boolean> {
    // Test kanalının webhook'u yok. Konsol, oturumlu sunucu eylemiyle çalışır.
    return false
  },

  gelenMesajiCoz(): GelenMesaj[] {
    return []
  },
}
