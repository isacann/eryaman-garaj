// Çalışma saati hesabı. KAPSAM karar 5: bot 08:00-01:00 tam çalışır,
// 01:00-08:00 arası cevap vermez, tek "mesai dışındayız" mesajı atar.
//
// Burada sadece "şu an mesai içinde miyiz" sorusu cevaplanır. Kuyruğa alma ve
// sabah devam etme mantığı takip kuyruğunun işi (kilometre taşı sonrası).

export const VARSAYILAN_BASLANGIC = '08:00'
export const VARSAYILAN_BITIS = '01:00'
export const ZAMAN_DILIMI = 'Europe/Istanbul'

/**
 * Botun KENDİ başlattığı mesajların (takip merdiveni, randevu hatırlatması)
 * gönderilebildiği pencere. Mesai penceresiyle aynı DEĞİL, kasten daha dar.
 *
 * ⚠ 15 Ağustos (Fatih Bey): "Gecenin 1'inde mesaj atıyor 😂 — takip mesajı da
 * olsa atmasın, beklesin gece ise." Sahadaki mesaj 00:50'de gitmişti ve mesai
 * kuralı onu haklı buluyordu: işletme 01:00'e kadar açık, yani 00:50 mesai
 * İÇİ. Kural doğruydu, ayrım eksikti.
 *
 * Ayrım şu: müşteri gece 00:50'de yazarsa ona cevap vermek doğru — bekletmek
 * kötü hizmet olur. Ama kimse yazmamışken botun kendi kendine "aklınıza takılan
 * bir şey olursa buradayım" yazması bambaşka bir şey; o saatte gelen bildirim
 * müşteriyi uyandırır ve işletmeyi ısrarcı gösterir.
 *
 * Bu yüzden gelen mesaja cevap 01:00'e kadar sürer, proaktif mesaj 22:00'de
 * susar ve sabah 08:00'e kaydırılır.
 */
export const PROAKTIF_BASLANGIC = '08:00'
export const PROAKTIF_BITIS = '22:00'

/** "08:30" → 510 */
function dakikayaCevir(saatMetni: string): number {
  const [saat, dakika] = saatMetni.split(':').map((p) => Number.parseInt(p, 10))
  if (!Number.isFinite(saat) || !Number.isFinite(dakika)) {
    throw new Error(`geçersiz saat biçimi: ${saatMetni}`)
  }
  return saat * 60 + dakika
}

/** Verilen anın Türkiye saatiyle "HH:MM" karşılığı. */
export function yerelSaat(an: Date = new Date(), zamanDilimi = ZAMAN_DILIMI): string {
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: zamanDilimi,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(an)
}

/**
 * Verilen andan sonraki ilk "HH:MM" anını döndürür (Türkiye saatiyle).
 * Şu an tam o saatteysek bir sonraki güne atlar.
 *
 * Türkiye 2016'dan beri kalıcı UTC+3, yaz saati uygulaması yok; bu yüzden
 * dakika ekleyerek hesaplamak güvenli.
 */
export function sonrakiYerelSaat(
  hedefSaat: string,
  an: Date = new Date(),
  zamanDilimi = ZAMAN_DILIMI,
): Date {
  const simdi = dakikayaCevir(yerelSaat(an, zamanDilimi))
  const hedef = dakikayaCevir(hedefSaat)
  let fark = hedef - simdi
  if (fark <= 0) fark += 24 * 60
  // Saniye/salise artığını kırp ki sonuç tam dakikaya otursun.
  const temiz = new Date(an.getTime())
  temiz.setSeconds(0, 0)
  return new Date(temiz.getTime() + fark * 60_000)
}

export type CalismaSaati = {
  baslangic?: string
  bitis?: string
  zamanDilimi?: string
}

/**
 * Mesai dışında mıyız. Bitiş başlangıçtan küçükse (01:00 gibi) aralık gece
 * yarısını aşıyor demektir, hesap ona göre yapılır.
 */
export function mesaiDisiMi(an: Date = new Date(), ayar: CalismaSaati = {}): boolean {
  const baslangic = dakikayaCevir(ayar.baslangic ?? VARSAYILAN_BASLANGIC)
  const bitis = dakikayaCevir(ayar.bitis ?? VARSAYILAN_BITIS)
  const simdi = dakikayaCevir(yerelSaat(an, ayar.zamanDilimi ?? ZAMAN_DILIMI))

  const icerideMi =
    baslangic <= bitis
      ? simdi >= baslangic && simdi < bitis
      : simdi >= baslangic || simdi < bitis

  return !icerideMi
}

/**
 * Botun kendi başlattığı mesaj şu an gönderilebilir mi — HAYIR ise true.
 *
 * `mesaiDisiMi`'den ayrı tutuluyor: mesai 01:00'e kadar sürer, proaktif pencere
 * 22:00'de kapanır. Gerekçe PROAKTIF_BITIS'in başında.
 */
export function proaktifSessizMi(an: Date = new Date(), ayar: CalismaSaati = {}): boolean {
  return mesaiDisiMi(an, {
    baslangic: ayar.baslangic ?? PROAKTIF_BASLANGIC,
    bitis: ayar.bitis ?? PROAKTIF_BITIS,
    zamanDilimi: ayar.zamanDilimi,
  })
}
