// Fiyat bilgisinin tek kaynağı: ../../FIYAT-LISTESI.md
//
// Bu dosya fiyat tablosunu ELLE KOPYALAMAZ, markdown'ı okuyup böler. Fiyat
// güncellenince sadece FIYAT-LISTESI.md değişir, sistem promptu kendiliğinden
// yeni fiyattan konuşur.
//
// Hangi bölüm nereye gidiyor:
//   Bölüm 1 + 2  → onaylı fiyat tablosu, bot bu rakamları verebilir
//   Bölüm 3b     → "Fatih Bey teyit etmeli" kalemler. VARSAYILAN: bot bu
//                  rakamları vermez, iş adını görünce devreder. Teyit gelirse
//                  MOTOR_TEYITSIZ_FIYAT=evet ile açılır.
//   Bölüm 4      → fiyat dışı ticari bilgiler (süre, taksit, adres)
//
// Bölüm 3d gereği görsel listenin "SUV'da fark olabilir" dipnotu prompt'a
// girerken düzeltilir: Fatih Bey SUV/binek farkı olmadığını söyledi.

import { readFileSync } from 'node:fs'
import path from 'node:path'

export type FiyatBilgisi = {
  /** Dosyanın okunduğu yol, teşhis için. */
  kaynakYolu: string
  /** Sistem prompta gömülecek onaylı fiyat tablosu (bölüm 1 + 2). */
  onayliTablo: string
  /** Sistem prompta gömülecek ticari bilgiler (bölüm 4). */
  ticariBilgiler: string
  /** Teyit beklediği için fiyatı verilmeyip devredilecek iş adları. */
  teyitBekleyenIsler: string[]
  /** 3b tablosunun ham hali. Sadece teyitsizDahil true iken prompta girer. */
  teyitBekleyenTablo: string
  /** Botun kullanmasına izin verilen rakamlar, normalize edilmiş ("18000"). */
  izinliRakamlar: Set<string>
  /** Ürün × kapsam → fiyat. Kalem-rakam eşleşmesi denetimi bunu kullanır. */
  kalemFiyatlari: KalemFiyati[]
  /** Teyitsiz kalemler prompta dahil edildi mi (MOTOR_TEYITSIZ_FIYAT). */
  teyitsizDahil: boolean
  /** Bölüm 2b ile 3c çeliştiği için onaylı tablodan düşürülen kalemler. */
  celiskiliKalemler: string[]
}

// ÇELİŞKİ (8 Ağustos 2026, çözüm İsa/Fatih Bey'de):
// Bölüm 2b (İsa teyidi) iki cam filmi kalemini onaylı listeye soktu, ama
// Bölüm 3c (Fatih Bey) aynı gün "cam filminde görsel liste esastır, yazışmadaki
// 8.000/9.000 geçersiz, listeye eklenen TEK kalem Ön 2 cam filmi 4.500₺" diyor.
//
// Çözülene kadar 3c uygulanıyor: bu satırlar onaylı tablodan çıkarılır, bot bu
// rakamları veremez. Gerekçe: müşteriye yanlış fiyat vermek, fiyat vermemekten
// pahalı (sözleşme Madde 9.2). Ön cam filmi zaten görsel listede var
// (XPEL XR Blue 12.000, Global IR Ceramic 7.500), bot oradan konuşur.
//
// İsa "hayır, 2b aynen geçerli" derse: bu diziyi boşalt, başka değişiklik gerekmez.
const CAM_FILMI_CELISKISI = ['Ön cam filmi', 'Ön 2 kapı camı (Global)']

const SUV_DUZELTMESI =
  '**Not:** cam filmlerinde **ömür boyu garanti** vardır. ' +
  '**SUV ile binek arasında fiyat farkı YOKTUR** (Fatih Bey kararı, 8 Ağustos 2026).'

function dosyaYoluBul(): string {
  const adaylar = [
    process.env.FIYAT_LISTESI_YOLU,
    path.join(process.cwd(), '..', 'FIYAT-LISTESI.md'),
    path.join(process.cwd(), 'FIYAT-LISTESI.md'),
  ].filter((y): y is string => typeof y === 'string' && y.length > 0)

  for (const aday of adaylar) {
    try {
      readFileSync(aday, 'utf8')
      return aday
    } catch {
      // sıradaki adaya bak
    }
  }
  throw new Error(
    `FIYAT-LISTESI.md bulunamadı. Denenen yollar: ${adaylar.join(', ')}. ` +
      'FIYAT_LISTESI_YOLU ortam değişkeniyle yol verebilirsin.',
  )
}

/** İki başlık arasındaki satırları döndürür. bitisKosulu ilk sağlandığında durur. */
function bolumAl(
  satirlar: string[],
  baslangicKosulu: (s: string) => boolean,
  bitisKosulu: (s: string) => boolean,
): string[] {
  const bas = satirlar.findIndex(baslangicKosulu)
  if (bas === -1) return []
  const kalan = satirlar.slice(bas)
  const bit = kalan.findIndex((s, i) => i > 0 && bitisKosulu(s))
  const dilim = bit === -1 ? kalan : kalan.slice(0, bit)
  // Bölüm sonundaki ayraç ve boş satırları kırp.
  while (dilim.length > 0) {
    const son = dilim[dilim.length - 1].trim()
    if (son === '' || son === '---') dilim.pop()
    else break
  }
  return dilim
}

function kucuk(metin: string): string {
  return metin.toLocaleLowerCase('tr')
}

/** "18.000" / "18,000" / "18 000" → "18000" */
export function rakamiNormalize(ham: string): string {
  return ham.replace(/[.,\s ]/g, '')
}

function rakamlariTopla(metin: string): string[] {
  // İki biçim: binlik ayraçlı ("18.000") ve ayraçsız ama ₺ ile bitişik ("750₺").
  // İkincisi olmadan üç haneli fiyatlar izinli listeye hiç girmiyordu; bot
  // "pasta cila + boya koruma 750₺" deyince denetim onu uydurma sanıyordu.
  const ayracli = metin.match(/\b\d{1,3}\.\d{3}\b/g) ?? []
  const ayracsiz = metin.match(/\b\d{3,}(?=\s*(?:₺|TL\b))/gi) ?? []
  return [...ayracli, ...ayracsiz].map(rakamiNormalize)
}

/**
 * Ürün × kapsam → fiyat haritası.
 *
 * NEDEN: "bu rakam listede var mı" kontrolü yetmiyor. Bot 9 Ağustos'ta
 * "XPEL Xtreme ön 4 parça 25.000₺" dedi — 25.000 listede VAR ama Global'in
 * sütununda; XPEL Xtreme'in ön 4 parçası 35.000₺. Rakam bazlı denetim bunu
 * göremedi. Bu harita kalem-rakam eşleşmesini mümkün kılıyor.
 *
 * Tablo biçimi: | Ürün | Garanti | Mikron | Kaput | Ön 3 parça | Ön 4 parça | Komple |
 */
export type KalemFiyati = {
  urun: string
  kapsam: string
  fiyat: string
  /** Tablodaki "Garanti" sütunu — "5 yıl". Yoksa null. */
  garanti?: string | null
  /** Tablodaki "Mikron" sütunu — "190". Yoksa null. */
  mikron?: string | null
}

function kalemFiyatlariniCikar(satirlar: string[]): KalemFiyati[] {
  const cikti: KalemFiyati[] = []
  let basliklar: string[] = []

  for (const satir of satirlar) {
    const temiz = satir.trim()
    if (!temiz.startsWith('|')) continue

    const hucreler = temiz.split('|').map((h) => h.replace(/\*\*/g, '').trim())
    // Baş ve sondaki boş hücreler
    const dolu = hucreler.slice(1, -1)
    if (dolu.length < 3) continue

    // Ayraç satırı (|---|---|)
    if (dolu.every((h) => /^:?-+:?$/.test(h))) continue

    // Başlık satırı: ilk hücre "Ürün" ya da "Paket"
    if (/^(ürün|paket)$/i.test(dolu[0])) {
      basliklar = dolu
      continue
    }

    if (basliklar.length === 0) continue

    const urun = dolu[0]
    if (urun === '') continue

    // Ürünün özellik sütunları (garanti, mikron) satırın kendisinde duruyor;
    // fiyat satırlarına iliştirilirse liste kodla basılabilir hale geliyor.
    const sutun = (ad: RegExp): string | null => {
      const i = basliklar.findIndex((b) => ad.test(b))
      const deger = i >= 0 ? dolu[i]?.trim() : ''
      return deger ? deger : null
    }
    const garanti = sutun(/garanti/i)
    const mikron = sutun(/mikron/i)

    for (let i = 1; i < dolu.length && i < basliklar.length; i += 1) {
      const kapsam = basliklar[i]
      const hucre = dolu[i]
      // Sadece fiyat hücreleri: "10.000", "**75.000**". Garanti/mikron atlanır.
      const eslesme = hucre.match(/\b\d{1,3}\.\d{3}\b/)
      if (!eslesme) continue
      if (/garanti|mikron|özellik/i.test(kapsam)) continue
      cikti.push({ urun, kapsam, fiyat: rakamiNormalize(eslesme[0]), garanti, mikron })
    }
  }

  return cikti
}

/** 3b tablosundan iş adı + yazışmada geçen rakamı çıkarır. */
function teyitBekleyenSatirlar(satirlar: string[]): { ad: string; rakamlar: string[] }[] {
  const cikti: { ad: string; rakamlar: string[] }[] = []
  for (const satir of satirlar) {
    if (!satir.trim().startsWith('|')) continue
    const hucreler = satir.split('|').map((h) => h.trim())
    // ['', 'İş', 'Yazışmada geçen', ''] biçiminde geliyor
    if (hucreler.length < 3) continue
    const ad = hucreler[1].replace(/\*\*/g, '').trim()
    if (ad === '' || ad === 'İş' || /^-+$/.test(ad)) continue
    cikti.push({ ad, rakamlar: rakamlariTopla(hucreler[2] ?? '') })
  }
  return cikti
}

let onbellek: FiyatBilgisi | null = null

export function fiyatBilgisiAl(yenidenOku = false): FiyatBilgisi {
  if (onbellek && !yenidenOku) return onbellek

  const kaynakYolu = dosyaYoluBul()
  const satirlar = readFileSync(kaynakYolu, 'utf8').split(/\r?\n/)

  const onayliSatirlar = bolumAl(
    satirlar,
    (s) => s.startsWith('## 1. '),
    (s) => s.startsWith('## 3. '),
  )
  if (onayliSatirlar.length === 0) {
    throw new Error(`${kaynakYolu}: "## 1." ve "## 3." başlıkları bulunamadı, biçim değişmiş.`)
  }

  const ticariSatirlar = bolumAl(
    satirlar,
    (s) => s.startsWith('## 4. '),
    () => false,
  )

  const teyitSatirlari = bolumAl(
    satirlar,
    (s) => s.startsWith('### 3b.'),
    (s) => s.startsWith('### ') || s.startsWith('## '),
  )

  // Bölüm 3c ile çelişen cam filmi satırları onaylı tablodan düşürülür.
  const celiskiliKalemler: string[] = []
  const celiskiliMi = (satir: string): boolean => {
    if (!satir.trim().startsWith('|')) return false
    const ad = (satir.split('|')[1] ?? '').replace(/\*\*/g, '').trim()
    if (!CAM_FILMI_CELISKISI.some((k) => kucuk(k) === kucuk(ad))) return false
    celiskiliKalemler.push(ad)
    return true
  }

  // Görsel listenin SUV dipnotu Fatih Bey'in kararıyla geçersiz (bölüm 3d).
  const onayliTablo = onayliSatirlar
    .filter((satir) => !celiskiliMi(satir))
    .map((satir) => (satir.includes('SUV') ? SUV_DUZELTMESI : satir))
    .join('\n')
    .trim()

  const teyitsizDahil = (process.env.MOTOR_TEYITSIZ_FIYAT ?? '').toLowerCase() === 'evet'
  const teyitKalemleri = teyitBekleyenSatirlar(teyitSatirlari)

  const izinliRakamlar = new Set(rakamlariTopla(onayliTablo))

  // Adı onaylı tabloda zaten geçen kalem teyit beklemiyor demektir
  // (ör. "Ön 2 cam filmi" bölüm 2'ye eklendi, 3c kararı).
  const onayliKucuk = kucuk(onayliTablo)
  const teyitBekleyenIsler: string[] = []
  for (const kalem of teyitKalemleri) {
    if (onayliKucuk.includes(kucuk(kalem.ad))) continue
    if (teyitsizDahil) {
      for (const rakam of kalem.rakamlar) izinliRakamlar.add(rakam)
    } else {
      teyitBekleyenIsler.push(kalem.ad)
    }
  }

  onbellek = {
    kaynakYolu,
    onayliTablo,
    // Başlık satırı atılır; prompt kendi başlığını koyuyor.
    ticariBilgiler: ticariSatirlar.slice(1).join('\n').trim(),
    teyitBekleyenIsler,
    teyitBekleyenTablo: teyitSatirlari.join('\n').trim(),
    izinliRakamlar,
    kalemFiyatlari: kalemFiyatlariniCikar(onayliSatirlar),
    teyitsizDahil,
    celiskiliKalemler,
  }
  return onbellek
}

// ---------------------------------------------------------------------------
// Fiyat listesini KODLA basma
//
// Neden (Fatih Bey, 13 Ağustos: "bot yazıyor şeklinde 2 dakika kalıyor"):
// ölçüldü, turun neredeyse tamamı çıktı üretmekle geçiyor. Fiyat listesi tek
// başına ~1.100 jeton; Sonnet 17-58 jeton/sn yazıyor, yani liste 20-60 saniye
// sürüyor. Oysa liste ZATEN elimizde — modele yazdırmanın hiçbir katkısı yok,
// üstelik her seferinde yanlış kalem/yanlış rakam riski taşıyor.
//
// Model artık yalnızca HANGİ listeyi göndereceğini söylüyor (`fiyat_listesi`
// alanı), metni bu fonksiyon üretiyor.
//
// ⚠ İKİNCİ KOPYA YOK: rakamlar da özellikler de FIYAT-LISTESI.md'den okunuyor.
// Fiyat değişince yine tek dosya güncellenir. ("Aynı bilgi iki yerde" tuzağına
// bu projede üç kez düşüldü; bu yüzden liste elle yazılmıyor.)
// ---------------------------------------------------------------------------

/** Modelin seçebileceği hazır listeler. Şemadaki enum ile aynı olmalı. */
export const LISTE_ANAHTARLARI = [
  'komple-ppf',
  'komple-mat',
  'on-4-ppf',
  'on-3-ppf',
  'kaput-ppf',
  'cam-filmi',
] as const

export type ListeAnahtari = (typeof LISTE_ANAHTARLARI)[number]

/** Mat seriler ayrı bir tercih; parlak listeye karışmamalı. */
const MAT = /\(mat\)|stealth/i

const LISTE_TANIMI: Record<
  ListeAnahtari,
  { kapsam: RegExp; baslik: string; mat?: boolean }
> = {
  'komple-ppf': { kapsam: /^komple$/i, baslik: 'Komple PPF kaplamada seçeneklerimiz' },
  // Mat yalnızca KOMPLE yapılıyor (Fatih Bey, 11 Ağustos); kısmi mat fiyatı yok.
  'komple-mat': { kapsam: /^komple$/i, baslik: 'Mat PPF seçeneklerimiz', mat: true },
  'on-4-ppf': { kapsam: /^ön 4 parça$/i, baslik: 'Ön 4 parça PPF seçeneklerimiz' },
  'on-3-ppf': { kapsam: /^ön 3 parça$/i, baslik: 'Ön 3 parça PPF seçeneklerimiz' },
  'kaput-ppf': { kapsam: /^kaput$/i, baslik: 'Kaput PPF seçeneklerimiz' },
  'cam-filmi': { kapsam: /^5 cam komple$/i, baslik: '5 cam komple cam filmi seçeneklerimiz' },
}

/**
 * Sıralama kuralı (Fatih Bey, 10 Ağustos): PPF'te XPEL'ler ucuzdan pahalıya,
 * **Global EN SON** — Global bir itiraz cevabı, açılış değil. Cam filminde ise
 * tam tersi: önce XPEL, sonra Global (zaten ikisi de aynı yönde çıkıyor).
 */
function sirala(kalemler: KalemFiyati[]): KalemFiyati[] {
  const globalMi = (k: KalemFiyati) => /^global/i.test(k.urun)
  return [...kalemler].sort((a, b) => {
    if (globalMi(a) !== globalMi(b)) return globalMi(a) ? 1 : -1
    return Number(a.fiyat) - Number(b.fiyat)
  })
}

function binlikAyir(rakam: string): string {
  return rakam.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/**
 * Bir listeyi Fatih Bey'in istediği biçimde üretir:
 *   "Komple PPF kaplamada seçeneklerimiz:
 *    • XPEL Xtreme PPF – 100.000₺ (190 mikron, 5 yıl garanti)"
 *
 * Liste bulunamazsa null döner — o durumda cevabı model yazar (melez kapsamlar
 * için bu yol açık kalmalı: "kaput + tampon" gibi istekler tabloda yok).
 */
export function fiyatListesiUret(anahtar: string): string | null {
  const tanim = LISTE_TANIMI[anahtar as ListeAnahtari]
  if (!tanim) return null

  const kalemler = sirala(
    fiyatBilgisiAl().kalemFiyatlari.filter(
      (k) => tanim.kapsam.test(k.kapsam) && MAT.test(k.urun) === Boolean(tanim.mat),
    ),
  )
  if (kalemler.length === 0) return null

  const satirlar = kalemler.map((k) => {
    const ozellikler = [k.mikron ? `${k.mikron} mikron` : null, k.garanti ? `${k.garanti} garanti` : null]
      .filter(Boolean)
      .join(', ')
    const fiyat = `${binlikAyir(k.fiyat)}₺`
    return ozellikler ? `• ${k.urun} – ${fiyat} (${ozellikler})` : `• ${k.urun} – ${fiyat}`
  })

  return [`${tanim.baslik}:`, ...satirlar].join('\n')
}
