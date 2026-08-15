// Yanıt motorunun dış yüzü.
//
// Kullanım:
//   import { yanitUret } from '@/lib/motor'
//   const yanit = await yanitUret({ konusma: [{ rol: 'musteri', metin: '...' }] })
//
// Sağlayıcı ve model ortam değişkeninden gelir (bkz. saglayici.ts).
// Bu dosya sunucu tarafı içindir; anahtarlar tarayıcıya gitmez.

import { anthropicSaglayici } from './anthropic'
import { geminiSaglayici } from './gemini'
import { geminiLiteSaglayici } from './gemini-lite'
import { openaiSaglayici } from './openai'
import { sahteSaglayici } from './sahte'
import { fiyatRakamlariniBul, ilkTurdaFiyatSerbestMi } from './denetim'
import { fiyatBilgisiAl, fiyatListesiUret } from './fiyat'
import { saglayiciAdiCoz, type Saglayici, type SaglayiciAdi } from './saglayici'
import { sistemPromptUret } from './sistem-prompt'
import type { EgitimIcerigi, MotorYanit, YanitGirdi } from './types'

export function saglayiciAl(ad?: string | null, model?: string): Saglayici {
  const secilen: SaglayiciAdi = saglayiciAdiCoz(ad)
  switch (secilen) {
    case 'openai':
      return openaiSaglayici(model)
    case 'gemini':
      return geminiSaglayici(model)
    case 'gemini-lite':
      return geminiLiteSaglayici(model)
    case 'anthropic':
      return anthropicSaglayici(model)
    case 'sahte':
      return sahteSaglayici(model)
  }
}

/**
 * Cevabın müşteriye gitmeden önce taşıması ZORUNLU olan parçalar.
 *
 * Bunlar promptta da yazılı ama prompt tek başına yetmiyor: aynı soruya aynı
 * modelin verdiği cevap turdan tura değişiyor. 11 Ağustos ölçümü — "Toyota
 * Corolla cam filmi" sorusunda 3 koşudan yalnızca 1'i selamlayıp adı kullandı;
 * "fiyat araştırıyorum" turunda 3 koşudan 1'i fiyat listesini hiç dökmeden
 * "seçeneklerimiz XPEL ve Global oluyor" deyip cümleyi bitirdi (Fatih Bey'in
 * "en sonda afallıyor" dediği kusur). İkisi de doğrudan satış kaybı.
 *
 * Bu yüzden kural KODDA: eksik varsa cevap müşteriye gitmez, bir düzeltme
 * turuyla yeniden üretilir. Aynı desen Togg filtresi ve fiyat görseli kilidinde
 * de kullanıldı — kritik kural prompta bırakılmaz.
 */
/**
 * `agir`: bu eksik müşteriye YANLIŞ ya da eksik BİLGİ gönderiyor mu.
 *
 * Neden ayrım (Fatih Bey, 13 Ağustos: "bot yazıyor diye 2 dakika kalıyor"):
 * düzeltme turu cevabın TAMAMINI baştan yazdırıyor ve süreyi ikiye katlıyor —
 * ölçüldü: 94 sn'lik turun 47 sn'si ikinci çağrıydı. Yanlış fiyat için bu
 * bedele değer; "cümleyi tekrar etti" gibi biçimsel bir kusur için değmez,
 * hele müşteri zaten uzun süredir bekliyorken. Ağır olmayanlar kod
 * müdahalesiyle düzeltilir ya da olduğu gibi gider.
 */
type Eksik = { ad: string; talimat: string; agir?: boolean }

/**
 * Türkçede iki cinsiyette de kullanılan isimler. Bunlarda hitap ATLANIR —
 * "Deniz bey" demek yazı-tura atmaktır. Liste promptta da var; ikisi aynı
 * kalmalı (11 Ağustos: promptun kendi içindeki çelişki "Deniz bey" ürettiriyordu).
 */
/**
 * Hitabı KESİN bilinen isimler. Promptta da sayılıyor; buradaki kopya, düzeltme
 * turu da tutmadığında selamlamayı kodla kurabilmek için var.
 * Listede olmayan isimde hitap UYDURULMAZ — sadece ad kullanılır.
 */
const ERKEK_ISIMLER = new Set([
  'ahmet', 'mehmet', 'ali', 'mustafa', 'hasan', 'hüseyin', 'huseyin', 'ibrahim', 'i̇brahim',
  'emre', 'burak', 'kerim', 'ferdi', 'murat', 'serkan', 'fatih', 'osman', 'yusuf', 'furkan',
  'cemal', 'samed', 'ersin', 'berkant', 'okan', 'volkan', 'tolga', 'kaan', 'onur', 'barış',
  'baris', 'selim', 'halil', 'ramazan', 'yasin', 'enes', 'eren', 'metin', 'süleyman', 'suleyman',
])

const KADIN_ISIMLER = new Set([
  'ayşe', 'ayse', 'fatma', 'zeynep', 'elif', 'merve', 'tuğçe', 'tugce', 'selin', 'betül',
  'betul', 'emine', 'hatice', 'özlem', 'ozlem', 'esra', 'büşra', 'busra', 'seda', 'gamze',
  'melis', 'ceren', 'sude', 'ebru', 'pınar', 'pinar', 'aslı', 'asli', 'dilek', 'nazlı', 'nazli',
])

function hitapCoz(isim: string): string | null {
  const k = isim.toLocaleLowerCase('tr')
  if (UNISEX_ISIMLER.has(k)) return null
  if (ERKEK_ISIMLER.has(k)) return 'bey'
  if (KADIN_ISIMLER.has(k)) return 'hanım'
  return null
}

/**
 * Fiyat listesini TEK baloncukta topla (Fatih Bey, 11 Ağustos: "fiyat konusundaki
 * bölümü tek atsın").
 *
 * Model her liste maddesini ayrı mesaj olarak üretiyordu; WhatsApp'ta beş ayrı
 * baloncuk hâlinde düşüyor ve okunması zorlaşıyor. Sıradan cümleler ayrı
 * baloncuk kalmalı (sahadaki ton öyle), ama liste tek parça gitmeli.
 *
 * Blok, listeyi açan cümleyi de içerir: "Komple kaplamada seçeneklerimiz:"
 * gibi iki nokta ile biten giriş, listenin başına yapıştırılır.
 */
const LISTE_SATIRI = /^\s*(•|✅|▪|·|-|\*)\s*\S/

/**
 * Ürün başlığı satırı: "XPEL Xtreme – 100.000₺" gibi, fiyatla biten kısa satır.
 * Sonnet listeyi bu biçimde üretiyor (başlık + altında • maddeleri) ve her ürün
 * ayrı baloncuğa düşüyordu.
 */
const URUN_BASLIGI = /^[^\n]{0,70}\d{1,3}[.,]\d{3}\s*₺/

function listeyiTekMesajaTopla(mesajlar: string[]): string[] {
  const cikti: string[] = []

  for (const mesaj of mesajlar) {
    const oncekiIndeks = cikti.length - 1
    const onceki = cikti[oncekiIndeks]
    const ilkSatir = mesaj.split('\n')[0] ?? ''
    const listeParcasi = LISTE_SATIRI.test(mesaj) || URUN_BASLIGI.test(ilkSatir.trim())

    if (listeParcasi && onceki !== undefined) {
      // ⚠ Önceki mesajın SON satırına bakmak yetmiyor. 12 Ağustos'ta ürünlerin
      // altına özellik maddeleri eklendi; liste artık "190 mikron, üstün
      // parlaklık" gibi bir özellik satırıyla bitiyor ve o satır liste kalıbına
      // uymadığı için birleştirme kaçıyordu — fiyat listesi iki baloncuğa
      // bölünüyordu (Fatih Bey: "fiyat kısmını tek atsın").
      // Doğru soru: önceki mesaj bir LİSTE Mİ, nerede bittiği değil.
      const oncekiSatirlar = onceki.split('\n')
      const oncekiListe =
        oncekiSatirlar.some((s) => LISTE_SATIRI.test(s) || URUN_BASLIGI.test(s.trim())) ||
        /:\s*$/.test(onceki)
      if (oncekiListe) {
        cikti[oncekiIndeks] = `${onceki}\n${mesaj.trim()}`
        continue
      }
    }

    cikti.push(mesaj)
  }

  return cikti
}

/**
 * Son çare: düzeltme turu da listeyi tekrarladıysa, zaten verilmiş fiyat
 * satırlarını kodla çıkar.
 *
 * Ölçüm (11 Ağustos, cam filmi senaryosu): ham model 1/3, somut "şu rakamları
 * yazma" talimatıyla 4/5. Kalan kaçak için model bir daha zorlanmaz — müşteriye
 * aynı listeyi ikinci kez okutmak Fatih Bey'in "gene sapıtıyor" dediği kusur.
 *
 * Yalnızca TAMAMEN tekrar olan satırlar atılır: içinde daha önce verilmemiş bir
 * rakam varsa satır korunur, yoksa yeni bilgiyi de silmiş oluruz.
 */
function tekrarSatirlariniAt(mesajlar: string[], oncekiRakamlar: Set<string>): string[] {
  const temiz = mesajlar
    .map((mesaj) =>
      mesaj
        .split('\n')
        .filter((satir) => {
          const rakamlar = fiyatRakamlariniBul(satir)
          if (rakamlar.length === 0) return true
          return !rakamlar.every((r) => oncekiRakamlar.has(r))
        })
        .join('\n')
        .trim(),
    )
    .filter((m) => m !== '')

  // Her şey silindiyse konuşmayı yine de ilerlet; boş cevap gönderilmez.
  return temiz.length > 0
    ? temiz
    : ['Tamamdır, not aldım. Uygun olduğunuz günü paylaşırsanız randevunuzu planlayalım.']
}

function sadelestir(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Cümlenin anlamlı kelimeleri. Birebir metin karşılaştırması yetmiyordu: bot
 * "Komple uygulamaDA … dahildir" ile "Komple uygulamaLARDA … dahildir" arasında
 * gidip geliyor ve tek harf farkı tekrarı gizliyordu (12 Ağustos).
 */
function kelimeKumesi(s: string): Set<string> {
  return new Set(sadelestir(s).split(' ').filter((k) => k.length > 3))
}

/** Bu cümlenin kelimelerinin %80'i daha önce söylendiyse tekrardır. */
function cumleTekrariMi(cumle: string, oncekiKelimeler: Set<string>): boolean {
  const c = cumle.trim()
  if (c.length < 45) return false
  const kelimeler = [...kelimeKumesi(c)]
  if (kelimeler.length < 4) return false
  return kelimeler.filter((k) => oncekiKelimeler.has(k)).length / kelimeler.length >= 0.8
}

/**
 * Modelin seçtiği hazır fiyat listesini cevaba yerleştirir.
 *
 * Model listeyi YAZMIYOR, sadece hangisini istediğini söylüyor (`fiyat_listesi`).
 * Metni `fiyatListesiUret` basıyor — FIYAT-LISTESI.md'den, tek kaynaktan.
 *
 * Yerleştirme kuralı: liste, ilk mesajdan SONRA gelir. Böylece Fatih Bey'in
 * istediği yapı korunur — önce sıcak açılış cümlesi, sonra liste, sonra öneri
 * ve kapanış sorusu.
 *
 * ⚠ Model yine de kendi listesini yazdıysa (eski alışkanlık) o satırlar atılır:
 * aynı fiyatlar iki kez görünmesin.
 */
function hazirListeyiYerlestir(mesajlar: string[], anahtar: string | null): string[] {
  if (!anahtar) return mesajlar
  const liste = fiyatListesiUret(anahtar)
  if (!liste) return mesajlar

  const listeRakamlari = new Set(fiyatRakamlariniBul(liste))

  // Modelin kendi yazdığı fiyat satırlarını ayıkla: hazır liste onları zaten
  // içeriyor, ikisi birden giderse müşteri aynı rakamları iki kez okur.
  const temiz = mesajlar
    .map((mesaj) =>
      mesaj
        .split('\n')
        .filter((satir) => {
          const rakamlar = fiyatRakamlariniBul(satir)
          return rakamlar.length === 0 || !rakamlar.every((r) => listeRakamlari.has(r))
        })
        .join('\n')
        .trim(),
    )
    .filter((m) => m !== '')

  if (temiz.length === 0) return [liste]
  return [temiz[0], liste, ...temiz.slice(1)]
}

/**
 * Hafif (bilgi doğruluğunu bozmayan) eksikleri MODEL ÇAĞIRMADAN düzeltir.
 *
 * Süre bütçesi aşıldığında ikinci tura çıkmıyoruz; ama elde kalan cevabı da
 * olduğu gibi göndermek zorunda değiliz. Deterministik olarak onarılabilenler
 * burada onarılır — model çağrısı 40+ saniye, bu işlem mikrosaniye.
 */
function hafifEksikleriKodlaDuzelt(
  mesajlar: string[],
  eksikler: Eksik[],
  baglam: { isim?: string | null; oncekiBotMetni?: string },
): string[] {
  let sonuc = mesajlar
  const adlar = new Set(eksikler.map((e) => e.ad))

  // Selamlama + isim: cümle deterministik kurulabiliyor.
  const isim = baglam.isim?.trim()
  if (adlar.has('selamlama-isim') && isim) sonuc = selamlamaEkle(sonuc, isim)

  // Aynı fiyat listesini ikinci kez yazmak: tekrar satırları atılır.
  if (adlar.has('liste-tekrari')) {
    sonuc = tekrarSatirlariniAt(sonuc, new Set(fiyatRakamlariniBul(baglam.oncekiBotMetni ?? '')))
  }

  // Önceki turda AYNEN söylenmiş cümleyi tekrar etmek (Fatih Bey: "sürekli aynı
  // şekilde tekrarlıyor"). Tekrar eden cümleyi ATMAK için modele ihtiyaç yok.
  if (adlar.has('cumle-tekrari')) {
    const oncekiKelimeler = kelimeKumesi(baglam.oncekiBotMetni ?? '')
    sonuc = sonuc
      .map((mesaj) =>
        mesaj
          .split('\n')
          .filter((satir) => !cumleTekrariMi(satir, oncekiKelimeler))
          .join('\n')
          .trim(),
      )
      .filter((m) => m !== '')
    if (sonuc.length === 0) sonuc = mesajlar
  }

  return sonuc
}

/**
 * Son çare: düzeltme turu da ismi kullanmadıysa selamlamayı kodla kur.
 * Ölçüm (11 Ağustos, "Ayşe" + cam filmi sorusu): ilk tur 4/4 ismi atlıyor,
 * düzeltme turu 3/4 kurtarıyor. Kalan %25 için model bir daha zorlanmaz —
 * cümle deterministik olarak eklenir.
 */
function selamlamaEkle(mesajlar: string[], isim: string): string[] {
  const hitap = hitapCoz(isim)
  const selam = `Merhabalar ${isim}${hitap ? ` ${hitap}` : ''}, hoşgeldiniz.`

  const kalan = [...mesajlar]
  // İlk mesaj zaten "Merhabalar" ile açıyorsa o kelimeyi kırp; yoksa selamlama
  // iki kez üst üste gelir.
  if (kalan[0]) {
    kalan[0] = kalan[0].replace(/^\s*(merhabalar|merhaba|selam)\s*[,.!]?\s*/i, '').trim()
    if (kalan[0] === '') kalan.shift()
  }

  return [selam, ...kalan]
}

const UNISEX_ISIMLER = new Set([
  'deniz',
  'evren',
  'yağmur',
  'yagmur',
  'umut',
  'özgür',
  'ozgur',
  'şevval',
  'sevval',
  'bahar',
  'nur',
  'sevgi',
  'ışık',
  'isik',
  'toprak',
  'derya',
  'gökçe',
  'gokce',
  'aytaç',
  'aytac',
])

/** Yanıtın mesajlarını değiştirip metin alanını da tutarlı tutar. */
function mesajlariDegistir(yanit: MotorYanit, mesajlar: string[]): MotorYanit {
  return {
    ...yanit,
    metin: mesajlar.join('\n'),
    yapili: { ...yanit.yapili, mesajlar },
  }
}

/**
 * Dışa açık, çünkü kilitlerin kendisi API'siz sınanabilmeli: Fatih Bey'in
 * ekran görüntülerindeki GERÇEK bozuk çıktılar buraya girdi olarak verilip
 * yakalanıp yakalanmadığı ölçülüyor (bkz. scripts/kilit-dogrula.ts).
 * Model bakiyesi bittiğinde bile bu sınav koşar.
 */
/**
 * Panelden eklenen eğitim içeriğinde geçen fiyat rakamları.
 *
 * ⚠ Şart: denetim onaylı listede olmayan her rakamı "uydurma fiyat" sayıyor.
 * Fatih Bey panelden yeni bir hizmet ve fiyatını eklediğinde bot onu
 * söyleyebilmeli, kendi eklediği bilgi yüzünden düzeltme turuna girmemeli.
 */
export function egitimRakamlariniBul(egitim?: EgitimIcerigi): string[] {
  if (!egitim) return []
  const metin = [...egitim.bilgi, ...egitim.davranis, ...egitim.reklam]
    .map((s) => `${s.baslik} ${s.icerik}`)
    .join('\n')
  return fiyatRakamlariniBul(metin)
}

export function eksikleriBul(
  yapili: MotorYanit['yapili'],
  baglam: {
    ilkCevapMi: boolean
    isim?: string | null
    /** Daha önce bota söylettiğimiz her şey — tekrar kontrolü için. */
    oncekiBotMetni?: string
    /** Müşterinin bu turdaki mesajı — fiyat mı soruyor, tekrar mı istiyor. */
    sonMusteriMetni?: string
    /** Müşterinin konuşma boyunca yazdığı her şey — neyi istedi/istemedi. */
    tumMusteriMetni?: string
    /**
     * Onaylı fiyat listesinde OLMAYAN ama yine de meşru rakamlar: Fatih Bey'in
     * panelden eklediği bilgi ve kampanyalarda geçenler.
     */
    ekIzinliRakamlar?: Set<string>
  },
): Eksik[] {
  const eksikler: Eksik[] = []
  const mesajlar = yapili.mesajlar
  const ilkMesaj = mesajlar[0] ?? ''
  const tumMetin = mesajlar.join('\n')

  // 1) İlk cevapta selamlama + isim. Adı bilirken "Tamamdır, ..." diye girmek
  //    müşteriye soğuk geliyor (Fatih Bey, 9 ve 11 Ağustos).
  const isim = baglam.isim?.trim()
  if (baglam.ilkCevapMi && isim) {
    const selamVar = /merhaba|selam|hoş\s?geldin|hoşgeldin|iyi günler/i.test(ilkMesaj)
    const isimVar = ilkMesaj.toLocaleLowerCase('tr').includes(isim.toLocaleLowerCase('tr'))
    if (!selamVar || !isimVar) {
      eksikler.push({
        ad: 'selamlama-isim',
        talimat:
          `İLK mesajın selamlama ve müşterinin adıyla başlamak ZORUNDA: ` +
          `"Merhabalar ${isim} bey/hanım, hoşgeldiniz." biçiminde (hitabı yukarıdaki ` +
          `kurala göre seç). Doğrudan "Tamamdır" ya da konuya girerek başlama.`,
      })
    }
  }

  // 1b) Unisex isimde cinsiyet TAHMİN ETME.
  //     "Ayşe bey" felaketinin ikizi: "Deniz bey" de %50 yanlış. Prompt bunu
  //     söylüyordu ama 3/3 koşuda "Deniz bey" çıktı — çünkü promptun kendisi
  //     çelişiyordu (örnek olarak "Özgür bey" veriliyor, sonra Özgür unisex
  //     listesine konuyordu). Çelişki giderildi, kural buraya da kilitlendi.
  if (isim && UNISEX_ISIMLER.has(isim.toLocaleLowerCase('tr'))) {
    const hitapKalibi = new RegExp(`${isim}\\s*(bey|hanım|hanim)`, 'i')
    if (hitapKalibi.test(tumMetin)) {
      eksikler.push({
        ad: 'unisex-hitap',
        talimat:
          `"${isim}" hem erkek hem kadın ismi olabilir. "bey" ya da "hanım" EKLEME, ` +
          `cinsiyet tahmin etme. Sadece adıyla hitap et: "Merhabalar ${isim}, hoşgeldiniz".`,
      })
    }
  }

  // 2) Fiyat verilebilir dedin ve müşteri fiyat sordu → RAKAMLARI yaz.
  //    "Seçeneklerimiz XPEL ve Global oluyor" deyip listeyi atlamak, müşteriyi
  //    fiyat sorduğu yerde cevapsız bırakmaktır.
  //    Niyet etiketine tek başına güvenmiyoruz: "3M, STEK'ten de fiyat topluyorum"
  //    mesajı 'hizmet-bilgi' etiketlenip fiyat beklentisi düşüyordu. Müşterinin
  //    kendi sözünde fiyat geçiyorsa niyet ne derse desin rakam beklenir.
  const fiyatSorusu = yapili.niyet === 'fiyat-net' || yapili.niyet === 'fiyat-genel'
  const musteriFiyatDedi = /fiyat|ücret|ne kadar|kaç para|tutar|kaça/i.test(
    baglam.sonMusteriMetni ?? '',
  )
  const yeniRakamlar = fiyatRakamlariniBul(tumMetin)

  // Kısmi mat istisnası: o hizmet YAPILMIYOR, onaylı rakamı da yok. Böyle bir
  // soruda "rakam yaz" demek botu fiyat uydurmaya iter — kuralın tam tersi.
  const kismiMatSorusu =
    /(kaput|ön\s*3|ön\s*4|kısmi)[^.\n]{0,25}mat|mat[^.\n]{0,25}(kaput|ön\s*3|ön\s*4|kısmi)/i.test(
      baglam.tumMusteriMetni ?? baglam.sonMusteriMetni ?? '',
    )

  if (
    yapili.fiyat_verilebilir_mi &&
    (fiyatSorusu || musteriFiyatDedi) &&
    yeniRakamlar.length === 0 &&
    !kismiMatSorusu
  ) {
    eksikler.push({
      ad: 'fiyat-listesi-eksik',
      agir: true,
      talimat:
        'Fiyat verilebilir durumdasın ve müşteri fiyat sordu. Serilerin TAMAMINI ' +
        '"• ürün – garanti: fiyat" biçiminde rakamlarıyla listele. Ürün adlarını ' +
        'sayıp fiyatı yazmadan cümleyi bitirme.',
    })
  }

  // 2a) İlk cevapta KAPSAM yokken fiyat dökme.
  //     "Standart fiyatlandırma" kararı (11 Ağustos) yalnızca ARAÇ şartını
  //     kaldırdı. Kapsam şartı duruyor: "fiyat listeniz var mı" diyen müşteriye
  //     hangi satırı okuyacağımız belli değil. Araç yokken fiyat tablosunu
  //     modelden gizleyen eski kilit kalkınca model kapsamsız da liste dökmeye
  //     başladı — o boşluğu burası kapatıyor.
  if (
    baglam.ilkCevapMi &&
    !ilkTurdaFiyatSerbestMi(yapili) &&
    fiyatRakamlariniBul(tumMetin).length > 0
  ) {
    eksikler.push({
      ad: 'kapsamsiz-ilk-fiyat',
      agir: true,
      talimat:
        'Kapsam henüz belli değil (komple mi, ön 3/ön 4 parça mı, kaç cam?). ' +
        'Bu cevapta RAKAM YAZMA. Önce kapsamı sor; müşteri kapsamı söyleyince ' +
        'fiyatı hemen vereceksin. Aracını sormana gerek yok.',
    })
  }

  // 2a-2) UYDURMA RAKAM — en ağır kusur (sözleşme Madde 9.2: botun verdiği yanlış
  //       fiyatın ticari sonucu müşteride).
  //       11 Ağustos altın seti: müşteri "ön cam dahil fiyat" dedi, bot
  //       11.000 + 12.000 yapıp "toplam 23.000₺" yazdı. Aritmetik promptta
  //       yasaklıydı ama model yine topladı. Listede olmayan HER rakam burada
  //       yakalanır; kaynağı toplama da olsa uydurma da olsa sonuç aynı.
  const izinsizRakamlar = fiyatRakamlariniBul(tumMetin).filter(
    (r) => !fiyatBilgisiAl().izinliRakamlar.has(r) && !baglam.ekIzinliRakamlar?.has(r),
  )
  if (izinsizRakamlar.length > 0) {
    eksikler.push({
      ad: 'uydurma-rakam',
      agir: true,
      talimat:
        `Şu rakam(lar) onaylı fiyat listesinde YOK: ${izinsizRakamlar.join(', ')}. ` +
        'Bunları yazma. Kalemleri TOPLAMA — her kalemin fiyatını ayrı ayrı yaz, ' +
        'toplamı müşteri kendisi görür. Sadece listedeki rakamları kullan.',
    })
  }

  // 2b) Kapsama ZATEN DAHİL olan kalemi ayrı fiyatla teklif etme.
  //     Fatih Bey, 11 Ağustos: müşteri "ön hariç hepsi" (= 5 cam komple) dedi,
  //     bot listenin altına "Ön 2 cam filmi de isterseniz 4.500₺" ekledi.
  //     Bu sadece fazlalık değil, YANLIŞ: "ön 2 cam" (sürücü + yolcu yan camı)
  //     zaten 5 cam kompleye dahil. Müşteriye dahil olan şeyi para karşılığı
  //     teklif etmiş oluyoruz.
  //     Kuralı kapsam tespitine bağlamak kırılgan çıktı: müşteri bunu "ön hariç",
  //     "ön cam hariç", "5 cam", "hepsi" diye söylüyor ve model kapsamı her tur
  //     başka türlü etiketliyordu. Asıl niyet daha basit: MÜŞTERİ İSTEMEDİKÇE
  //     bu kalem fiyatlanmaz. O yüzden şart, müşterinin kendi sözünde ön 2 cam
  //     geçip geçmediği.
  const musteriOnIkiCamIstedi = /ön\s*(2|iki)\s*cam|sadece ön cam|ön cam(ları)?\s*(da|de)?\s*ol/i.test(
    baglam.tumMusteriMetni ?? baglam.sonMusteriMetni ?? '',
  )
  // Mesaj bazında bak, aradaki mesafeye takılma: bot bunu "Ön 2 cam filmi:
  // 4.500₺" diye de yazıyor, "Ön 2 cam filmi de isterseniz 4.500₺" diye de.
  const onIkiCamFiyati = mesajlar.some((m) => /ön\s*2\s*cam/i.test(m) && /4[.,]500/.test(m))
  if (!musteriOnIkiCamIstedi && onIkiCamFiyati) {
    eksikler.push({
      ad: 'kapsama-dahil-kalem-fiyati',
      agir: true,
      talimat:
        'Müşteri 5 cam komple (ön cam hariç) istedi. "Ön 2 cam filmi" bu kapsama ' +
        'ZATEN DAHİL — ayrıca 4.500₺ diye teklif etme, bu yanlış bilgi. ' +
        'Sadece istenen kapsamın seri fiyatlarını yaz.',
    })
  }

  // 2c) Müşterinin ZATEN verdiği aracı tekrar sorma.
  //     Fatih Bey, 12 Ağustos: "müşteri aracın modelini yazmış ama tekrardan
  //     istiyor". Model kendi `arac` alanını doldurup yine de soruyordu.
  //     ⚠ Kalıplar geniş tutulmalı: bot bunu "marka/modelini paylaşırsanız",
  //     "aracınızı da yazarsanız", "model yılını iletebilir misiniz" diye de
  //     yazıyor. Dar regex 12 Ağustos uçtan uca sınavında iki kalıbı kaçırdı.
  const aracSorusu =
    /marka.{0,15}model|aracınız(ın|ı)?\s*(ne|hangi|da|de)\b|model\s*yılı|hangi araç/i
  if (yapili.arac && aracSorusu.test(tumMetin)) {
    const soruVar =
      /paylaş[ıi]r|iletebilir|yazar|yazarsanız|belirtir|nedir|öğrenebilir|alabilir miyim/i.test(
        tumMetin,
      )
    if (soruVar) {
      eksikler.push({
        ad: 'arac-tekrar-soruldu',
        talimat:
          `Müşteri aracını ZATEN söyledi (${yapili.arac}). Marka/model/model yılı ` +
          'sorma, bildiğin bilgiyi tekrar isteme. Doğrudan cevaba geç.',
      })
    }
  }

  // 2c-1b) FİYATI ARACA BAĞLAMA.
  //        Fatih Bey, 11 Ağustos: "standart fiyatlandırma" — fiyat araca göre
  //        değişmiyor, dolayısıyla aracı bilmemek fiyat vermeye ENGEL DEĞİL.
  //        12 Ağustos ölçümü: müşteri "komple düşünüyoruz" deyip kapsamı
  //        netleştirdiği hâlde bot 3/3 koşuda rakam yerine "marka ve modelinizi
  //        paylaşırsanız net fiyatı iletebilirim" dedi. Bu hem müşteriyi bir tur
  //        daha bekletiyor hem de fiyatın araca bağlı olduğu izlenimi veriyor —
  //        Fatih Bey'in "sorgu makinesi" şikâyetinin ta kendisi.
  //        Kural yalnızca İLK CEVAP bloğunda yazılıydı; ikinci turdan itibaren
  //        modeli bağlayan hiçbir şey yoktu.
  if (
    !yapili.arac &&
    yapili.kapsam &&
    aracSorusu.test(tumMetin) &&
    fiyatRakamlariniBul(tumMetin).length === 0
  ) {
    eksikler.push({
      ad: 'fiyati-araca-bagladi',
      agir: true,
      talimat:
        `Kapsam belli (${yapili.kapsam}). Fiyatlandırmamız STANDART: aracı bilmek ` +
        'fiyat vermek için gerekli DEĞİL. "Marka ve modelinizi paylaşırsanız net ' +
        'fiyatı iletebilirim" DEME — bu fiyatı araca bağlar ve müşteriyi bir tur ' +
        'daha bekletir. Bu kapsamın seri fiyatlarını ŞİMDİ listele. Aracı fiyatı ' +
        'verdikten SONRA sorabilirsin.',
    })
  }

  // 2c-2) ⛔ KALDIRILDI (Fatih Bey, 15 Ağustos: "Numara istemesin demiştim, istiyor").
  //       12 Ağustos'ta tersi istenmişti ve buraya bir kilit yazılmıştı: randevu
  //       konuşulan her turda bot iletişim numarası istiyordu. Sahada saçma
  //       kaçtı — müşteri zaten WhatsApp'tan yazıyor, numarası ekranın tepesinde
  //       duruyor. Instagram'da da gerek yok: orada müşteri zaten WhatsApp'a
  //       yönlendiriliyor (14 Ağustos kararı).
  //
  //       Kilit kaldırıldı, prompt kuralları da temizlendi. Yeni bir kural
  //       yazılmıyor: numara istemek yasak değil, sadece ZORUNLU değil.

  // 2c-3) ⛔ RENK DEĞİŞİMİNDE RAKAM YOK (Fatih Bey, 15 Ağustos: "Renkli kaplama
  //       için fiyat vermesin, yanlış fiyat veriyor").
  //
  //       Sahada bot "Global Premium 85.000₺, XPEL 110.000₺" dedi. Rakamlar
  //       uydurma değildi — fiyat listesinde yazıyordu. Sorun listedeydi: o iki
  //       rakam Fatih Bey'in TEK bir araca (BMW G20, parlak yeşil) verdiği
  //       cevaptan alınmıştı ve bot onları her araca sabit fiyat gibi söyledi.
  //       Kalem listeden çıkarıldı; bu kilit ise botun konuyu başka bir kalemin
  //       rakamıyla doldurmasını engelliyor (110.000 hâlâ mat PPF'in meşru
  //       fiyatı, yani "uydurma rakam" denetimine takılmaz).
  //
  //       ⚠ AYRIM: "mat PPF" bir KORUMA kalemidir, fiyatı vardır. "kırmızı mat
  //       kaplama" renk DÖNÜŞÜMÜDÜR, fiyatı yoktur. Kilit renk adı arıyor.
  const renkMetni = `${baglam.tumMusteriMetni ?? ''} ${baglam.sonMusteriMetni ?? ''}`
  const renkDegisimiSorusu =
    /renk\s*de[ğg]i[şs]|renkli\s*(ara[çc]\s*)?kaplama|ara[çc]\s*giydirme|renk\s*kaplama/i.test(
      renkMetni,
    ) ||
    // "BMW F30 kırmızı mat krom kaplama" — renk adı + kaplama kelimesi.
    /\b(k[ıi]rm[ıi]z[ıi]|mavi|ye[şs]il|sar[ıi]|turuncu|mor|beyaz|siyah|gri|bordo|lacivert|pembe|alt[ıi]n|bak[ıi]r|krom)\b[^.!?\n]{0,40}\b(kaplama|giydirme|d[öo]n[üu][şs][üu]m)/i.test(
      renkMetni,
    )
  if (renkDegisimiSorusu && /\d[\d.]{2,}\s*(₺|tl)/i.test(tumMetin)) {
    eksikler.push({
      ad: 'renk-degisiminde-fiyat',
      agir: true,
      talimat:
        'Müşteri RENK DEĞİŞİMİ / renkli kaplama soruyor. Bu kalemde fiyat listesi YOK, ' +
        'rakam söylemek yasak — ne fiyat, ne aralık, ne "şu civarda". Cevabından TÜM ' +
        'rakamları çıkar. Bunun yerine: işi sahiplen, aracı ve isteneni öğren (model yılı, ' +
        'istenen renk ve doku, kapı içleri dahil mi sadece dış gövde mi), ekibin net fiyatla ' +
        'döneceğini söyle. devir_gerekli_mi alanını true yap.',
    })
  }

  // 2d) Komple isteyene kısmi seçenek sunma.
  //     Fatih Bey, 12 Ağustos: "komple olana 4 parça sunuyor". Müşteri kararını
  //     vermişken aşağı çekmek satışı bozuyor.
  const musteriKomple = /komple|tam kapsam|full/i.test(
    `${yapili.kapsam ?? ''} ${baglam.tumMusteriMetni ?? ''}`,
  )
  // Eylem çekimlerini de yakala: "paylaşayım", "yönlendireyim", "sunalım" —
  // eski regex yalnızca "-abilir" biçimini görüyordu ve botun en sık kullandığı
  // "onların fiyatını da hemen paylaşayım" kalıbı kaçıyordu (12 Ağustos ajan bulgusu).
  const kismiTeklif =
    /(kaput|ön\s*3|ön\s*4|kısmi)[^.\n]{0,70}(yönlendir|paylaş|sun|ilet)(abilir|ebilir|ayım|eyim|alım|elim)/i
  if (musteriKomple && kismiTeklif.test(tumMetin)) {
    eksikler.push({
      ad: 'kompleye-kismi-teklifi',
      talimat:
        'Müşteri KOMPLE istedi. "İsterseniz kaput / ön 3 / ön 4 parça seçeneklerini ' +
        'de yönlendirebilirim" gibi bir cümle EKLEME — kararını vermiş müşteriyi ' +
        'aşağı çekiyorsun. Komple üzerinden ilerlet.',
    })
  }

  // 2e) Mat kısıtlamasını kendiliğinden söyleme.
  //     Fatih Bey, 12 Ağustos: "yalnızca mat ppf için komple yapıyoruz demesine
  //     gerek yok". Müşteri zaten komple mat isterken kısıt cümlesi kurmak
  //     gereksiz engel gibi duruyor. Cümle sadece KISMİ mat istenirse gerekli.
  const musteriKismiMatIstedi = /(kaput|ön\s*3|ön\s*4|kısmi)[^.\n]{0,25}mat|mat[^.\n]{0,25}(kaput|ön\s*3|ön\s*4|kısmi)/i.test(
    baglam.tumMusteriMetni ?? '',
  )
  const matKisitCumlesi = /mat[^.\n]{0,40}(yalnızca|sadece)[^.\n]{0,20}komple|(yalnızca|sadece)[^.\n]{0,20}komple[^.\n]{0,30}(yapıl|uygulan)/i
  if (!musteriKismiMatIstedi && matKisitCumlesi.test(tumMetin)) {
    eksikler.push({
      ad: 'gereksiz-mat-kisiti',
      talimat:
        'Müşteri kısmi mat istemedi; "mat yalnızca komple yapılıyor" kısıtlamasını ' +
        'kendiliğinden söyleme, gereksiz engel gibi duruyor. Bu cümleyi çıkar, ' +
        'doğrudan istediği uygulamayı anlat.',
    })
  }

  // 2f) KURU AÇILIŞ — Fatih Bey'in en çok şikâyet ettiği şey (12 Ağustos:
  //     "cidden karşısında bir insan var gibi, bizimki niye böyle değil").
  //     Fiyat/içerik veren cevaba sadece "Tamamdır, fiyat listemizi
  //     yönlendiriyorum." diye girmek robot gibi duruyor. Müşterinin anlattığı
  //     somut şeye (sıfır araç, teslim zamanı, renk, model) değen bir cümle şart.
  const kuruKalip = /^(tamamdır|tabi+|peki|olur)[^.!?]{0,70}(yönlendiriyorum|paylaşıyorum|ileteyim|yönlendireyim)[.!]?$/i
  if (yeniRakamlar.length > 0 && kuruKalip.test(ilkMesaj.trim())) {
    eksikler.push({
      ad: 'kuru-acilis',
      talimat:
        'Açılışın robot gibi. Sadece "Tamamdır, fiyat listemizi yönlendiriyorum" ' +
        'deme. Önce müşterinin YAZDIĞI somut şeye değinen 1-2 satırlık sıcak bir ' +
        'cümle kur: sıfır/bayiden çıkacak araçsa "aracınız şimdiden hayırlı olsun 😊" ' +
        've neden şimdi uygulatmanın doğru olduğunu söyle; renk/model söylediyse ' +
        'ona değin. Sonra fiyatlara geç. Genel geçer övgü değil, ona özel olsun.',
    })
  }

  // 2f-2) Ürünleri ÇIPLAK fiyatla sıralama — özellik yaz.
  //       Fatih Bey'in beğendiği ChatGPT cevabında her ürünün altında mikron /
  //       TPU / garanti / self-healing maddeleri vardı; bizimki sadece
  //       "ürün – garanti: fiyat" döküyordu. Fark tonun yarısı.
  //       ⚠ 12 Ağustos ölçümü: kural önce KELİME listesine bakıyordu
  //       (mikron/TPU/self-healing). Bunlar PPF özellikleri; cam filminin
  //       özellikleri bambaşka ("%99 UV koruması", "%50-65 ısı reddi"). Sonuç:
  //       özellikleri EKSİKSİZ yazılmış her cam filmi cevabında yanlış alarm
  //       verip boşuna ikinci model çağrısı yapılıyordu — 81 turluk regresyonun
  //       33'ü buydu, yani maliyetin ve gecikmenin büyük kısmı.
  //       Doğru soru kelime değil YAPI: ürün satırlarının altında fiyatsız
  //       açıklama maddeleri var mı.
  //       ⚠ 13 Ağustos: biçim KOMPAKT hale getirildi (gecikme düşsün diye ürün
  //       başına 3 madde yerine tek satır + parantez). O anda bu kontrol yine
  //       yanlış alarma başladı, çünkü özellikler artık FİYATLI SATIRIN İÇİNDE.
  //       Bu yüzden iki biçim de sayılıyor:
  //         (a) fiyatsız açıklama maddesi   → "• 190 mikron, 5 yıl garanti"
  //         (b) fiyatlı satırda parantez içi → "• Xtreme – 100.000₺ (190 mikron…)"
  const ozellikSatiriSayisi = tumMetin.split('\n').filter((satir) => {
    const madde = /^\s*(•|✅|▪|·|-|\*)\s*\S/.test(satir)
    const fiyatliMi = fiyatRakamlariniBul(satir).length > 0
    if (madde && !fiyatliMi) return true
    // Parantez içi en az 10 karakterlik açıklama = özellik sayılır.
    return fiyatliMi && /\([^)]{10,}\)/.test(satir)
  }).length

  if (yeniRakamlar.length >= 3 && ozellikSatiriSayisi < 2) {
    eksikler.push({
      ad: 'ozelliksiz-liste',
      talimat:
        'Fiyat listesini çıplak bırakma. Her ürünün fiyatının yanına parantez ' +
        'içinde 2-3 kısa özellik yaz. PPF için: mikron, garanti süresi, ' +
        'self-healing yüzey. Cam filmi için: UV koruması, ısı reddi, görüş ' +
        'netliği. Örnek: "• XPEL Xtreme – 100.000₺ (190 mikron, 5 yıl garanti)". ' +
        'Müşteri neye para verdiğini görsün.',
    })
  }

  // 2f-3) UYDURMA ÜRÜN ÖZELLİĞİ — ucuz seriye pahalı serinin özelliğini yazma.
  //       12 Ağustos test ajanı: bot "XPEL Xtreme – 100.000₺ / %100 TPU /
  //       Self-healing yüzey" yazdı. Self-healing listede Ultimate Plus'ın
  //       ayırt edici özelliği; "%100 TPU" yalnızca Togg mat paketinde geçiyor.
  //       İki katmanlı zarar: (a) kaynaksız teknik iddia (Madde 9.2),
  //       (b) 70.000₺'lik Ultimate Plus upsell'inin sebebi ortadan kalkıyor.
  //       Kural satır bazında işler: özellik hangi ürünün satırındaysa o sayılır.
  //       ⚠ SATIR bazlı bakmak yetmiyor: gerçek çıktıda ürün adı başlıkta,
  //       özellikler altındaki • maddelerinde — ikisi asla aynı satırda değil.
  //       Bu yüzden metni ÜRÜN BLOKLARINA ayırıyoruz: bir ürün adı görüldüğünde
  //       o ürün "aktif" olur, sonraki madde satırları ona aittir.
  const ustSeriOzellikleri = /self[- ]?healing|kendini onar|%\s*100\s*tpu|hidrofobik/i
  let aktifUrun: 'ucuz' | 'ust' | null = null
  let ucuzSeriSatiri: string | null = null

  for (const satir of mesajlar.flatMap((m) => m.split('\n'))) {
    // Mat/Stealth serilerinde self-healing DOĞRU — onları üst seri sayıyoruz.
    if (/ultimate|fusion|stealth|mat\b/i.test(satir)) aktifUrun = 'ust'
    else if (/xtreme|exo\s*armor|global/i.test(satir)) aktifUrun = 'ucuz'

    if (aktifUrun === 'ucuz' && ustSeriOzellikleri.test(satir)) {
      ucuzSeriSatiri = satir
      break
    }
  }

  if (ucuzSeriSatiri) {
    eksikler.push({
      ad: 'uydurma-urun-ozelligi',
      agir: true,
      talimat:
        `Şu satırda ürüne ait olmayan bir özellik yazdın: "${ucuzSeriSatiri.trim().slice(0, 90)}". ` +
        '"Self-healing / kendini onaran", "hidrofobik" ve "%100 TPU" ifadeleri XPEL Xtreme, ' +
        'EXO Armor ve Global için KULLANILMAZ — bunlar Ultimate Plus/Fusion ve mat serilerin ' +
        'özellikleri. Her ürünün özelliğini onaylı listeden oku: Xtreme → üstün parlaklık, ' +
        'günlük kullanım için ideal; EXO Armor → maksimum dayanım, en yüksek darbe ve taş izi ' +
        'direnci; Global → giriş seviyesi, taş izi + çizilme + UV koruması.',
    })
  }

  // 2g) AYNI CÜMLEYİ TEKRARLAMA (rakamsız da olsa).
  //     Fatih Bey 12 Ağustos'ta "Komple uygulamada ön 2 cam filmi, seramik
  //     kaplama... dahildir" cümlesinin iki turda da aynen geçtiğini işaretledi.
  //     `liste-tekrari` yalnızca RAKAMLARA bakıyor, bu cümlede rakam yok.
  const oncekiKelimeler = kelimeKumesi(baglam.oncekiBotMetni ?? '')

  const tekrarlananCumle = mesajlar
    .flatMap((m) => m.split(/[.\n]/))
    .map((c) => c.trim())
    .find((c) => cumleTekrariMi(c, oncekiKelimeler))

  if (tekrarlananCumle) {
    eksikler.push({
      ad: 'cumle-tekrari',
      talimat:
        `Bu cümleyi müşteriye ZATEN yazdın: "${tekrarlananCumle.slice(0, 90)}". ` +
        'Aynen tekrarlama. Söylenmiş bilgiyi bir daha yazma, konuşmayı ilerlet.',
    })
  }

  // 3) Aynı fiyat listesini ikinci kez dökme.
  //    Fatih Bey, 11 Ağustos: müşteri "şu an kullanıyorum 7.000 km" deyince bot
  //    BMW G30 listesinin tamamını baştan tekrarladı. Müşteri yeni bilgi verdi,
  //    yeni soru sormadı; listeyi tekrar okumak konuşmayı ilerletmiyor.
  //    Müşteri açıkça "tekrar gönder" derse bu kural devreye girmez.
  const oncekiRakamlar = new Set(fiyatRakamlariniBul(baglam.oncekiBotMetni ?? ''))
  const tekrarIstendi = /tekrar|bir daha|yeniden|tekrardan|gönderir misin|atar mısın/i.test(
    baglam.sonMusteriMetni ?? '',
  )

  if (
    !tekrarIstendi &&
    yeniRakamlar.length >= 3 &&
    oncekiRakamlar.size >= 3 &&
    yeniRakamlar.every((r) => oncekiRakamlar.has(r))
  ) {
    eksikler.push({
      ad: 'liste-tekrari',
      // Talimat SOMUT olmalı: "listeyi tekrarlama" deyince model yine tekrarlıyordu
      // (11 Ağustos, 3 koşudan 2'si). Yasak rakamları tek tek saymak tuttu.
      talimat:
        `Bu fiyatları müşteriye ZATEN verdin: ${[...oncekiRakamlar].slice(0, 8).join(', ')}. ` +
        'Bu rakamlardan HİÇBİRİNİ tekrar yazma, listeyi baştan sıralama. ' +
        'Müşterinin son mesajındaki yeni bilgiye cevap ver ve konuşmayı bir adım ' +
        'ilerlet: uygunluk, randevu günü, teslim süresi, uygulama detayı. ' +
        'Cevabında fiyat listesi OLMAYACAK.',
    })
  }

  return eksikler
}

/**
 * Hitapta kullanılacak ad: SADECE ilk ad.
 *
 * ⚠ 15 Ağustos (Fatih Bey): "Müşteri soyadıyla hitap etmesin." Sahada
 * "Merhabalar Asım ALTUN bey" ve "Merhabalar Mustafa Kemiksiz bey" gitti.
 * Sebep WhatsApp'ın `pushName` alanı: müşterinin kendi profiline yazdığı ad
 * geliyor ve çoğu kişi tam adını yazıyor, bazen de büyük harfle. Soyadıyla
 * hitap resmî ve soğuk kaçıyor, üstelik "KEMIKSIZ bey" gibi tuhaf duruyor.
 *
 * Normalizasyon motorun GİRİŞİNDE yapılıyor: hem prompta verilen ad, hem
 * selamlamayı kodla kuran kilit, hem de denetim aynı kaynaktan beslensin.
 * İki yerde ayrı ayrı kırpmak, ikisinin zamanla ayrışması demekti.
 *
 * Tek kelimelik ad olduğu gibi kalır. Unvan/emoji temizliği YAPILMAZ: buradaki
 * iş yalnızca soyadı düşürmek, ad tahmini değil.
 */
export function ilkAd(tamAd: string | null | undefined): string | null {
  const temiz = tamAd?.trim()
  if (!temiz) return null

  // ⚠ BOŞLUKLA BÖLMEK YETMİYOR (15 Ağustos, ikinci tur). İlk sürüm
  // `split(/\s+/)[0]` yapıyordu ve sahada "Yusuf❤️Dilek" geldi — emoji ADA
  // BİTİŞİK, arada boşluk yok. Bölme çalışmadı, tam ad olduğu gibi geçti ve
  // "Merhabalar Yusuf ❤️Dilek, hoşgeldiniz." gitti.
  //
  // Doğru soru "ilk kelime ne" değil, "ilk AD ne": metindeki ilk harf dizisi.
  // Böylece emoji, ~ işareti (WhatsApp pushName'e ekliyor), noktalama ve
  // rakam kendiliğinden dışarıda kalıyor.
  //
  // \p{M} birleşik aksan işaretleri için: bazı Türkçe adlar ayrık kodlanmış
  // aksanla geliyor ve onsuz ad ortadan kesilirdi.
  const eslesme = temiz.match(/\p{L}[\p{L}\p{M}'’-]*/u)
  return eslesme ? eslesme[0] : null
}

/** Bir tur cevap üretir. Sistem promptu her çağrıda güncel fiyat listesiyle kurulur. */
export async function yanitUret(
  ham: YanitGirdi,
  saglayici: Saglayici = saglayiciAl(),
): Promise<MotorYanit> {
  // Hitap adı tek yerde sadeleştirilir; aşağıdaki her kullanım bunu görür.
  const girdi: YanitGirdi = { ...ham, kisiAdi: ilkAd(ham.kisiAdi) }
  const gorseller = girdi.gorseller ?? []

  // Geçmişte hiç bot mesajı yoksa bu ilk cevap: fiyatla açma kilidi devreye girer.
  const ilkCevapMi = !girdi.konusma.some((m) => m.rol === 'bot')

  const sistemPrompt = sistemPromptUret({
    kisiAdi: girdi.kisiAdi,
    reklamBasligi: girdi.reklamBasligi,
    simdi: girdi.simdi,
    gorselVarMi: gorseller.length > 0,
    ilkCevapMi,
    // Araca özel paket içeriğini filtrelemek için konuşmanın tamamı gerekiyor.
    konusmaMetni: girdi.konusma.map((m) => m.metin).join('\n'),
    egitim: girdi.egitim,
  })

  const ilkCagriBaslangic = Date.now()
  const yanit = await saglayici.yanitla(sistemPrompt, girdi.konusma, gorseller)
  const ilkCagriSuresi = Date.now() - ilkCagriBaslangic

  const denetimBaglami = {
    ilkCevapMi,
    isim: girdi.kisiAdi,
    oncekiBotMetni: girdi.konusma
      .filter((m) => m.rol === 'bot')
      .map((m) => m.metin)
      .join('\n'),
    sonMusteriMetni: [...girdi.konusma].reverse().find((m) => m.rol === 'musteri')?.metin ?? '',
    tumMusteriMetni: girdi.konusma
      .filter((m) => m.rol === 'musteri')
      .map((m) => m.metin)
      .join('\n'),
    // Fatih Bey panelden "seramik kaplama 8.000₺" diye bir bilgi eklediyse bot
    // onu söyleyebilmeli; yoksa `uydurma-rakam` kilidi kendi eklediği bilgiyi
    // uydurma sayar ve boşuna düzeltme turu koşar.
    ekIzinliRakamlar: new Set(egitimRakamlariniBul(girdi.egitim)),
  }

  // Modelin kendi kararıyla çelişmesini düzelt: kapsam belliyken fiyat yazıp
  // fiyat_verilebilir_mi=false demek tutarsız (11 Ağustos, 3 koşudan 1'i).
  // Alan sadece rapor değil — `fiyat_gorseli` kilidi buna bakıyor, false iken
  // görsel zorla siliniyor. Yani model fiyatı veriyor ama listeyi göndermiyordu.
  // Kapsam YOKKEN dokunmuyoruz: orada rakam yazmak gerçek ihlaldir, bayrak kalmalı.
  if (
    !yanit.yapili.fiyat_verilebilir_mi &&
    yanit.yapili.kapsam &&
    fiyatRakamlariniBul(yanit.yapili.mesajlar.join('\n')).length > 0
  ) {
    yanit.yapili.fiyat_verilebilir_mi = true
  }

  // ⚠ Hazır liste DENETİMDEN ÖNCE yerleştirilir. Aksi halde kilitler cevapta
  // rakam göremeyip "fiyat listesi eksik" sanır ve boşuna ikinci model çağrısı
  // yapardı — yani gecikmeyi düşürmek için eklenen özellik gecikmeyi artırırdı.
  yanit.yapili.mesajlar = hazirListeyiYerlestir(
    yanit.yapili.mesajlar,
    yanit.yapili.fiyat_listesi,
  )

  const eksikler = eksikleriBul(yanit.yapili, denetimBaglami)
  // Eksik yoksa bile liste toplama uygulanır: bu bir kusur düzeltmesi değil,
  // her cevabın geçtiği biçimlendirme adımı.
  if (eksikler.length === 0) return mesajlariDegistir(yanit, listeyiTekMesajaTopla(yanit.yapili.mesajlar))

  // Düzeltme turu sessiz kalmasın: hangi kuralın kaç kez kurtarma gerektirdiğini
  // bilmezsek ne maliyeti ne de kalan kırılganlığı görebiliriz.
  if (process.env.MOTOR_DUZELTME_LOG === '1') {
    console.error(`[düzeltme] ${eksikler.map((e) => e.ad).join(', ')} (ilk çağrı ${ilkCagriSuresi} ms)`)
  }

  // ⏱ SÜRE BÜTÇESİ (Fatih Bey, 13 Ağustos: "2 dakika boyunca bot yazıyor
  // şeklinde kalıyor"). Ölçüm: 94 sn'lik turun 47 sn'si düzeltme turuydu.
  //
  // Düzeltme turu cevabın TAMAMINI yeniden yazdırıyor, yani süreyi ikiye
  // katlıyor. Yanlış fiyat göndermektense müşteriyi bekletmek yeğdir; ama
  // "cümleyi tekrar etti" gibi biçimsel bir kusur için ikinci bir dakika
  // beklemek müşteriyi kaçırır — kusurun kendisinden daha pahalı.
  //
  // Kural: ilk çağrı bütçeyi aştıysa yalnızca AĞIR eksikler için ikinci tura
  // çıkılır. Hafif olanlar aşağıdaki kod müdahaleleriyle düzeltilir ya da
  // olduğu gibi gider.
  const SURE_BUTCESI_MS = Number(process.env.MOTOR_DUZELTME_BUTCE_MS ?? 8_000)
  const agirVar = eksikler.some((e) => e.agir)
  const duzeltmeyeDeger = agirVar || ilkCagriSuresi <= SURE_BUTCESI_MS

  if (!duzeltmeyeDeger) {
    if (process.env.MOTOR_DUZELTME_LOG === '1') {
      console.error(
        `[düzeltme] ⏭ atlandı — ilk çağrı ${ilkCagriSuresi} ms > ${SURE_BUTCESI_MS} ms ` +
          've ağır eksik yok. Müşteriyi bekletmek kusurdan pahalı.',
      )
    }
    return mesajlariDegistir(
      yanit,
      listeyiTekMesajaTopla(hafifEksikleriKodlaDuzelt(yanit.yapili.mesajlar, eksikler, denetimBaglami)),
    )
  }

  // Tek düzeltme turu. İkiye çıkarmıyoruz: müşteri bekliyor ve her tur para.
  const duzeltmePrompt = [
    sistemPrompt,
    '',
    '# ZORUNLU DÜZELTME',
    '',
    'Bu soruya az önce ürettiğin cevap aşağıdaki kuralları atladı. Cevabı',
    'baştan yaz ve bu kurallara MUTLAKA uy:',
    '',
    ...eksikler.map((e) => `- ${e.talimat}`),
    '',
    'Atladığın cevap şuydu (tekrarlama, düzelt):',
    ...yanit.yapili.mesajlar.map((m) => `> ${m}`),
  ].join('\n')

  const ikinci = await saglayici.yanitla(duzeltmePrompt, girdi.konusma, gorseller)

  // ⚠ Hazır liste ikinci turda da yerleştirilmeli. Yerleştirilmezse düzeltme
  // turu koşan her fiyat cevabında liste KAYBOLUYOR: model listeyi yazmıyor
  // (öyle söyledik), kod da eklemiyordu — müşteriye "seçeneklerimiz var" deyip
  // hiç rakam vermeyen bir cevap gidiyordu. 13 Ağustos ölçümünde yakalandı.
  ikinci.yapili.mesajlar = hazirListeyiYerlestir(
    ikinci.yapili.mesajlar,
    ikinci.yapili.fiyat_listesi ?? yanit.yapili.fiyat_listesi,
  )

  const kalan = eksikleriBul(ikinci.yapili, denetimBaglami)

  if (process.env.MOTOR_DUZELTME_LOG === '1') {
    console.error(
      kalan.length === 0
        ? '[düzeltme] ✓ ikinci tur temiz'
        : `[düzeltme] ✗ ikinci turda hâlâ: ${kalan.map((e) => e.ad).join(', ')}`,
    )
  }

  // Düzeltme turu da eksikse yine de onu döndürüyoruz: eksik sayısı azalmışsa
  // kazanç var, eşitse fark yok. İlk cevaba dönmek hiçbir durumda daha iyi değil.
  const secilen = kalan.length <= eksikler.length ? ikinci : yanit

  // Selamlama + isim hâlâ eksikse üçüncü kez model çağırmıyoruz: cümleyi kodla
  // kuruyoruz. Bu kural Fatih Bey'in en çok tekrarladığı şikâyet, şansa
  // bırakılamaz.
  const isim = girdi.kisiAdi?.trim()
  let mesajlar = secilen.yapili.mesajlar

  if (kalan.some((e) => e.ad === 'liste-tekrari')) {
    mesajlar = tekrarSatirlariniAt(
      mesajlar,
      new Set(fiyatRakamlariniBul(denetimBaglami.oncekiBotMetni)),
    )
  }

  if (isim && kalan.some((e) => e.ad === 'selamlama-isim')) {
    mesajlar = selamlamaEkle(mesajlar, isim)
  }

  // Unisex isimde hitap: düzeltme turu 3 koşudan 1'inde yine "Deniz bey" yazdı.
  // Cinsiyet tahmini yazı-turadır, modele üçüncü şans verilmez — hitap kodla
  // silinir. (Aynı desen selamlamada da kullanıldı.)
  if (isim && UNISEX_ISIMLER.has(isim.toLocaleLowerCase('tr'))) {
    const hitapKalibi = new RegExp(`(${isim})\\s+(bey|hanım|hanim)\\b`, 'gi')
    mesajlar = mesajlar.map((m) => m.replace(hitapKalibi, '$1'))
  }

  mesajlar = listeyiTekMesajaTopla(mesajlar)

  return {
    ...secilen,
    metin: mesajlar.join('\n'),
    yapili: { ...secilen.yapili, mesajlar },
    kullanim: {
      ...secilen.kullanim,
      // İki çağrı yapıldı; panelde ve maliyet ölçümünde toplamı görünsün.
      girdiJeton: yanit.kullanim.girdiJeton + ikinci.kullanim.girdiJeton,
      ciktiJeton: yanit.kullanim.ciktiJeton + ikinci.kullanim.ciktiJeton,
      onbellekOkuma:
        (yanit.kullanim.onbellekOkuma ?? 0) + (ikinci.kullanim.onbellekOkuma ?? 0),
      onbellekYazma:
        (yanit.kullanim.onbellekYazma ?? 0) + (ikinci.kullanim.onbellekYazma ?? 0),
    },
  }
}

export { fiyatBilgisiAl } from './fiyat'
export { bayraklariBul, fiyatRakamlariniBul } from './denetim'
export { mesaiDisiMi } from './saat'
export { sistemPromptUret } from './sistem-prompt'
export { YANIT_SEMASI } from './sema'
export type { Saglayici, SaglayiciAdi } from './saglayici'
export type * from './types'
