// Instagram DM kanalı — Meta resmî API'si ("Instagram API with Instagram Login").
//
// 14 Ağustos 2026'da dolduruldu. WhatsApp Evolution'a taşındı ama Instagram
// Meta'da KALDI: Instagram'da gayri resmî araç kullanmanın cezası kalıcı hesap
// kapatma ve kaybı takipçi tabanı + DM geçmişi + aynı portföydeki reklam
// altyapısı demek. WhatsApp'taki "bağlı cihaz" gibi resmî bir kapı yok.
//
// YOL SEÇİMİ: "Instagram API with Instagram Login" (App Review GEREKMEZ):
//   - Instagram Login  → instagram_business_manage_messages → Standard Access
//   - Facebook Login   → instagram_manage_messages          → Advanced Access
// Kalan tek engel İşletme Doğrulaması + uygulamanın Live moda alınması.
// ⚠ Dev modda üretim webhook'ları teslim EDİLMİYOR: kod hazır olsa da onay
// gelmeden gerçek DM düşmez.
//
// ⚠ META'NIN 24 SAATLİK PENCERESİ BURADA GEÇERLİ. WhatsApp'ta Evolution'a
// geçtiğimiz için pencere yok, Instagram'da var: müşterinin son mesajından 24
// saat sonra yalnızca onaylı şablon gider. Bu yüzden randevu konusu açıldığında
// bot müşteriyi WhatsApp'a yönlendiriyor (sistem-prompt.ts) — hatırlatmanın
// gideceğini orada garanti edebiliyoruz.
//
// KAPSAM DIŞI: Instagram yorumları. Sadece DM. (Bölüm 3)

import { supabaseServis } from '@/lib/supabase/sunucu'
import type { Json } from '@/lib/db/types'
import { KanalHatasi, type GelenMesaj, type GonderimSonucu, type Kanal } from './types'

const SURUM = 'v25.0'
const TABAN = `https://graph.instagram.com/${SURUM}`

function jeton(): string {
  const t = process.env.INSTAGRAM_TOKEN
  if (!t) throw new KanalHatasi('instagram', 'INSTAGRAM_TOKEN tanımlı değil.')
  return t
}

/**
 * Konuşmanın karşı tarafının Instagram kimliği (IGSID).
 *
 * ⚠ Bu kimlik HESABA ÖZEL (scoped): aynı kullanıcı başka bir işletmeye
 * yazdığında farklı bir kimlik alır. Yani Instagram kimliğiyle WhatsApp
 * numarasını eşleştirmek mümkün değil; iki kanal ayrı kişi kaydı üretir.
 */
async function alicivaKimlik(konusmaId: string): Promise<string> {
  const db = supabaseServis()
  const { data, error } = await db
    .from('conversations')
    .select('contacts(kanal_kimlik)')
    .eq('id', konusmaId)
    .single()

  if (error || !data) {
    throw new KanalHatasi('instagram', `konuşma bulunamadı: ${error?.message ?? konusmaId}`)
  }

  const iliski = (data as { contacts: { kanal_kimlik: string } | { kanal_kimlik: string }[] })
    .contacts
  const kimlik = Array.isArray(iliski) ? iliski[0]?.kanal_kimlik : iliski?.kanal_kimlik

  if (!kimlik) throw new KanalHatasi('instagram', 'konuşmanın kişi kaydı yok.')
  return kimlik
}

async function grafaGonder(govde: Record<string, unknown>): Promise<GonderimSonucu> {
  let cevap: Response
  try {
    cevap = await fetch(`${TABAN}/me/messages`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${jeton()}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(govde),
    })
  } catch (e) {
    return { basarili: false, hata: e instanceof Error ? e.message : 'ağ hatası' }
  }

  const ham = await cevap.text()
  if (!cevap.ok) {
    // En sık iki hata: (1) 24 saatlik pencere kapandı, (2) jeton süresi doldu.
    // Meta ikisini de gövdede açıklıyor, teşhis için olduğu gibi taşınıyor.
    return { basarili: false, hata: `Instagram ${cevap.status}: ${ham.slice(0, 400)}` }
  }

  try {
    const veri = JSON.parse(ham) as { message_id?: string }
    return { basarili: true, hariciId: veri.message_id ?? null }
  } catch {
    return { basarili: true, hariciId: null }
  }
}

/**
 * Kullanıcının görünen adını çeker.
 *
 * ⚠ Instagram webhook'u ad GÖNDERMİYOR — WhatsApp'ta `pushName` geliyordu,
 * burada yalnızca kimlik var. Ad olmadan bot "Merhabalar" deyip geçmek zorunda
 * kalır; oysa selamlamada ismi kullanmak Fatih Bey'in ısrarla istediği şey.
 * Bu yüzden yeni kişide bir kez profil çekiliyor (webhook rotasında).
 */
export async function instagramProfilAl(
  kimlik: string,
): Promise<{ ad: string | null; kullaniciAdi: string | null } | null> {
  try {
    const cevap = await fetch(
      `${TABAN}/${encodeURIComponent(kimlik)}?fields=name,username`,
      { headers: { authorization: `Bearer ${jeton()}` } },
    )
    if (!cevap.ok) return null
    const veri = (await cevap.json()) as { name?: string; username?: string }
    return {
      ad: metin(veri.name),
      kullaniciAdi: metin(veri.username),
    }
  } catch {
    return null
  }
}

// ---- gelen yükün biçimi (yalnızca okuduğumuz alanlar) ----

/** Reklamdan gelindiyse reklamın bilgisi. */
type IgYonlendirme = {
  source?: string
  type?: string
  ad_id?: string
  ref?: string
  ads_context_data?: {
    ad_title?: string
    photo_url?: string
    video_url?: string
  }
}

type IgOlay = {
  sender?: { id?: string }
  recipient?: { id?: string }
  timestamp?: number | string
  message?: {
    mid?: string
    text?: string
    is_echo?: boolean
    is_deleted?: boolean
    attachments?: { type?: string; payload?: { url?: string } }[]
    referral?: IgYonlendirme
  }
  referral?: IgYonlendirme
  // Okundu / iletildi / tepki bildirimleri — mesaj değil.
  read?: unknown
  delivery?: unknown
  reaction?: unknown
  postback?: unknown
}

type IgYuk = {
  object?: string
  entry?: {
    id?: string
    messaging?: IgOlay[]
    // Yorum olayları burada gelir; kapsam dışı.
    changes?: unknown[]
  }[]
}

function metin(deger: unknown): string | null {
  return typeof deger === 'string' && deger.trim() !== '' ? deger.trim() : null
}

export const instagramKanal: Kanal = {
  ad: 'instagram',

  async mesajGonder(konusmaId: string, metinIcerik: string): Promise<GonderimSonucu> {
    const kimlik = await alicivaKimlik(konusmaId)
    return grafaGonder({
      recipient: { id: kimlik },
      message: { text: metinIcerik },
    })
  },

  async medyaGonder(
    konusmaId: string,
    medyaUrl: string,
    altYazi?: string | null,
  ): Promise<GonderimSonucu> {
    const kimlik = await alicivaKimlik(konusmaId)

    // ⚠ Instagram DM'de görselin alt yazısı YOK: tek istekte caption alanı
    // bulunmuyor. Alt yazı varsa ayrı bir metin mesajı olarak, görselden ÖNCE
    // gider — böylece müşteri neye baktığını bilerek açar.
    if (altYazi?.trim()) {
      const onSonuc = await grafaGonder({
        recipient: { id: kimlik },
        message: { text: altYazi.trim() },
      })
      // Alt yazı gitmediyse görseli yine de göndeririz: eksik alt yazı,
      // hiç gitmeyen fiyat listesinden iyidir.
      if (!onSonuc.basarili) {
        console.warn('[instagram] görsel alt yazısı gönderilemedi:', onSonuc.hata)
      }
    }

    return grafaGonder({
      recipient: { id: kimlik },
      message: {
        attachment: { type: 'image', payload: { url: medyaUrl, is_reusable: true } },
      },
    })
  },

  async webhookDogrula(): Promise<boolean> {
    // İmza ve doğrulama jetonu kontrolü rotanın kendisinde yapılıyor
    // (app/api/webhooks/instagram/route.ts): ham gövde orada, burada değil.
    return true
  },

  gelenMesajiCoz(payload: unknown): GelenMesaj[] {
    if (typeof payload !== 'object' || payload === null) return []
    const yuk = payload as IgYuk
    if (yuk.object !== 'instagram') return []

    const sonuc: GelenMesaj[] = []

    for (const kayit of yuk.entry ?? []) {
      // entry[].changes = yorum/mention olayları. Kapsam dışı (Bölüm 3).
      for (const olay of kayit.messaging ?? []) {
        // Okundu / iletildi / tepki / buton olayları mesaj değildir.
        if (!olay.message) continue

        // ⚠ EN KRİTİK FİLTRE (WhatsApp'taki fromMe'nin karşılığı): kendi
        // gönderdiğimiz mesaj echo olarak geri düşüyor. Elenmezse bot kendi
        // cevabını müşteri mesajı sanıp kendine cevap yazar ve sonsuz döngüye
        // girer — her turu para harcayarak.
        if (olay.message.is_echo) continue

        // Müşteri mesajını sildiyse içerik yok, işlenecek bir şey de yok.
        if (olay.message.is_deleted) continue

        const kanalKimlik = metin(olay.sender?.id)
        if (!kanalKimlik) continue

        // Kendi hesabımızın kimliğinden gelen olay (echo bayrağı gelmese bile).
        if (kanalKimlik === metin(olay.recipient?.id)) continue

        const govde = metin(olay.message.text)

        // Görsel/video ekleri: ilk görselin adresi alınır. Bot fotoğrafa bakıp
        // aracı okuyor (KAPSAM karar: fiyat kesmez, notu panele düşer).
        const ek = (olay.message.attachments ?? []).find(
          (a) => a.type === 'image' || a.type === 'video',
        )
        const medyaUrl = metin(ek?.payload?.url)

        // Ne metin ne ek varsa (sticker, ses, paylaşım) işlenecek şey yok.
        if (!govde && !medyaUrl) continue

        // Zaman damgası milisaniye geliyor (WhatsApp'ta saniyeydi).
        const zamanMs = Number(olay.timestamp)
        const zaman = Number.isFinite(zamanMs)
          ? new Date(zamanMs).toISOString()
          : new Date().toISOString()

        // Reklam bilgisi iki yerden gelebiliyor: ilk mesajda message.referral,
        // sonrakilerde olay seviyesindeki referral.
        const yonlendirme = olay.message.referral ?? olay.referral
        const reklamBaslik = metin(yonlendirme?.ads_context_data?.ad_title)

        sonuc.push({
          kanal: 'instagram',
          kanalKimlik,
          // Instagram webhook'u ad taşımıyor; rota yeni kişide profili çekiyor.
          ad: null,
          metin: govde,
          medyaUrl,
          hariciId: metin(olay.message.mid),
          reklam: reklamBaslik
            ? {
                adId: metin(yonlendirme?.ad_id),
                baslik: reklamBaslik,
                // Instagram reklam METNİNİ vermiyor, yalnızca başlığı ve
                // görselini. WhatsApp'ta referral.body geliyordu.
                metin: null,
              }
            : null,
          zaman,
          ham: payload as Json,
        })
      }
    }

    return sonuc
  },
}
