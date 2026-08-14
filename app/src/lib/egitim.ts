// Fatih Bey'in panelden bota eklediği bilgi / davranış / kampanya içeriği.
//
// Fatih Bey'in isteği (12 Ağustos): "bot gün geçtikçe eğitilebiliyor olsun.
// Bilgi ekleyebileceği bir alan olsun, bir de davranışına dair geri bildirim
// verebileceği ayrı bir alan."
//
// Tasarım kararı: içerik sistem promptuna GİRER, ayrı bir arama katmanı yok.
// Sebep hacim: bir işletmenin kalıcı bilgisi birkaç paragraf tutar, sistem
// promptu zaten ~10.000 jeton ve önbellekli. Vektör arama kurmak bu hacimde
// kazanç değil, bakım yükü olurdu.

import 'server-only'

import type { EgitimIcerigi } from '@/lib/motor/types'
import { supabaseServis } from '@/lib/supabase/sunucu'
import type { BotEgitim } from '@/lib/db/types'

/**
 * Prompta girecek toplam karakter sınırı (tür başına).
 *
 * Sınırsız bırakılırsa Fatih Bey bir gün 50 sayfa doküman yapıştırır ve her
 * mesajın maliyeti katlanır — üstelik model uzun promptta kuralları kaçırmaya
 * başlar. Sınır aşılırsa EN YENİ kayıtlar alınır, gerisi prompta girmez.
 */
const TUR_BASINA_EN_FAZLA_KARAKTER = 6_000

/** Boş içerik: eğitim kaydı yoksa ya da tablo henüz kurulmadıysa. */
export const BOS_EGITIM: EgitimIcerigi = { bilgi: [], davranis: [], reklam: [] }

function kirp(
  satirlar: { baslik: string; icerik: string }[],
): { baslik: string; icerik: string }[] {
  const secilen: { baslik: string; icerik: string }[] = []
  let toplam = 0
  for (const s of satirlar) {
    const uzunluk = s.baslik.length + s.icerik.length
    if (toplam + uzunluk > TUR_BASINA_EN_FAZLA_KARAKTER) break
    secilen.push(s)
    toplam += uzunluk
  }
  return secilen
}

/**
 * Bir reklam kaydı bu konuşmaya uyuyor mu.
 *
 * Eşleşme iki yoldan olur, çünkü Fatih Bey reklam kimliğini her zaman bilmez:
 *   - `anahtar` reklam kimliğine birebir eşitse
 *   - ya da reklamın BAŞLIĞINDA anahtar kelime olarak geçiyorsa
 *     ("cam filmi" anahtarı → "Cam filmi kampanyası" başlıklı reklam)
 */
function reklamEslesiyorMu(
  kayit: BotEgitim,
  reklam: { adId?: string | null; baslik?: string | null; metin?: string | null } | null,
  bugun: string,
): boolean {
  const anahtar = kayit.anahtar?.trim().toLocaleLowerCase('tr')
  if (!anahtar || !reklam) return false

  // ⚠ Süresi dolmuş kampanya SÖYLENMEZ. Konuşma kaydı aylarca yaşıyor ve
  // `meta.reklam` orada duruyor; tarih kontrolü olmasa ağustos kampanyası
  // ekimde hâlâ vaat edilirdi. Vaat edilen indirimi işletme tutmak zorunda
  // kalır (sözleşme Madde 9.2).
  if (kayit.gecerli_bitis && kayit.gecerli_bitis < bugun) return false

  if (reklam.adId && reklam.adId.toLocaleLowerCase('tr') === anahtar) return true
  // Reklamın başlığı VE metni birlikte aranır: Fatih Bey anahtarı reklamın
  // gövdesindeki bir kelimeye göre de yazabilir.
  const havuz = `${reklam.baslik ?? ''} ${reklam.metin ?? ''}`.toLocaleLowerCase('tr')
  return havuz.trim().length > 0 && havuz.includes(anahtar)
}

/**
 * Aktif eğitim içeriğini okur.
 *
 * Tablo henüz kurulmadıysa (eski şema) sessizce boş döner — bot çalışmaya
 * devam etsin, yeni bir özellik yüzünden cevap veremez hâle gelmesin.
 */
export async function egitimIcerigiAl(
  reklam: { adId?: string | null; baslik?: string | null; metin?: string | null } | null = null,
  simdi: Date = new Date(),
): Promise<EgitimIcerigi> {
  const db = supabaseServis()
  const bugun = simdi.toISOString().slice(0, 10)

  const { data, error } = await db
    .from('bot_egitim')
    .select('*')
    .eq('aktif', true)
    .order('created_at', { ascending: false })

  if (error || !data) {
    if (error) console.warn('[egitim] okunamadı, boş devam ediliyor:', error.message)
    return BOS_EGITIM
  }

  const satir = (k: BotEgitim) => ({ baslik: k.baslik, icerik: k.icerik })

  return {
    bilgi: kirp(data.filter((k) => k.tur === 'bilgi').map(satir)),
    davranis: kirp(data.filter((k) => k.tur === 'davranis').map(satir)),
    reklam: data
      .filter((k) => k.tur === 'reklam' && reklamEslesiyorMu(k, reklam, bugun))
      .map(satir),
  }
}
