'use server'

// Test konsolunun sunucu tarafı.
//
// Motor SADECE burada çalışır: GEMINI_API_KEY tarayıcıya gitmez, istemci
// yalnızca metni ve fotoğrafı yollar, karşılığında botun cevabını alır.
//
// Kayıtlar gerçek tablolara düşer ama kanal 'test' olduğu için gerçek
// WhatsApp/Instagram yazışmalarıyla karışmaz (rozet: Test konsolu).

import { revalidatePath } from 'next/cache'
import { botCevapla, SON_CARE_METNI } from '@/lib/bot'
import { TEST_KIMLIK_ONEK } from '@/lib/channels/test'
import { gelenMesajiKaydet } from '@/lib/mesajlar'
import type { Gorsel } from '@/lib/motor'
import { supabaseSunucu } from '@/lib/supabase/sunucu'
import type { Json } from '@/lib/db/types'
import type { KonsolGirdi, KonsolSonuc } from './tipler'

/** Küçültme istemcide yapılır; buraya 1 MB'ın altında bir JPEG bekleniyor. */
const EN_BUYUK_GORSEL_BAYT = 1_500_000

/**
 * Motorun ham hatası İngilizce ve teknik. Konsolu kullanan kişi geliştirici
 * değil, o yüzden en sık görülecekleri Türkçeye çeviriyoruz.
 *
 * İki durum da HTTP 429 döndüğü için ayrımı GÖVDEDEKİ KOD yapar, durum kodu
 * değil. Karıştırmak pahalıya patlıyor: 11 Ağustos'ta bakiye bittiğinde konsol
 * "bir dakika bekleyip tekrar dene" yazdı, oysa beklemek hiçbir şeyi çözmüyordu
 * — bekleyen kişi sorunun geçici olduğunu sanıyor.
 */
/**
 * Bakiye uyarısı HANGİ hesaba kredi yükleneceğini doğru söylemeli.
 *
 * ⚠ 12 Ağustos: sağlayıcı Anthropic'e geçmişti ama bu metin "OpenAI hesabına
 * kredi yüklenmeli" diye sabitti; Fatih Bey'in ekranında öyle çıktı ve yanlış
 * hesaba yönlendiriyordu. Sağlayıcı adı artık ayardan okunuyor, elle yazılmıyor.
 */
function saglayiciAdiVeAdres(): { ad: string; adres: string } {
  switch ((process.env.MOTOR_SAGLAYICI ?? 'openai').toLowerCase()) {
    case 'anthropic':
      return { ad: 'Anthropic', adres: 'console.anthropic.com → Plans & Billing' }
    case 'gemini':
    case 'gemini-lite':
      return { ad: 'Google Gemini', adres: 'aistudio.google.com' }
    default:
      return {
        ad: 'OpenAI',
        adres: 'platform.openai.com/settings/organization/billing',
      }
  }
}

function anlasilirHata(mesaj: string): string {
  const kucuk = mesaj.toLowerCase()

  // Kalıcı: hesapta para yok. Beklemek çözmez, kredi yüklenmeli.
  if (
    kucuk.includes('insufficient_quota') ||
    kucuk.includes('credit_balance_exhausted') ||
    kucuk.includes('no credits remaining') ||
    kucuk.includes('credit balance is too low') ||
    kucuk.includes('billing')
  ) {
    const { ad, adres } = saglayiciAdiVeAdres()
    return `Yapay zeka hesabında bakiye kalmadı. Beklemek çözmez; ${ad} hesabına kredi yüklenmeli (${adres}).`
  }

  // Geçici: dakikalık istek/jeton sınırı. Beklemek gerçekten çözer.
  if (kucuk.includes('rate limit') || kucuk.includes('rate_limit') || kucuk.includes('429')) {
    return 'Yapay zeka anlık istek sınırına takıldı. Bir dakika bekleyip tekrar dene.'
  }

  if (kucuk.includes('quota')) {
    return 'Yapay zeka kotası doldu. Sorun sürerse hesabın bakiyesini kontrol et.'
  }

  return mesaj
}

export async function testMesajGonder(girdi: KonsolGirdi): Promise<KonsolSonuc> {
  const db = await supabaseSunucu()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return { tamam: false, hata: 'Oturum yok. Yeniden giriş yap.' }

  const oturum = girdi.oturum.trim()
  if (!oturum) return { tamam: false, hata: 'Oturum kimliği yok.' }

  const metin = girdi.metin.trim()
  const gorsel = girdi.gorsel
  if (!metin && !gorsel) return { tamam: false, hata: 'Boş mesaj gönderilmez.' }

  if (gorsel) {
    if (!gorsel.mimeTur.startsWith('image/')) {
      return { tamam: false, hata: 'Sadece fotoğraf gönderilebilir.' }
    }
    if (gorsel.base64.length > EN_BUYUK_GORSEL_BAYT) {
      return { tamam: false, hata: 'Fotoğraf çok büyük. Daha küçük bir kare dene.' }
    }
  }

  // Fotoğrafı olan mesaja metin yazılmadıysa da bir metin bırakıyoruz:
  // gelen kutusu satırı ve modele giden geçmiş boş kalmasın.
  const kayitMetni = metin || '[fotoğraf gönderdi]'

  let konusmaId: string
  try {
    const sonuc = await gelenMesajiKaydet({
      kanal: 'test',
      kanalKimlik: `${TEST_KIMLIK_ONEK}${oturum}`,
      ad: girdi.ad?.trim() || null,
      metin: kayitMetni,
      medyaUrl: gorsel ? `data:${gorsel.mimeTur};base64,${gorsel.base64}` : null,
      hariciId: null,
      reklam: null,
      zaman: new Date().toISOString(),
      ham: { kaynak: 'test-konsolu' } as Json,
    })
    konusmaId = sonuc.konusmaId
  } catch (e) {
    return { tamam: false, hata: e instanceof Error ? e.message : 'mesaj kaydedilemedi' }
  }

  const gorseller: Gorsel[] = gorsel
    ? [{ mimeTur: gorsel.mimeTur, base64: gorsel.base64 }]
    : []

  // Test konsolu mesai kuralını atlar: gece denemede "mesai dışındayız" duvarı
  // cevap kalitesini denemeyi imkânsız kılıyordu. Gerçek kanallarda kural işler.
  const cevap = await botCevapla(konusmaId, { gorseller, mesaiKuralsiz: true })
  revalidatePath('/')

  // ⚠ Hata durumunda konsol yalnızca teknik uyarıyı gösteriyordu; oysa GERÇEK
  // müşteriye son çare cümlesi gidiyor. Fatih Bey 12 Ağustos'ta konsolda o
  // cümleyi görmedi ve müşterinin de hiçbir şey görmediğini sandı. Konsol artık
  // ikisini birden gösteriyor: operatöre sebep, altında müşteriye giden metin.
  if (!cevap.tamam) {
    return {
      tamam: false,
      hata: `${anlasilirHata(cevap.mesaj)}\n\nMüşteriye şu mesaj gitti: "${SON_CARE_METNI}"`,
      konusmaId,
    }
  }

  return {
    tamam: true,
    konusmaId,
    mesajlar: cevap.yapili.mesajlar,
    yapili: cevap.yapili,
    kullanim: cevap.kullanim,
  }
}
