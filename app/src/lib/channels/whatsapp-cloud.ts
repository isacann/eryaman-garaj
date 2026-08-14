// ⚠⚠ ŞU AN KULLANILMIYOR — Meta WhatsApp Cloud API kanalı.
//
// 14 Ağustos 2026'da Evolution API'ye geçildi (`whatsapp.ts`). Sebep: numarayı
// Cloud API'ye taşımak WhatsApp Business uygulamasından geri dönüşsüz düşürüyor
// (Sözleşme Madde 7.3) ve Fatih Bey uygulamayı kullanmaya devam etmek istiyor.
// Coexistence (ikisi bir arada) Meta'da Tech Provider statüsü gerektiriyor.
//
// SİLİNMEDİ çünkü dönüş ihtimali gerçek: Instagram zaten Meta'da duruyor ve
// işletme doğrulaması tamamlanınca WhatsApp da resmî API'ye alınabilir. Dönüş
// için `index.ts`'te whatsappKanal yerine buradaki export bağlanır, gereken
// ortam değişkenleri geri konur (WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID).
//
// ---- Aşağısı 13 Ağustos'ta çalışır durumdaydı, o günkü notlar ----
//
// Test numarası: +1 (555) 673-1634.
// İşletme numarası (0531 734 26 59) HENÜZ TAŞINMADI — Madde 7.3 gereği taşıma
// geri dönüşsüz, Fatih Bey onayından sonra yapılacak.
//
// APP REVIEW GEREKMİYOR ve İŞLETME DOĞRULAMASI DA GEREKMİYOR (ölçüldü):
// app Development modundayken gerçek bir telefondan gelen mesaj metniyle
// birlikte webhook'a düştü. Doğrulama yalnızca daha yüksek gönderim
// kademelerini ve mavi tiki açıyor; doğrulanmamış işletme 24 saatte 250 farklı
// müşteriye kendi başlattığı konuşmayı yollayabiliyor — Eryaman günde ~30.
// (Instagram tarafı farklı: orada Live mode, dolayısıyla doğrulama şart.)
//
// Bilinmesi gereken Meta gerçekleri (KAPSAM Bölüm 6):
// - 24 saatlik müşteri hizmetleri penceresi. Pencere kapandıktan sonra sadece
//   Meta'nın onayladığı şablon gider ve ücretlidir.
// - Numara Cloud API'ye taşınınca WhatsApp Business uygulamasından düşer.

import { supabaseServis } from '@/lib/supabase/sunucu'
import type { Json } from '@/lib/db/types'
import { KanalHatasi, type GelenMesaj, type GonderimSonucu, type Kanal } from './types'

const SURUM = 'v25.0'
const TABAN = `https://graph.facebook.com/${SURUM}`

function jeton(): string {
  const t = process.env.WHATSAPP_TOKEN
  if (!t) throw new KanalHatasi('whatsapp', 'WHATSAPP_TOKEN tanımlı değil.')
  return t
}

function numaraKimligi(): string {
  const id = process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!id) throw new KanalHatasi('whatsapp', 'WHATSAPP_PHONE_NUMBER_ID tanımlı değil.')
  return id
}

/**
 * Konuşmanın karşı tarafının wa_id'si.
 * Kanal katmanı veritabanına yazmaz ama ADRESİ okumak zorunda: Meta'ya
 * gönderirken konuşma kimliği değil telefon numarası gerekiyor.
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

async function grafaGonder(govde: Record<string, unknown>): Promise<GonderimSonucu> {
  let cevap: Response
  try {
    cevap = await fetch(`${TABAN}/${numaraKimligi()}/messages`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${jeton()}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ messaging_product: 'whatsapp', ...govde }),
    })
  } catch (e) {
    return { basarili: false, hata: e instanceof Error ? e.message : 'ağ hatası' }
  }

  const ham = await cevap.text()
  if (!cevap.ok) {
    // Meta hatayı gövdede açıklıyor; teşhis için olduğu gibi taşınıyor.
    return { basarili: false, hata: `Meta ${cevap.status}: ${ham.slice(0, 400)}` }
  }

  try {
    const veri = JSON.parse(ham) as { messages?: { id?: string }[] }
    return { basarili: true, hariciId: veri.messages?.[0]?.id ?? null }
  } catch {
    return { basarili: true, hariciId: null }
  }
}

// ---- gelen yükün biçimi (yalnızca okuduğumuz alanlar) ----

type WaYuk = {
  object?: string
  entry?: {
    changes?: {
      field?: string
      value?: {
        contacts?: { wa_id?: string; profile?: { name?: string } }[]
        messages?: {
          id?: string
          from?: string
          timestamp?: string
          type?: string
          text?: { body?: string }
          image?: { id?: string; caption?: string }
          referral?: {
            source_id?: string
            headline?: string
            body?: string
          }
        }[]
      }
    }[]
  }[]
}

function metin(deger: unknown): string | null {
  return typeof deger === 'string' && deger.trim() !== '' ? deger.trim() : null
}

export const whatsappCloudKanal: Kanal = {
  ad: 'whatsapp',

  async mesajGonder(konusmaId: string, metinIcerik: string): Promise<GonderimSonucu> {
    // ⚠ 24 saatlik pencere kapalıysa Meta bunu reddeder; o durumda onaylı şablon
    // gerekir. Şablon gönderimi takip merdiveninin işi (lib/takip.ts), burada değil.
    const numara = await alicivaNumara(konusmaId)
    return grafaGonder({
      to: numara,
      type: 'text',
      text: { preview_url: false, body: metinIcerik },
    })
  },

  async medyaGonder(
    konusmaId: string,
    medyaUrl: string,
    altYazi?: string | null,
  ): Promise<GonderimSonucu> {
    // Meta görseli `link` adresinden kendi sunucusuna çeker; adres herkese açık
    // https olmalı (public/fiyat-listesi/ altındakiler öyle).
    const numara = await alicivaNumara(konusmaId)
    return grafaGonder({
      to: numara,
      type: 'image',
      image: { link: medyaUrl, ...(altYazi ? { caption: altYazi } : {}) },
    })
  },

  async webhookDogrula(): Promise<boolean> {
    // İmza ve doğrulama jetonu kontrolü rotanın kendisinde yapılıyor
    // (app/api/webhooks/whatsapp/route.ts): ham gövde orada, burada değil.
    return true
  },

  gelenMesajiCoz(payload: unknown): GelenMesaj[] {
    if (typeof payload !== 'object' || payload === null) return []
    const yuk = payload as WaYuk
    if (yuk.object !== 'whatsapp_business_account') return []

    const sonuc: GelenMesaj[] = []

    for (const kayit of yuk.entry ?? []) {
      for (const degisim of kayit.changes ?? []) {
        // statuses[] (iletildi/okundu) mesaj değildir; messages yoksa atlanır.
        const deger = degisim.value
        if (!deger?.messages?.length) continue

        // wa_id → profil adı eşlemesi. Meta adı ayrı dizide veriyor.
        const adlar = new Map<string, string | null>()
        for (const kisi of deger.contacts ?? []) {
          if (kisi.wa_id) adlar.set(kisi.wa_id, metin(kisi.profile?.name))
        }

        for (const mesaj of deger.messages) {
          const kanalKimlik = metin(mesaj.from)
          if (!kanalKimlik) continue

          // Görsel mesajlarda Meta yalnızca media id veriyor; indirme ayrı bir
          // adım (jetonla /{id} → url). Şimdilik alt yazı metin olarak alınıyor,
          // fotoğraf analizi bağlanınca burası genişleyecek.
          const govde =
            metin(mesaj.text?.body) ?? metin(mesaj.image?.caption) ?? null
          if (!govde && mesaj.type !== 'image') continue

          const zamanSaniye = Number(mesaj.timestamp)
          const zaman = Number.isFinite(zamanSaniye)
            ? new Date(zamanSaniye * 1000).toISOString()
            : new Date().toISOString()

          const yonlendirme = mesaj.referral
          const reklamBaslik = metin(yonlendirme?.headline)

          sonuc.push({
            kanal: 'whatsapp',
            kanalKimlik,
            ad: adlar.get(kanalKimlik) ?? null,
            metin: govde,
            medyaUrl: null,
            hariciId: metin(mesaj.id),
            reklam: reklamBaslik
              ? {
                  adId: metin(yonlendirme?.source_id),
                  baslik: reklamBaslik,
                  metin: metin(yonlendirme?.body),
                }
              : null,
            zaman,
            ham: payload as Json,
          })
        }
      }
    }

    return sonuc
  },
}
