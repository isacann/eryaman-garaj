// WhatsApp kanalı — Evolution API (Baileys tabanlı, kendi sunucumuzda).
//
// 14 Ağustos 2026'da Meta Cloud API yerine buna geçildi. Gerekçe: Cloud API'ye
// taşınan numara WhatsApp Business uygulamasından GERİ DÖNÜŞSÜZ düşüyor
// (Sözleşme Madde 7.3) ve Fatih Bey uygulamayı kullanmaya devam etmek istiyor.
// Meta'nın "Coexistence" çözümü Tech Provider statüsü istiyor, bize kapalı.
// Cloud API sürümü silinmedi, `whatsapp-cloud.ts`'te duruyor.
//
// ⚠ RİSK, FATİH BEY'E ANLATILDI VE KABUL EDİLDİ (13 Ağustos): Evolution resmî
// bir Meta ürünü değil. WhatsApp'ın kendi "bağlı cihaz" mekanizmasını kullanıyor
// ama gayri resmî araçlarda numara banı ihtimali resmî API'ye göre belirgin
// şekilde yüksek.
//
// ⚠ Bağlı cihaz oturumu telefon uzun süre kapalı/çevrimdışı kalırsa düşer;
// o zaman panelden QR yeniden taratılması gerekir.
//
// Evolution'da 24 saatlik müşteri hizmetleri penceresi ve şablon zorunluluğu
// YOKTUR — bunlar Meta Cloud API kuralıydı. Takip merdiveninin şablon basamağı
// (`settings.sablon_takip_aktif`) bu yüzden kapalı kalabilir.

import { supabaseServis } from '@/lib/supabase/sunucu'
import type { Json } from '@/lib/db/types'
import { KanalHatasi, type GelenMesaj, type GonderimSonucu, type Kanal } from './types'

function tabanAdres(): string {
  const u = process.env.EVOLUTION_API_URL
  if (!u) throw new KanalHatasi('whatsapp', 'EVOLUTION_API_URL tanımlı değil.')
  return u.replace(/\/+$/, '')
}

function apiAnahtari(): string {
  const k = process.env.EVOLUTION_API_KEY
  if (!k) throw new KanalHatasi('whatsapp', 'EVOLUTION_API_KEY tanımlı değil.')
  return k
}

function instanceAdi(): string {
  const i = process.env.EVOLUTION_INSTANCE
  if (!i) throw new KanalHatasi('whatsapp', 'EVOLUTION_INSTANCE tanımlı değil.')
  return i
}

/**
 * Konuşmanın karşı tarafının numarası.
 *
 * Kanal katmanı veritabanına YAZMAZ ama adresi okumak zorunda: Evolution'a
 * gönderirken konuşma kimliği değil telefon numarası gerekiyor.
 *
 * ⚠ Saklanan biçim Cloud API'deki `wa_id` ile aynı: ülke kodlu, işaretsiz
 * (905317227480). Evolution'ın beklediği biçim de bu, o yüzden mevcut
 * `contacts` kayıtları dönüşüm gerektirmeden çalışıyor.
 */
async function alicivaNumara(konusmaId: string): Promise<string> {
  const db = supabaseServis()
  const { data, error } = await db
    .from('conversations')
    .select('contacts(kanal_kimlik)')
    .eq('id', konusmaId)
    .single()

  if (error || !data) {
    throw new KanalHatasi('whatsapp', `konuşma bulunamadı: ${error?.message ?? konusmaId}`)
  }

  // Supabase gömülü ilişkiyi tekil ya da dizi olarak verebiliyor.
  const iliski = (data as { contacts: { kanal_kimlik: string } | { kanal_kimlik: string }[] })
    .contacts
  const kimlik = Array.isArray(iliski) ? iliski[0]?.kanal_kimlik : iliski?.kanal_kimlik

  if (!kimlik) throw new KanalHatasi('whatsapp', 'konuşmanın kişi kaydı yok.')
  return kimlik
}

async function evolutionaGonder(
  yol: string,
  govde: Record<string, unknown>,
): Promise<GonderimSonucu> {
  let cevap: Response
  try {
    cevap = await fetch(`${tabanAdres()}/${yol}/${instanceAdi()}`, {
      method: 'POST',
      headers: {
        apikey: apiAnahtari(),
        'content-type': 'application/json',
      },
      body: JSON.stringify(govde),
    })
  } catch (e) {
    return { basarili: false, hata: e instanceof Error ? e.message : 'ağ hatası' }
  }

  const ham = await cevap.text()
  if (!cevap.ok) {
    // Evolution hatayı gövdede açıklıyor; teşhis için olduğu gibi taşınıyor.
    // En sık görülen: instance bağlı değil (oturum düşmüş, QR gerekiyor).
    return { basarili: false, hata: `Evolution ${cevap.status}: ${ham.slice(0, 400)}` }
  }

  try {
    const veri = JSON.parse(ham) as { key?: { id?: string } }
    return { basarili: true, hariciId: veri.key?.id ?? null }
  } catch {
    return { basarili: true, hariciId: null }
  }
}

// ---- gelen yükün biçimi (yalnızca okuduğumuz alanlar) ----

type EvoMesajGovdesi = {
  conversation?: string
  extendedTextMessage?: { text?: string; contextInfo?: EvoBaglam }
  imageMessage?: { caption?: string; url?: string; contextInfo?: EvoBaglam }
  videoMessage?: { caption?: string; contextInfo?: EvoBaglam }
}

/** Click-to-WhatsApp reklamından gelindiyse reklamın bilgisi burada olur. */
type EvoBaglam = {
  externalAdReply?: {
    title?: string
    body?: string
    sourceId?: string
    sourceUrl?: string
  }
}

type EvoYuk = {
  event?: string
  instance?: string
  apikey?: string
  data?: {
    key?: { remoteJid?: string; fromMe?: boolean; id?: string }
    pushName?: string
    message?: EvoMesajGovdesi
    messageType?: string
    messageTimestamp?: number | string
  }
}

function metin(deger: unknown): string | null {
  return typeof deger === 'string' && deger.trim() !== '' ? deger.trim() : null
}

/** `905317227480@s.whatsapp.net` → `905317227480` */
function jidNumara(jid: string): string {
  return jid.split('@')[0] ?? jid
}

export const whatsappKanal: Kanal = {
  ad: 'whatsapp',

  async mesajGonder(konusmaId: string, metinIcerik: string): Promise<GonderimSonucu> {
    const numara = await alicivaNumara(konusmaId)
    // linkPreview kapalı: fiyat/randevu cevaplarında bağlantı önizlemesi
    // baloncuğu şişiriyor ve sahadaki üslupla uyuşmuyor.
    return evolutionaGonder('message/sendText', {
      number: numara,
      text: metinIcerik,
      linkPreview: false,
    })
  },

  async medyaGonder(
    konusmaId: string,
    medyaUrl: string,
    altYazi?: string | null,
  ): Promise<GonderimSonucu> {
    // Evolution görseli `media` adresinden kendisi çeker; adres herkese açık
    // https olmalı (public/fiyat-listesi/ altındakiler öyle).
    const numara = await alicivaNumara(konusmaId)
    return evolutionaGonder('message/sendMedia', {
      number: numara,
      mediatype: 'image',
      media: medyaUrl,
      ...(altYazi ? { caption: altYazi } : {}),
    })
  },

  async webhookDogrula(): Promise<boolean> {
    // Doğrulama rotanın kendisinde yapılıyor (api/webhooks/whatsapp/route.ts):
    // Evolution'da Meta'daki gibi HMAC imzası yok, yükteki `apikey` alanı ve
    // adresteki gizli parametre karşılaştırılıyor. Ham gövde orada, burada değil.
    return true
  },

  gelenMesajiCoz(payload: unknown): GelenMesaj[] {
    if (typeof payload !== 'object' || payload === null) return []
    const yuk = payload as EvoYuk

    // Evolution 40'tan fazla olay tipi yolluyor (bağlantı durumu, okundu
    // bilgisi, kişi güncellemesi...). Bizi ilgilendiren tek olay yeni mesaj.
    // Olay adı sürüme göre `MESSAGES_UPSERT` ya da `messages.upsert` gelebiliyor.
    const olay = (yuk.event ?? '').toLowerCase().replace(/[._-]/g, '')
    if (olay !== 'messagesupsert') return []

    const veri = yuk.data
    const jid = metin(veri?.key?.remoteJid)
    if (!veri || !jid) return []

    // ⚠ EN KRİTİK FİLTRE: kendi gönderdiğimiz mesaj da webhook'a geri düşüyor.
    // Elenmezse bot kendi cevabını müşteri mesajı sanıp kendine cevap yazar ve
    // sonsuz döngüye girer. Fatih Bey telefondan elle yazdığında da fromMe=true
    // gelir — o da müşteri mesajı değildir.
    if (veri.key?.fromMe) return []

    // Grup mesajları (@g.us) ve durum güncellemeleri (status@broadcast) müşteri
    // yazışması değil. Bot bunlara asla cevap yazmamalı.
    if (!jid.endsWith('@s.whatsapp.net')) return []

    const govde = veri.message
    if (!govde) return []

    const icerik =
      metin(govde.conversation) ??
      metin(govde.extendedTextMessage?.text) ??
      metin(govde.imageMessage?.caption) ??
      metin(govde.videoMessage?.caption)

    // Alt yazısız görsel de mesajdır (müşteri aracının fotoğrafını atıyor):
    // metin yoksa bile kayıt açılır, fotoğraf analizi bağlanınca burası genişler.
    const gorselMi = Boolean(govde.imageMessage)
    if (!icerik && !gorselMi) return []

    const zamanSaniye = Number(veri.messageTimestamp)
    const zaman = Number.isFinite(zamanSaniye)
      ? new Date(zamanSaniye * 1000).toISOString()
      : new Date().toISOString()

    // Click-to-WhatsApp reklamı. ⚠ Evolution bu alanı her sürümde güvenilir
    // biçimde taşımıyor (üst akışta bilinen kayıp var); geldiğinde kullanılır,
    // gelmediğinde reklam bağlamı olmadan devam edilir — akış bozulmaz.
    const reklamBilgi =
      govde.extendedTextMessage?.contextInfo?.externalAdReply ??
      govde.imageMessage?.contextInfo?.externalAdReply ??
      govde.videoMessage?.contextInfo?.externalAdReply
    const reklamBaslik = metin(reklamBilgi?.title)

    return [
      {
        kanal: 'whatsapp',
        kanalKimlik: jidNumara(jid),
        ad: metin(veri.pushName),
        metin: icerik,
        medyaUrl: null,
        hariciId: metin(veri.key?.id),
        reklam: reklamBaslik
          ? {
              adId: metin(reklamBilgi?.sourceId),
              baslik: reklamBaslik,
              metin: metin(reklamBilgi?.body),
            }
          : null,
        zaman,
        ham: payload as Json,
      },
    ]
  },
}
