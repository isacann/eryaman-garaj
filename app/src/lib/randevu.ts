// Randevu hatırlatmasının SAF mantığı: metin kurma ve hatırlatma anı hesabı.
//
// Neden ayrı dosya: `takip.ts` `server-only` işaretli (veritabanına dokunuyor)
// ve o yüzden sınavlardan doğrudan çağrılamıyor. Buradaki iki fonksiyon hiçbir
// yan etki taşımıyor — girdi verip çıktı ölçülebiliyor, bakiyesiz sınanabiliyor.
//
// ⚠ Türkiye saati sabit UTC+3, yaz saati uygulaması yok. Saat biçimleri
// Intl ile Europe/Istanbul üzerinden üretiliyor; sunucu UTC'de çalıştığı için
// yerel saate güvenmek gece yarısı civarı bir gün kaydırıyordu.

import { hitapCoz, ilkAd } from '@/lib/motor'

/**
 * Tercih edilen hatırlatma mesafesi: randevudan 24 saat önce.
 * "Yarın aracınızı getirecektiniz" cümlesini doğru kılan aralık
 * (Fatih Bey, 14 Ağustos 2026).
 */
export const HATIRLATMA_SAAT_ONCE = 24

/** Aynı gün hatırlatmasında randevuya bırakılan en az süre. */
const EN_AZ_SAAT_ONCE = 2

/**
 * Hatırlatmanın gönderileceği an — ya da null (hatırlatmaya yer yok).
 *
 * ⚠ 24 saat kuralı TEK BAŞINA yetmiyor. Sahadaki en sık cümle "yarın
 * getireyim" ve o randevu genellikle 24 saatten yakın: müşteri bugün 15:30'da
 * yazıp yarın 15:00'i işaret ediyor. Katı 24 saat kuralıyla bu randevuların
 * neredeyse hepsi hatırlatmasız kalıyordu — yani özelliğin asıl hedeflediği
 * durum kapsam dışında kalıyordu (14 Ağustos uçtan uca sınavında yakalandı).
 *
 * Bu yüzden üç kademe var:
 *   1. Randevudan 24 saat önce (tercih edilen)
 *   2. Olmuyorsa randevu gününün sabahı 10:00 — "bugün saat 15:00'te
 *      bekliyoruz" hatırlatması hâlâ değerli
 *   3. O da geçtiyse randevudan 2 saat önce
 * Hiçbiri geleceğe düşmüyorsa hatırlatma kurulmaz: randevuya 2 saatten az
 * kalmışken hatırlatma göndermek müşteriyi zaten yoldayken rahatsız etmektir.
 */
export function hatirlatmaAni(randevu: Date, simdi: Date = new Date()): Date | null {
  const adaylar = [
    new Date(randevu.getTime() - HATIRLATMA_SAAT_ONCE * 60 * 60_000),
    randevuGunuSabahi(randevu),
    new Date(randevu.getTime() - EN_AZ_SAAT_ONCE * 60 * 60_000),
  ]

  for (const aday of adaylar) {
    if (aday.getTime() > simdi.getTime() && aday.getTime() < randevu.getTime()) return aday
  }
  return null
}

/** Randevu gününün Türkiye saatiyle 10:00'u. */
function randevuGunuSabahi(randevu: Date): Date {
  const parcalar = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(randevu)
  const al = (t: string) => parcalar.find((p) => p.type === t)?.value ?? ''
  return new Date(`${al('year')}-${al('month')}-${al('day')}T10:00:00+03:00`)
}

/** İki anın Türkiye saatine göre aynı takvim gününde olup olmadığı. */
export function ayniGunMu(a: Date, b: Date): boolean {
  const bicim = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return bicim.format(a) === bicim.format(b)
}

/**
 * Hatırlatma metni: "yarın (Cumartesi) saat 14:00 için aracınızı
 * getirecektiniz".
 *
 * Kodla kuruluyor, modele sorulmuyor: tek cümlelik sabit bir hatırlatma için
 * model çağırmak hem para hem gecikme demek, üstelik modelin saati yanlış
 * yazma ihtimali var.
 *
 * ⚠ "Yarın" sabit yazılamaz. Hatırlatma aynı gün de gidebiliyor (bkz.
 * hatirlatmaAni kademeleri); o durumda "yarın" demek düpedüz yanlış bilgi olur.
 * Gün adı da eklenir çünkü mesaj gecikirse "yarın" tek başına yanıltıcı kalıyor.
 */
export function randevuHatirlatmaMetni(
  randevu: Date,
  ad: string | null,
  gonderimAni: Date = new Date(),
): string {
  const saat = new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    hour: '2-digit',
    minute: '2-digit',
  }).format(randevu)

  const gun = new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    weekday: 'long',
  }).format(randevu)

  // ⚠ 17 Ağustos, sahada: hatırlatma "Merhabalar İsa Nurdoğdu" diye TAM ADLA
  // gitti. "Sadece ilk ad + bey/hanım" kuralı motorun girişinde uygulanıyor ama
  // bu metin motordan geçmiyor — kodla kuruluyor. Aynı sadeleştirme burada da.
  const ilk = ilkAd(ad)
  const unvan = ilk ? hitapCoz(ilk) : null
  const hitap = ilk ? `Merhabalar ${ilk}${unvan ? ` ${unvan}` : ''}` : 'Merhabalar'
  const neZaman = ayniGunMu(randevu, gonderimAni) ? `bugün (${gun})` : `yarın (${gun})`

  // "Planınızda değişiklik olursa yazmanız yeterli" 17 Ağustos'ta kaldırıldı
  // (İsa: "demesine gerek yok") — hatırlatma tek cümle, kuyruk cümlesiz.
  return `${hitap}, ${neZaman} saat ${saat} için aracınızı getirecektiniz, hatırlatmak istedik.`
}
