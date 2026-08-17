// Botun cevaplarını otomatik denetler. Altın set koşusunda kırmızı bayrak üretir.
//
// Dört kontrol (Fatih Bey'in 8 Ağustos 2026 kararlarından):
//   a) FIYAT-LISTESI.md'de olmayan bir ₺ rakamı geçiyor mu
//   b) ilk cevapta rakam var mı (fiyatla açma ihlali)
//   c) indirim vaadi verilmiş mi
//   d) SUV / binek farkından bahsedilmiş mi
//
// Denetim metin üstünde çalışır, modelden bağımsızdır.

import { rakamiNormalize } from './fiyat'

export type BayrakTuru =
  | 'liste-disi-fiyat'
  | 'yanlis-kalem-fiyati'
  | 'kapsamsiz-fiyat'
  | 'ilk-cevapta-fiyat'
  | 'indirim-vaadi'
  | 'suv-binek-farki'
  | 'erken-fiyat-gorseli'

export type Bayrak = {
  tur: BayrakTuru
  aciklama: string
}

export const BAYRAK_BASLIKLARI: Record<BayrakTuru, string> = {
  'liste-disi-fiyat': 'Listede olmayan rakam',
  'yanlis-kalem-fiyati': 'Yanlış ürüne yanlış fiyat',
  'kapsamsiz-fiyat': 'Kapsam netleşmeden fiyat',
  'ilk-cevapta-fiyat': 'Fiyatla açma ihlali',
  'indirim-vaadi': 'İndirim vaadi',
  'suv-binek-farki': 'SUV / binek farkı',
  'erken-fiyat-gorseli': 'Erken fiyat görseli',
}

/**
 * İlk turda fiyat vermek serbest mi.
 *
 * ⚠ ARAÇ ŞARTI KALDIRILDI (Fatih Bey, 11 Ağustos: "standart fiyatlandırma").
 * Eskiden araç + kapsam ikisi de şarttı. Ama PPF/cam filmi fiyatı araca göre
 * değişmiyor; müşteri "fiyat ne olur" diye sorduğunda araç öğrenmek için
 * bekletmek onu cevapsız bırakmak oluyordu. Altın sette bu, bot doğru davranırken
 * ateşleyen bir yanlış alarma dönüşmüştü (Ersin Taşdelen vakası, mat PPF).
 * Fatih Bey'in verdiği çözüm: rakamı ver, gerekiyorsa "SUV modellerimizde
 * değişkenlik gösterebiliyor" notunu ekle.
 *
 * Kapsam şartı DURUYOR: "ppf ne kadar" gibi kapsamsız bir soruda hangi satırın
 * okunacağı belli değildir, orada hâlâ kapsam sorulur.
 */
export function ilkTurdaFiyatSerbestMi(yapili: {
  niyet: string
  arac: string | null
  kapsam: string | null
}): boolean {
  const fiyatSorusu = yapili.niyet === 'fiyat-net' || yapili.niyet === 'fiyat-genel'
  return fiyatSorusu && Boolean(yapili.kapsam)
}

/**
 * Metindeki rakamların hepsi SABİT FİYATLI bir hizmete mi ait.
 *
 * PPF ve cam filmi tablolarında bir işin fiyatı ürüne ve kapsama göre değişir;
 * orada kapsam netleşmeden rakam vermek yasak. Ama seramik kaplama (Nasiol
 * ZR53, 17.500₺), pasta cila, far kaplama gibi kalemlerin tek fiyatı var ve
 * araca göre değişmiyor — orada "önce aracınızı söyleyin" demek müşteriyi
 * boşuna oyalamak oluyor. Rakam tabloda hiç geçmiyorsa sabit fiyatlı kalemdir.
 */
export function sabitFiyatliKalemMi(
  rakamlar: string[],
  kalemFiyatlari?: { fiyat: string }[],
): boolean {
  if (rakamlar.length === 0 || !kalemFiyatlari || kalemFiyatlari.length === 0) return false
  const tabloRakamlari = new Set(kalemFiyatlari.map((k) => k.fiyat))
  return rakamlar.every((r) => !tabloRakamlari.has(r))
}

/** Metinde geçen para rakamlarını normalize edilmiş halde döndürür ("18000"). */
export function fiyatRakamlariniBul(metin: string): string[] {
  const bulunanlar: string[] = []

  // "18.000₺", "18.000 TL", "18000 tl", "750 lira"
  // DİKKAT: kelime sınırı (\b) sadece harfli birimlere konur. "₺" harf olmadığı
  // için ardına \b koymak eşleşmeyi tamamen öldürüyor.
  const sonek = /(\d[\d.,\s]*\d|\d)\s*(?:₺|(?:tl|try|lira)\b)/gi
  // "₺18.000". \s DEĞİL [ \t]: satır sonundaki "12.000₺" ile bir sonraki
  // satırın başındaki rakamı ("5 cam komple...") birleştirip uydurma fiyat
  // sanıyordu. Önek biçimi her zaman aynı satırdadır.
  const onek = /₺[ \t]*(\d[\d.,]*\d|\d)/g

  for (const kalip of [sonek, onek]) {
    let eslesme: RegExpExecArray | null
    while ((eslesme = kalip.exec(metin)) !== null) {
      const normal = rakamiNormalize(eslesme[1])
      if (normal !== '') bulunanlar.push(normal)
    }
  }

  return bulunanlar
}

export type DenetimBaglami = {
  /** Konuşmanın ilk bot cevabı mı. Fiyatla açma kuralı buna bakıyor. */
  ilkCevapMi: boolean
  /** FIYAT-LISTESI.md'den gelen izinli rakamlar, normalize. */
  izinliRakamlar: Set<string>
  /** Fiyatı teyit bekleyen iş adları. Bunlara rakam verilmesi de ihlaldir. */
  teyitBekleyenIsler?: string[]
  /**
   * Bu turda fiyat listesi görseli gönderildi mi ve fiyat verilebilir miydi.
   * Görsel de rakamdır: metin denetimi onu göremediği için ayrıca sorulur.
   */
  fiyatGorseliGonderildiMi?: boolean
  fiyatVerilebilirMi?: boolean
  /**
   * İlk turda fiyat vermek serbest mi. Müşteri araç + kapsamı eksiksiz verip
   * açıkça fiyat sorduysa true olur (motor tarafında niyet === 'fiyat-net' ve
   * arac/kapsam dolu olmasından anlaşılır).
   */
  ilkTurdaFiyatSerbestMi?: boolean
  /** Ürün × kapsam → fiyat tablosu (fiyat.ts). Kalem eşleşmesi için. */
  kalemFiyatlari?: { urun: string; kapsam: string; fiyat: string }[]
}

/** Metinde geçebilecek kapsam ifadeleri → tablo sütun adı. */
const KAPSAM_KALIPLARI: { kalip: RegExp; sutun: string }[] = [
  { kalip: /ön\s*3\s*par[çc]a/i, sutun: 'Ön 3 parça' },
  { kalip: /ön\s*4\s*par[çc]a/i, sutun: 'Ön 4 parça' },
  { kalip: /\bkomple\b|tam kapsam|full kaplama/i, sutun: 'Komple' },
  { kalip: /\bkaput\b/i, sutun: 'Kaput' },
]

/**
 * Kalem-rakam eşleşmesi.
 *
 * Metinde TEK bir ürün ve TEK bir kapsam geçiyorsa, o ikilinin listedeki
 * fiyatı metinde geçmeli. Geçmiyorsa bot fiyatı başka bir kalemden almış
 * demektir — 9 Ağustos'taki "XPEL Xtreme ön 4 parça 25.000₺" hatası böyleydi
 * (doğrusu 35.000₺; 25.000 Global'in fiyatı).
 *
 * Tek ürün + tek kapsam şartı bilinçli: birden fazla seçenek sıralayan
 * karşılaştırma cevaplarında yanlış alarm vermesin.
 */
function yanlisKalemFiyatiBul(
  metin: string,
  rakamlar: string[],
  kalemler: { urun: string; kapsam: string; fiyat: string }[],
): string | null {
  if (kalemler.length === 0 || rakamlar.length === 0) return null

  const kucuk = metin.toLocaleLowerCase('tr')

  // Ürün adları uzundan kısaya: "XPEL Ultimate Plus" önce eşleşsin,
  // "XPEL" parçası başka ürünle karışmasın.
  const urunler = [...new Set(kalemler.map((k) => k.urun))].sort(
    (a, b) => b.length - a.length,
  )
  const gecenUrunler = urunler.filter((u) => kucuk.includes(u.toLocaleLowerCase('tr')))
  if (gecenUrunler.length !== 1) return null

  // "XPEL Xtreme PPF" metinde geçince "XPEL Xtreme PPF (MAT)" de eşleşebilir;
  // en uzun eşleşme zaten başa alındığı için ilkini alıyoruz.
  const urun = gecenUrunler[0]

  const gecenKapsamlar = KAPSAM_KALIPLARI.filter((k) => k.kalip.test(metin))
  if (gecenKapsamlar.length !== 1) return null
  const kapsam = gecenKapsamlar[0].sutun

  const kalem = kalemler.find((k) => k.urun === urun && k.kapsam === kapsam)
  if (!kalem) return null

  if (rakamlar.includes(kalem.fiyat)) return null

  return `"${urun}" + "${kapsam}" için doğru fiyat ${kalem.fiyat}, metinde geçen: ${[...new Set(rakamlar)].join(', ')}`
}

/**
 * KODUN eklediği toplam satırı (motor/index.ts `toplamiEkle`). Müşteri toplam
 * sorunca izinli kalem fiyatları deterministik toplanıp bu kalıpla ekleniyor;
 * toplamın kendisi listede olmadığı için denetim onu "liste dışı" sanmamalı
 * (16 Ağustos). Kalıp birebir kod üretimi — model bu cümleyi kendisi kurarsa
 * da aritmetiği kod yapmış kadar güvenli değil ama rakam yine kalemlerin
 * toplamı olmak zorunda; kalıba uymayan her toplam bayraklanmaya devam eder.
 */
const KOD_TOPLAM_SATIRI = /^Seçtiğiniz kalemlerin toplamı [\d.,]+₺ oluyor\.$/m

export function bayraklariBul(metin: string, baglam: DenetimBaglami): Bayrak[] {
  const bayraklar: Bayrak[] = []
  const rakamlar = fiyatRakamlariniBul(metin.replace(KOD_TOPLAM_SATIRI, ''))

  // (e) fiyat görseli, metin denetiminin kör noktası. Görselde bütün rakamlar
  // var; ilk cevapta ya da kapsam netleşmeden gönderilmesi fiyatla açma
  // yasağını metne hiç rakam yazmadan deler.
  if (baglam.fiyatGorseliGonderildiMi) {
    // İlk turda fiyat vermek serbestse (araç + kapsam eksiksiz, fiyat soruldu)
    // görsel de serbesttir — rakamı vermeye hakkı varken listeyi göndermesi
    // ihlal değil.
    if (baglam.ilkCevapMi && !baglam.ilkTurdaFiyatSerbestMi) {
      bayraklar.push({
        tur: 'erken-fiyat-gorseli',
        aciklama: 'ilk cevapta fiyat listesi görseli gönderilmiş (fiyatla açma)',
      })
    } else if (baglam.fiyatVerilebilirMi === false) {
      bayraklar.push({
        tur: 'erken-fiyat-gorseli',
        aciklama: 'araç/kapsam netleşmeden fiyat listesi görseli gönderilmiş',
      })
    }
  }

  // (a) listede olmayan rakam
  const listeDisi = [...new Set(rakamlar)].filter((r) => !baglam.izinliRakamlar.has(r))
  if (listeDisi.length > 0) {
    bayraklar.push({
      tur: 'liste-disi-fiyat',
      aciklama: `fiyat listesinde olmayan rakam(lar): ${listeDisi.join(', ')}`,
    })
  }

  // (a1) doğru ürüne yanlış fiyat. Rakam listede olduğu için (a) bunu görmez.
  if (baglam.kalemFiyatlari) {
    const uyumsuzluk = yanlisKalemFiyatiBul(metin, rakamlar, baglam.kalemFiyatlari)
    if (uyumsuzluk) {
      bayraklar.push({ tur: 'yanlis-kalem-fiyati', aciklama: uyumsuzluk })
    }
  }

  // (a2) rakamın kendisi listede olsa bile, fiyatı teyit bekleyen bir işe
  // rakam söylemek ihlaldir (ör. arka tampon PPF için 10.000 demek).
  if (rakamlar.length > 0 && listeDisi.length === 0) {
    const kucukMetin = metin.toLocaleLowerCase('tr')
    const gecen = (baglam.teyitBekleyenIsler ?? []).filter((is) =>
      kucukMetin.includes(is.toLocaleLowerCase('tr')),
    )
    if (gecen.length > 0) {
      bayraklar.push({
        tur: 'liste-disi-fiyat',
        aciklama: `fiyatı teyit bekleyen işe rakam verilmiş: ${gecen.join(', ')}`,
      })
    }
  }

  // (b) ilk cevapta rakam
  //
  // İstisna (İsa onayı, 9 Ağustos): müşteri ilk mesajında hem aracını hem
  // kapsamı eksiksiz verip açıkça fiyat sorduysa rakam serbest. Kuralın amacı
  // eksik bilgiyle fiyat vermemek; burada sorulacak bir şey kalmamıştır ve
  // müşteriyi bir tur bekletmek satış kaybettiriyor.
  if (
    baglam.ilkCevapMi &&
    rakamlar.length > 0 &&
    !baglam.ilkTurdaFiyatSerbestMi &&
    !sabitFiyatliKalemMi(rakamlar, baglam.kalemFiyatlari)
  ) {
    bayraklar.push({
      tur: 'ilk-cevapta-fiyat',
      aciklama: `ilk cevapta fiyat verilmiş: ${[...new Set(rakamlar)].join(', ')}`,
    })
  }

  // (b2) HER TURDA: modelin kendisi "fiyat verilemez" derken metne rakam
  // yazmışsa bu bir çelişkidir. Eski kontrol yalnızca ilk mesaja bakıyordu;
  // bot ısrarla sorulunca 3. turda araç/kapsam olmadan tüm fiyat listesini
  // döküyor ve kimse görmüyordu (test ajanı bulgusu, 10 Ağustos).
  //
  // Eşik 3: modelin `fiyat_verilebilir_mi` alanı tam güvenilir değil — kapsamı
  // net bir soruda doğru fiyatı verirken bile bazen false işaretliyor. Asıl
  // yakalamak istediğimiz davranış "araç/kapsam yokken fiyat listesini dökmek",
  // o da üç ya da daha fazla rakamla oluyor. Bir-iki rakam meşru cevap olabilir.
  const AZAMI_SERBEST_RAKAM = 2
  if (
    !baglam.ilkCevapMi &&
    baglam.fiyatVerilebilirMi === false &&
    new Set(rakamlar).size > AZAMI_SERBEST_RAKAM
  ) {
    bayraklar.push({
      tur: 'kapsamsiz-fiyat',
      aciklama:
        `araç/kapsam netleşmeden fiyat verilmiş (fiyat_verilebilir_mi=false): ` +
        `${[...new Set(rakamlar)].join(', ')}`,
    })
  }

  // (c) indirim vaadi
  if (/indirim|iskonto|kampanyalı fiyat/i.test(metin) && !/firma yetkilimiz/i.test(metin)) {
    bayraklar.push({
      tur: 'indirim-vaadi',
      aciklama: 'indirimden bahsedilmiş ama Fatih Bey\'in onaylı cümlesi kullanılmamış',
    })
  }

  // (d) SUV / binek farkı
  //
  // "SUV farkı YOK" demek ihlal değil, kuralın ta kendisi. Olumsuzlama varsa
  // bayraklamıyoruz; yoksa botun doğru cümlesi kırmızı bayrak üretiyordu
  // (altın set 9 Ağustos: "SUV veya binek farkı bulunmuyor" bayraklanmıştı).
  // ⚠ 12 Ağustos: "SUV ile binek arasında fiyat farkı YOK" da yanlış bilgidir.
  // Fatih Bey artık "SUV modellerimizde değişkenlik gösterebiliyor" diyor ve
  // görsel listenin dipnotu da "SUV/ticaride fark uygulanabilir" yazıyor. Bot
  // "fark yok" diye taahhüt verirse SUV müşterisi geldiğinde işletme savunmasız
  // kalır (Madde 9.2). Eski kod bu yönü olumsuzlama sayıp bayrağı BASTIRIYORDU.
  if (
    /\bsuv\b|ticari araç/i.test(metin) &&
    /(fark|fiyat|ücret)[^.!?]{0,40}\b(yok|yoktur|bulunmuyor|bulunmamaktadır|aynı)\b/i.test(metin)
  ) {
    bayraklar.push({
      tur: 'suv-binek-farki',
      aciklama: 'SUV/binek farkı YOK diye taahhüt verilmiş (fark uygulanabilir)',
    })
  }

  const suvOlumsuzlama = /\b(yok|yoktur|bulunmuyor|bulunmamaktadır|olmuyor|uygulanmıyor|aynı)\b/i
  // ⚠ 11 Ağustos: Fatih Bey "SUV modellerimiz için fiyatlarda değişkenlik
  // gösterebiliyor diyebiliriz" dedi. Bu cümle artık İZİNLİ — 8 Ağustos'taki
  // "SUV farkından hiç bahsetme" kuralının yerini aldı.
  // Yasak olan hâlâ duruyor: araca göre RAKAM DEĞİŞTİRMEK, "SUV olduğu için
  // 15.000 fark var" gibi somut bir zam söylemek.
  const izinliDegiskenlik = /değişkenlik|değişebil|farklılık göster|farklılık gösterebil/i
  if (
    /\bsuv\b|ticari araç/i.test(metin) &&
    /fark|fiyat|ücret|ek ödeme/i.test(metin) &&
    !suvOlumsuzlama.test(metin) &&
    !izinliDegiskenlik.test(metin)
  ) {
    bayraklar.push({
      tur: 'suv-binek-farki',
      aciklama: 'araç tipine göre somut fiyat farkı söylenmiş (rakam değiştirilemez)',
    })
  }

  return bayraklar
}

/**
 * Denetimin kendi testi: bilerek bozuk dört metin.
 * Rapora eklenir ki kontrollerin gerçekten ateşlediği görülsün.
 */
export const OZ_TEST_ORNEKLERI: { tur: BayrakTuru; metin: string; ilkCevapMi: boolean }[] = [
  {
    tur: 'liste-disi-fiyat',
    metin: 'Ön 3 parça için 19.750₺ yardımcı olurum.',
    ilkCevapMi: false,
  },
  {
    // Fatih Bey'in 9 Ağustos ekran görüntüsündeki gerçek hata.
    // 25.000 Global'in fiyatı; XPEL Xtreme ön 4 parça 35.000₺.
    tur: 'yanlis-kalem-fiyati',
    metin:
      'Peugeot 408 için ön 4 parça PPF 25.000₺\'dir. XPEL Xtreme PPF kullanıyoruz, 5 yıl garantilidir.',
    ilkCevapMi: false,
  },
  {
    // NOT: Bu satır eskiden "Arka tampon PPF 10.000₺" idi ve KAÇIRILDI diye
    // raporlanıyordu. Kalem 8 Ağustos'ta Bölüm 2b'ye 10.000₺ olarak eklenince
    // cümle DOĞRU oldu; kaçırılan bir hata değil, eskimiş bir beklentiydi.
    // Yerine gerçekten listede olmayan bir rakam kondu.
    tur: 'liste-disi-fiyat',
    metin: 'Arka tampon PPF (tek parça komple uygulama) için 11.750₺ ücretiniz olur.',
    ilkCevapMi: false,
  },
  {
    tur: 'ilk-cevapta-fiyat',
    metin: 'Merhabalar, ön 3 parça PPF 18.000₺.',
    ilkCevapMi: true,
  },
  {
    tur: 'indirim-vaadi',
    metin: 'Size %10 indirim yapabiliriz.',
    ilkCevapMi: false,
  },
  {
    tur: 'suv-binek-farki',
    metin: 'Aracınız SUV olduğu için fiyatta fark oluyor.',
    ilkCevapMi: false,
  },
]
