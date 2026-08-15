// Mesaj servis katmanı. Kişi + konuşma + mesaj kayıtlarının tek sahibi burası.
// Kanallar sadece taşıma yapar, veritabanına buradan yazılır.
//
// NOT: Bu dosya yanıt ÜRETMEZ, sadece kaydeder ve gönderir. Cevabı üretip buraya
// veren katman src/lib/bot.ts.

import 'server-only'

import { kanalAl, type GelenMesaj } from '@/lib/channels'
import type { GidenEkipMesaji } from '@/lib/channels/types'
import { supabaseServis } from '@/lib/supabase/sunucu'
import { RANDEVU_HATIRLATMA, type Json, type MesajGonderen } from '@/lib/db/types'

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

/**
 * Ekip WhatsApp uygulamasından elle cevap yazdıysa yazışmayı devre alır ve
 * botu susturur.
 *
 * ⚠ 15 Ağustos (Fatih Bey): "Biz mesaja cevap verdikten sonra bot devreden
 * çıksın." Panelden yazıldığında bu zaten oluyordu (sohbet eylemleri devir
 * damgası atıyor), ama Fatih Bey çoğunlukla telefondan yazıyor. O mesaj
 * webhook'a `fromMe: true` düşüyor, sonsuz döngü koruması onu atıyordu ve
 * sistem devralmayı hiç öğrenemiyordu — bot yazmaya devam ediyordu.
 *
 * ⛔ AYIRT ETME. Botun kendi gönderdiği mesaj da `fromMe: true` gelir. Onu
 * ekip mesajı sanmak felaket olurdu: bot her cevabından sonra kendini devre
 * alır ve bir daha hiç yazmazdı. Ayrım mesaj kimliğinden yapılır — bot
 * gönderirken Evolution'ın döndürdüğü `key.id`'yi `harici_id` olarak
 * kaydediyor. Kimlik tabloda varsa mesaj bizim sistemimizden çıkmıştır.
 *
 * Şüphede olduğu her yerde HİÇBİR ŞEY YAPMAZ: kimlik yoksa, kişi/konuşma
 * bulunamazsa, yazışma zaten devirdeyse sessizce döner.
 */
export async function ekipElleYazdiginiIsle(
  giden: GidenEkipMesaji,
): Promise<{ devralindi: boolean; sebep: string }> {
  const db = supabaseServis()

  if (!giden.hariciId) return { devralindi: false, sebep: 'kimlik yok' }

  // 1. Bu mesajı biz mi gönderdik? Kimlik tabloda varsa evet — dokunma.
  const { data: bizimMesaj } = await db
    .from('messages')
    .select('id')
    .eq('harici_id', giden.hariciId)
    .limit(1)
    .maybeSingle()
  if (bizimMesaj) return { devralindi: false, sebep: 'sistemden gönderildi' }

  // 2. Hangi yazışma. Kişi yoksa konuşma da yoktur; ekip yeni bir sohbet
  //    başlatmışsa bot zaten o yazışmayı bilmiyor, devralınacak bir şey yok.
  const { data: kisi } = await db
    .from('contacts')
    .select('id')
    .eq('kanal', giden.kanal)
    .eq('kanal_kimlik', giden.kanalKimlik)
    .maybeSingle()
  if (!kisi) return { devralindi: false, sebep: 'kişi bulunamadı' }

  const { data: konusma } = await db
    .from('conversations')
    .select('id, durum')
    .eq('contact_id', kisi.id)
    .order('son_mesaj_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!konusma) return { devralindi: false, sebep: 'konuşma bulunamadı' }

  // 3. Mesajı yazışmaya işle ki panelde de görünsün — ekip telefondan yazdığını
  //    panelde göremezse iki ekran birbirini tutmaz.
  await db.from('messages').insert({
    conversation_id: konusma.id,
    yon: 'giden',
    gonderen: 'ekip',
    metin: giden.metin,
    harici_id: giden.hariciId,
    meta: { kaynak: 'telefondan-elle' } as Json,
  })

  if (konusma.durum === 'devir') return { devralindi: false, sebep: 'zaten devirde' }
  if (konusma.durum === 'kapali') return { devralindi: false, sebep: 'yazışma kapalı' }

  // 4. Devir: bot susar.
  await db
    .from('conversations')
    .update({ durum: 'devir', devir_at: giden.zaman })
    .eq('id', konusma.id)

  // Bekleyen takip merdiveni iptal edilir: ekip devraldıysa bot "listemize
  // bakabildiniz mi" diye araya girmemeli. Randevu hatırlatması hariç — o,
  // ekip devralsa bile geçerli kalır (bkz. lib/takip.ts).
  //
  // ⚠ takipleriIptalEt burada ÇAĞRILMIYOR: takip.ts bu dosyadan
  // gidenMesajGonder alıyor, çağırmak döngüsel bağımlılık kurardı.
  await db
    .from('followups')
    .update({ durum: 'iptal', meta: { sebep: 'ekip-telefondan-yazdi' } as Json })
    .eq('conversation_id', konusma.id)
    .eq('durum', 'beklemede')
    .neq('basamak', RANDEVU_HATIRLATMA)

  await db.from('activity_log').insert({
    aktor: 'ekip',
    tip: 'devir',
    payload: { konusma_id: konusma.id, kaynak: 'telefondan-elle' } as Json,
  })

  return { devralindi: true, sebep: 'ekip telefondan yazdı' }
}
