// Sahte kanal. Meta erişimi gelmeden sistemi uçtan uca çalıştırmak için.
//
// Gelen taraf: /api/mock/gelen route'u bu kanalın gelenMesajiCoz'unu kullanır,
// mesaj gerçek tablolara yazılır ve panelde görünür.
// Giden taraf: dışarı bir şey gitmez, gönderilen metin konsola ve activity_log'a düşer.
//
// Üretimde bu kanal kullanılmaz; sadece geliştirme ve test içindir.

import { supabaseServis } from '@/lib/supabase/sunucu'
import type { Json } from '@/lib/db/types'
import type { GelenMesaj, GonderimSonucu, Kanal } from './types'

type MockYuk = {
  kimlik?: unknown
  ad?: unknown
  metin?: unknown
  medya_url?: unknown
  harici_id?: unknown
  zaman?: unknown
  reklam_id?: unknown
  reklam_baslik?: unknown
}

function metneCevir(deger: unknown): string | null {
  return typeof deger === 'string' && deger.trim() !== '' ? deger.trim() : null
}

export const mockKanal: Kanal = {
  ad: 'mock',

  async mesajGonder(konusmaId: string, metin: string): Promise<GonderimSonucu> {
    const hariciId = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    console.log(`[mock] gönderildi → konuşma ${konusmaId}: ${metin}`)

    const db = supabaseServis()
    const { error } = await db.from('activity_log').insert({
      aktor: 'sistem',
      tip: 'mock_gonderim',
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
    const hariciId = `mock-medya-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    console.log(`[mock] görsel gönderildi → konuşma ${konusmaId}: ${medyaUrl}`)

    const db = supabaseServis()
    const { error } = await db.from('activity_log').insert({
      aktor: 'sistem',
      tip: 'mock_medya_gonderim',
      payload: { konusma_id: konusmaId, medya_url: medyaUrl, alt_yazi: altYazi ?? null } as Json,
    })
    if (error) return { basarili: false, hata: error.message }

    return { basarili: true, hariciId }
  },

  async webhookDogrula(): Promise<boolean> {
    // Sahte kanalın imzası yok. Route'u sadece geliştirmede açık.
    return process.env.NODE_ENV !== 'production'
  },

  gelenMesajiCoz(payload: unknown): GelenMesaj[] {
    if (typeof payload !== 'object' || payload === null) return []
    const yuk = payload as MockYuk

    const kanalKimlik = metneCevir(yuk.kimlik)
    if (!kanalKimlik) return []

    const metin = metneCevir(yuk.metin)
    const medyaUrl = metneCevir(yuk.medya_url)
    if (!metin && !medyaUrl) return []

    const zaman = metneCevir(yuk.zaman)

    return [
      {
        kanal: 'mock',
        kanalKimlik,
        ad: metneCevir(yuk.ad),
        metin,
        medyaUrl,
        hariciId: metneCevir(yuk.harici_id),
        // Sahte kanalda reklam simülasyonu: {"reklam_baslik": "Cam filmi fiyat al"}
        reklam: metneCevir(yuk.reklam_baslik)
          ? { adId: metneCevir(yuk.reklam_id), baslik: metneCevir(yuk.reklam_baslik) }
          : null,
        zaman: zaman ?? new Date().toISOString(),
        ham: payload as Json,
      },
    ]
  },
}
