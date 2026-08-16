// İş başvurusu tespiti (Fatih Bey, 15 Ağustos: "İş ilanı için gelen mesajlar
// olursa cevap vermesin, pas geçsin").
//
// NEDEN KOD: modelin çıktı şeması en az bir mesaj ZORUNLU kılıyor — model
// "susmayı" seçemez. Susma kararı bot turundan ÖNCE, kodda verilir
// (gelen-tur.ts): başvuru mesajında bot turu hiç açılmaz. Mesaj panele normal
// düşer, ekip isterse elle cevap yazar; takip merdiveni ve mesai kuyruğu da
// hiç kurulmaz (ikisi de bot turuna bağlı).
//
// Kalıp KASTEN dar: yanlış pozitif, gerçek bir müşteriyi cevapsız bırakmak
// demek. "çalışmak istiyorum" gibi müşteri ağzına da girebilecek ifadeler
// tek başına YETMEZ; iş/eleman bağlamı da aranır.

const KALIPLAR: RegExp[] = [
  /i[şs]\s*(ilan[ıi]|ba[şs]vuru|ar[ıi]yorum|bakm[ıi]yorum|imk[aâ]n[ıi])/i,
  /i[şs]e\s*(girmek|al[ıi]m|ba[şs]vur)/i,
  /eleman\s*(al[ıi]m[ıi]|ar[ıi]yor|aran[ıi]yor|laz[ıi]m|ihtiyac[ıi])/i,
  /eleman\s*al[ıi]yor\s*mu/i,
  /personel\s*(al[ıi]m[ıi]|ar[ıi]yor|aran[ıi]yor|ihtiyac[ıi])/i,
  /\b(usta|ç[ıi]rak|kalfa)\s*(ar[ıi]yor|aran[ıi]yor|laz[ıi]m|al[ıi]yor)/i,
  /\bcv\b|özge[çc]mi[şs]/i,
  /\bstaj\b|stajyer/i,
  /yan[ıi]n[ıi]zda\s*çal[ıi][şs]mak/i,
  /i[şs]\s*ba[şs]vurusu/i,
  /maa[şs]\s*(ne kadar|ka[çc])/i,
]

/** Metin bir iş başvurusu / eleman sorusu mu. */
export function isBasvurusuMu(metin: string | null | undefined): boolean {
  const m = (metin ?? '').trim()
  if (m === '') return false
  return KALIPLAR.some((k) => k.test(m))
}
