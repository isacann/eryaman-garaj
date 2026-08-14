// Mesaj servis katmanı. Kişi + konuşma + mesaj kayıtlarının tek sahibi burası.
// Kanallar sadece taşıma yapar, veritabanına buradan yazılır.
//
// NOT: Bu dosya yanıt ÜRETMEZ, sadece kaydeder ve gönderir. Cevabı üretip buraya
// veren katman src/lib/bot.ts.

import 'server-only'

import { kanalAl, type GelenMesaj } from '@/lib/channels'
import { supabaseServis } from '@/lib/supabase/sunucu'
import type { Json, MesajGonderen } from '@/lib/db/types'

/** Meta müşteri hizmetleri penceresi: müşterinin son mesajından sonra 24 saat. */
export const PENCERE_SAAT = 24

export type IslemSonucu = {
  konusmaId: string
  mesajId: string | null
  /** Aynı harici kimlikli mesaj daha önce işlendiyse true; webhook tekrarı. */
  tekrar: boolean
}

/** Gelen bir mesajı kaydeder: kişiyi bulur/açar, konuşmayı bulur/açar, mesajı yazar. */
export async function gelenMesajiKaydet(gelen: GelenMesaj): Promise<IslemSonucu> {
  const db = supabaseServis()

  // 1. Kişi
  const { data: mevcutKisi, error: kisiHata } = await db
    .from('contacts')
    .select('id, ad')
    .eq('kanal', gelen.kanal)
    .eq('kanal_kimlik', gelen.kanalKimlik)
    .maybeSingle()
  if (kisiHata) throw new Error(`kişi okunamadı: ${kisiHata.message}`)

  let contactId: string
  if (mevcutKisi) {
    contactId = mevcutKisi.id
    if (gelen.ad && !mevcutKisi.ad) {
      await db.from('contacts').update({ ad: gelen.ad }).eq('id', contactId)
    }
  } else {
    const { data, error } = await db
      .from('contacts')
      .insert({
        kanal: gelen.kanal,
        kanal_kimlik: gelen.kanalKimlik,
        ad: gelen.ad,
        telefon: gelen.kanal === 'whatsapp' ? gelen.kanalKimlik : null,
        instagram_kullanici: gelen.kanal === 'instagram' ? gelen.ad : null,
      })
      .select('id')
      .single()
    if (error || !data) throw new Error(`kişi açılamadı: ${error?.message}`)
    contactId = data.id
  }

  // 2. Konuşma (kapalı olmayan en güncel olan, yoksa yeni)
  const { data: mevcutKonusma, error: konusmaHata } = await db
    .from('conversations')
    .select('id')
    .eq('contact_id', contactId)
    .neq('durum', 'kapali')
    .order('son_mesaj_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()
  if (konusmaHata) throw new Error(`konuşma okunamadı: ${konusmaHata.message}`)

  let konusmaId: string
  if (mevcutKonusma) {
    konusmaId = mevcutKonusma.id
  } else {
    const { data, error } = await db
      .from('conversations')
      .insert({
        contact_id: contactId,
        kanal: gelen.kanal,
        durum: 'bot',
        // Reklamdan gelen müşteri: hangi reklama tıkladığı konuşmanın bağlamı
        // olur, bot açılışı ona göre yapar (Fatih Bey'in Instagram sorusu).
        ...(gelen.reklam?.baslik
          ? { meta: { reklam: gelen.reklam } as Json }
          : {}),
      })
      .select('id')
      .single()
    if (error || !data) throw new Error(`konuşma açılamadı: ${error?.message}`)
    konusmaId = data.id
  }

  // 3. Mesaj. Aynı harici kimlik daha önce yazıldıysa webhook tekrarıdır, atlanır.
  if (gelen.hariciId) {
    const { data: varMi } = await db
      .from('messages')
      .select('id')
      .eq('harici_id', gelen.hariciId)
      .maybeSingle()
    if (varMi) return { konusmaId, mesajId: varMi.id, tekrar: true }
  }

  const { data: mesaj, error: mesajHata } = await db
    .from('messages')
    .insert({
      conversation_id: konusmaId,
      yon: 'gelen',
      gonderen: 'musteri',
      metin: gelen.metin,
      medya_url: gelen.medyaUrl,
      harici_id: gelen.hariciId,
      meta: { ham: gelen.ham } as Json,
      created_at: gelen.zaman,
    })
    .select('id')
    .single()
  if (mesajHata || !mesaj) throw new Error(`mesaj yazılamadı: ${mesajHata?.message}`)

  // 4. Konuşma zaman damgaları + 24 saatlik pencere
  const pencereBitis = new Date(
    new Date(gelen.zaman).getTime() + PENCERE_SAAT * 3600_000,
  ).toISOString()
  await db
    .from('conversations')
    .update({ son_mesaj_at: gelen.zaman, pencere_bitis_at: pencereBitis })
    .eq('id', konusmaId)

  await db.from('activity_log').insert({
    aktor: 'webhook',
    tip: 'mesaj_geldi',
    payload: { kanal: gelen.kanal, konusma_id: konusmaId, mesaj_id: mesaj.id } as Json,
  })

  return { konusmaId, mesajId: mesaj.id, tekrar: false }
}

/**
 * Giden mesaj: önce kanaldan yollanır, sonra kaydedilir.
 * `meta` verilirse mesaj satırına yazılır; bot cevaplarında yapılandırılmış
 * çıktı burada saklanır, panelde ve test konsolunda okunur.
 */
export async function gidenMedyaGonder(
  konusmaId: string,
  medyaUrl: string,
  altYazi: string | null,
  gonderen: MesajGonderen,
): Promise<IslemSonucu> {
  const db = supabaseServis()

  const { data: konusma, error } = await db
    .from('conversations')
    .select('id, kanal')
    .eq('id', konusmaId)
    .single()
  if (error || !konusma) throw new Error(`konuşma bulunamadı: ${error?.message}`)

  const sonuc = await kanalAl(konusma.kanal).medyaGonder(konusmaId, medyaUrl, altYazi)
  if (!sonuc.basarili) throw new Error(`görsel gönderilemedi: ${sonuc.hata}`)

  const { data: mesaj, error: mesajHata } = await db
    .from('messages')
    .insert({
      conversation_id: konusmaId,
      yon: 'giden',
      gonderen,
      metin: altYazi,
      medya_url: medyaUrl,
      harici_id: sonuc.hariciId,
    })
    .select('id')
    .single()
  if (mesajHata || !mesaj) throw new Error(`mesaj yazılamadı: ${mesajHata?.message}`)

  await db.from('activity_log').insert({
    aktor: gonderen === 'ekip' ? 'ekip' : 'bot',
    tip: 'medya_gonderildi',
    payload: { konusma_id: konusmaId, mesaj_id: mesaj.id, medya_url: medyaUrl } as Json,
  })

  return { konusmaId, mesajId: mesaj.id, tekrar: false }
}

export async function gidenMesajGonder(
  konusmaId: string,
  metin: string,
  gonderen: MesajGonderen,
  meta?: Json,
): Promise<IslemSonucu> {
  const db = supabaseServis()

  const { data: konusma, error } = await db
    .from('conversations')
    .select('id, kanal')
    .eq('id', konusmaId)
    .single()
  if (error || !konusma) throw new Error(`konuşma bulunamadı: ${error?.message}`)

  const sonuc = await kanalAl(konusma.kanal).mesajGonder(konusmaId, metin)
  if (!sonuc.basarili) throw new Error(`gönderilemedi: ${sonuc.hata}`)

  const { data: mesaj, error: mesajHata } = await db
    .from('messages')
    .insert({
      conversation_id: konusmaId,
      yon: 'giden',
      gonderen,
      metin,
      harici_id: sonuc.hariciId,
      ...(meta === undefined ? {} : { meta }),
    })
    .select('id')
    .single()
  if (mesajHata || !mesaj) throw new Error(`mesaj yazılamadı: ${mesajHata?.message}`)

  await db.from('activity_log').insert({
    aktor: gonderen === 'ekip' ? 'ekip' : 'bot',
    tip: 'mesaj_gonderildi',
    payload: { konusma_id: konusmaId, mesaj_id: mesaj.id } as Json,
  })

  return { konusmaId, mesajId: mesaj.id, tekrar: false }
}
