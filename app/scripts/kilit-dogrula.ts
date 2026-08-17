// Kod kilitlerinin sınavı — MODEL ÇAĞRISI YAPMAZ, BEDAVA KOŞAR.
//
// Neden gerekli: `geribildirim:dogrula` ve `altin-set` gerçek model çağırır, her
// tam koşu ~1,5 dolar. Bakiye bittiğinde ikisi de koşamıyor ve "düzeltme tuttu mu"
// sorusu cevapsız kalıyordu. Bu sınav, Fatih Bey'in ekran görüntülerindeki
// GERÇEK bozuk çıktıları doğrudan `eksikleriBul()`'a verip kilidin yakalayıp
// yakalamadığını ölçer. Model gerekmez, bakiye gerekmez, saniyede biter.
//
// Ne kanıtlar: kural KODDA doğru yazılmış mı (yakalama + yanlış alarm yokluğu).
// Ne kanıtlamaz: modelin kaç koşuda o hatayı yapacağı — o ölçüm için
// `npm run geribildirim:dogrula` gerekir (ve bakiye).
//
// Çalıştır: npx tsx scripts/kilit-dogrula.ts

import {
  eksikleriBul,
  hazirListeyiYerlestir,
  ilkAd,
  oksuzTanitimiAt,
  tekrarSorulariAt,
  toplamiEkle,
  turIciTekrariAt,
} from '../src/lib/motor'
import { isBasvurusuMu } from '../src/lib/is-basvurusu'
import type { YapiliCikti } from '../src/lib/motor/types'

type Vaka = {
  ad: string
  kaynak: string
  /** Bu kilit adının yakalanması bekleniyor; null ise hiçbir eksik çıkmamalı. */
  bekleniyor: string | null
  mesajlar: string[]
  yapiliEzme?: Partial<YapiliCikti>
  ilkCevapMi?: boolean
  isim?: string
  oncekiBotMetni?: string
  sonMusteriMetni?: string
  tumMusteriMetni?: string
  uzunAradanSonraMi?: boolean
}

const TEMEL: YapiliCikti = {
  mesajlar: [],
  niyet: 'fiyat-net',
  arac: null,
  kapsam: 'komple PPF',
  fiyat_verilebilir_mi: true,
  devir_gerekli_mi: false,
  devir_sebebi: null,
  randevu_talebi: null,
  randevu_zaman: null,
  gorsel_notu: null,
  fiyat_gorseli: null,
    fiyat_listesi: null,
  guven: 0.9,
} as YapiliCikti

const VAKALAR: Vaka[] = [
  // ── 16 Ağustos, sahada: "İkisinin de fiyatını alabilir miyim" fiyatsız kaldı ──
  {
    ad: 'fiyat-listesi-eksik (model false dese bile)',
    kaynak: 'Sahada: kapsam netleşti, fiyat istendi, model fiyat_verilebilir_mi=false deyip fiyatsız cevap verdi',
    bekleniyor: 'fiyat-listesi-eksik',
    mesajlar: ['Ön 4 parça kapsamımız kaput, ön tampon, farlar ve aynalardan oluşuyor.'],
    yapiliEzme: { fiyat_verilebilir_mi: false, kapsam: null },
    sonMusteriMetni: 'İkisinin de fiyatını alabilir miyim',
    tumMusteriMetni: 'ppf kaplatmak istiyorum\nİkisinin de fiyatını alabilir miyim',
  },
  {
    ad: 'fiyat-listesi-eksik (yanlış alarm — kapsam gerçekten belirsiz)',
    kaynak: 'Kapsam hiç netleşmemişse fiyatsız kapsam sorusu doğru cevaptır',
    bekleniyor: null,
    mesajlar: [
      'Merhabalar Emre bey, hoşgeldiniz 😊',
      'Aracınıza ön 4 parça mı yoksa komple kaplama mı düşünüyorsunuz?',
    ],
    yapiliEzme: { fiyat_verilebilir_mi: false, kapsam: null },
    ilkCevapMi: true,
    isim: 'Emre',
    sonMusteriMetni: 'ppf fiyatı nedir',
    tumMusteriMetni: 'ppf fiyatı nedir',
  },

  // ── Fatih Bey, 15 Ağustos: dönen müşteri selamı ──────────────────────────
  {
    ad: 'donen-selamsiz',
    kaynak: 'Dönen müşteriye selamsız dalış; prompt istisnayı iki vurguya rağmen uygulamadı',
    bekleniyor: 'donen-selamsiz',
    mesajlar: ['Tabii, XPEL HP Serisi 5 cam komple 11.000₺.'],
    yapiliEzme: { fiyat_verilebilir_mi: true },
    uzunAradanSonraMi: true,
    sonMusteriMetni: 'Merhaba, karar verdim XPEL olsun',
  },
  {
    ad: 'donen-selamsiz (yanlış alarm — selam zaten var)',
    kaynak: 'Model selamı kendisi kurduysa kilit dokunmamalı',
    bekleniyor: null,
    mesajlar: [
      'Merhabalar Hasan bey, tekrar hoşgeldiniz 😊',
      'XPEL HP Serisi 5 cam komple 11.000₺. Hangi gün uygun olur?',
    ],
    yapiliEzme: { fiyat_verilebilir_mi: true },
    uzunAradanSonraMi: true,
    sonMusteriMetni: 'Merhaba, karar verdim XPEL olsun',
  },
  // ── Fatih Bey, 15 Ağustos: "bot kendini aşağılıyor burda" (Barkın vakası) ──
  {
    ad: 'sikayete-satis-cevabi',
    kaynak: 'Sahada: "cam filmi kalmış" diyen müşteriye fiyat listesi gitti',
    bekleniyor: 'sikayete-satis-cevabi',
    mesajlar: [
      'Cam filmi seçeneklerimiz:\n• XPEL HP Serisi – 11.000₺\n• Global – 7.500₺',
    ],
    sonMusteriMetni: 'Arka kelebek camlardaki cam filmi kalmış',
    tumMusteriMetni: 'Arka kelebek camlardaki cam filmi kalmış',
  },
  {
    ad: 'sikayete-satis-cevabi (yanlış alarm — doğru şikayet cevabı)',
    kaynak: 'Rakamsız sahiplenme cevabı kilide takılmamalı',
    bekleniyor: null,
    mesajlar: [
      'Bu durumu ilettiğiniz için teşekkür ederiz, hemen ilgileniyoruz.',
      'Uygun olduğunuz bir gün aracınıza bakalım, hemen çözelim. Hangi gün getirebilirsiniz?',
    ],
    yapiliEzme: { fiyat_verilebilir_mi: false, devir_gerekli_mi: true, devir_sebebi: 'sikayet' },
    sonMusteriMetni: 'Arka camlarda kabarma olmuş',
    tumMusteriMetni: 'Arka camlarda kabarma olmuş',
  },
  {
    ad: 'sikayete-satis-cevabi (yanlış alarm — normal fiyat sorusu)',
    kaynak: '"kalmış" kelimesi geçmeyen normal satış turu etkilenmemeli',
    bekleniyor: null,
    mesajlar: [
      'Komple PPF seçeneklerimiz:\n• XPEL Xtreme PPF – 100.000₺ (190 mikron, 5 yıl garanti, üstün parlaklık)',
      'Hangi seride ilerlemek istersiniz?',
    ],
    sonMusteriMetni: 'komple ppf fiyatı nedir',
    tumMusteriMetni: 'BMW G20 komple ppf fiyatı nedir',
  },
  // ── Fatih Bey, 15 Ağustos: "son mesajdan sonra kalmış öylece" ────────────
  {
    ad: 'fiyat-kapanissiz',
    kaynak: 'Sahada: mat PPF listesi gitti, konuşma kapanış sorusu olmadan durdu',
    bekleniyor: 'fiyat-kapanissiz',
    mesajlar: [
      'Mat PPF seçeneklerimiz:\n• XPEL Xtreme PPF (MAT) – 110.000₺ (190 mikron, 5 yıl garanti)\n• XPEL Ultimate Stealth (MAT) – 175.000₺ (200 mikron, 10 yıl garanti)',
      'Mat PPF komple uygulanıyor.',
    ],
    sonMusteriMetni: 'sıfır km Tesla model Y Premium mat PPF için bilgi alabilir miyim',
    tumMusteriMetni: 'sıfır km Tesla model Y Premium mat PPF için bilgi alabilir miyim',
  },
  {
    ad: 'fiyat-kapanissiz (yanlış alarm — soru zaten var)',
    kaynak: 'Bot soruyu sorduysa kilit tetiklenmemeli',
    bekleniyor: null,
    mesajlar: [
      'Mat PPF seçeneklerimiz:\n• XPEL Xtreme PPF (MAT) – 110.000₺ (190 mikron, 5 yıl garanti)\n• XPEL Ultimate Stealth (MAT) – 175.000₺ (200 mikron, 10 yıl garanti)',
      'Hangi seride ilerlemek istersiniz?',
    ],
    sonMusteriMetni: 'mat ppf fiyatı nedir',
    tumMusteriMetni: 'komple mat ppf fiyatı nedir',
  },

  // ── Fatih Bey, 15 Ağustos: "Renkli kaplama için fiyat vermesin" ──────────
  {
    ad: 'renk-degisiminde-fiyat',
    kaynak: 'Fatih Bey 15 Ağustos: sahada "Global Premium 85.000₺, XPEL 110.000₺" gitti',
    bekleniyor: 'renk-degisiminde-fiyat',
    mesajlar: [
      'Komple renk değişimde iki seçeneğimiz var: Global Premium 85.000₺, XPEL 110.000₺.',
    ],
    sonMusteriMetni: 'BMW f30 kırmızı mat krom kaplama fiyatı nedir',
    tumMusteriMetni: 'BMW f30 kırmızı mat krom kaplama fiyatı nedir',
  },
  {
    ad: 'renk-degisiminde-fiyat ("renk değişimi" kelimesiyle)',
    kaynak: 'Kalem adı doğrudan geçtiğinde de yakalanmalı',
    bekleniyor: 'renk-degisiminde-fiyat',
    mesajlar: ['Renk değişimi için fiyatımız 85.000₺ civarında oluyor.'],
    sonMusteriMetni: 'aracıma renk değişimi yaptırmak istiyorum',
    tumMusteriMetni: 'aracıma renk değişimi yaptırmak istiyorum',
  },
  {
    ad: 'renk-degisiminde-fiyat (yanlış alarm — rakamsız cevap)',
    kaynak: 'Rakam yoksa kilit tetiklenmemeli; bot konuyu konuşabilmeli',
    bekleniyor: null,
    mesajlar: [
      'Merhabalar Emre bey, hoşgeldiniz.',
      'BMW F30 üzerinde kırmızı mat çok şık duruyor. Renk değişiminde fiyat aracın yüzey alanına ve seçilen filme göre değişiyor; kapı içleri de dahil olacak mı, sadece dış gövde mi? Bu bilgiyle ekibimiz size net fiyatı hazırlayıp dönüş sağlayacak.',
    ],
    yapiliEzme: { fiyat_verilebilir_mi: false, devir_gerekli_mi: true, kapsam: 'renk değişimi' },
    ilkCevapMi: true,
    isim: 'Emre',
    sonMusteriMetni: 'BMW f30 kırmızı mat krom kaplama',
    tumMusteriMetni: 'BMW f30 kırmızı mat krom kaplama',
  },
  {
    ad: 'renk-degisiminde-fiyat (yanlış alarm — normal PPF fiyatı)',
    kaynak: 'ÖNEMLİ AYRIM: mat PPF bir koruma kalemi, fiyatı verilir. Kilit buna dokunmamalı.',
    bekleniyor: null,
    mesajlar: [
      'Komple PPF seçeneklerimiz:\n• XPEL Xtreme PPF – 100.000₺ (190 mikron, 5 yıl garanti, üstün parlaklık)',
      // Kapanış sorusu: `fiyat-kapanissiz` kilidi 15 Ağustos'ta eklendi ve
      // gerçek bir fiyat cevabı zaten soruyla biter. Vaka onsuz yapaydı.
      'Hangi seride ilerlemek istersiniz?',
    ],
    sonMusteriMetni: 'komple ppf fiyatı nedir',
    tumMusteriMetni: 'BMW G20 komple ppf fiyatı nedir',
  },
  // ── Fatih Bey, 12 Ağustos ekran görüntüleri ──────────────────────────────
  {
    ad: 'uydurma-urun-ozelligi',
    kaynak: '12 Ağustos ajan: Xtreme satırına self-healing + %100 TPU yazdı',
    bekleniyor: 'uydurma-urun-ozelligi',
    mesajlar: [
      'Komple PPF seçeneklerimiz:\nXPEL Xtreme – 100.000₺\n• %100 TPU, 190 mikron\n• 5 yıl garanti\n• Self-healing yüzey',
    ],
    sonMusteriMetni: 'komple ppf fiyatı',
  },
  {
    ad: 'uydurma-urun-ozelligi (yanlış alarm kontrolü)',
    kaynak: 'Ultimate Plus self-healing DOĞRU — bayrak çıkmamalı',
    bekleniyor: null,
    mesajlar: [
      'XPEL Ultimate Plus – 170.000₺\n• 200 mikron, 10 yıl garanti\n• Self-healing, hidrofobik yüzey',
      'Hangi seride ilerlemek istersiniz?',
    ],
    sonMusteriMetni: 'komple ppf fiyatı',
  },
  {
    ad: 'kompleye-kismi-teklifi',
    kaynak: 'Fatih Bey 12 Ağustos: "komple olana 4 parça sunuyor"',
    bekleniyor: 'kompleye-kismi-teklifi',
    mesajlar: [
      'Komple kaplamada Global PPF 75.000₺.',
      'İsterseniz kaput / ön 3 / ön 4 parça seçeneklerini de ayrıca yönlendirebilirim.',
    ],
    sonMusteriMetni: 'Global serisi için öneriniz nedir',
    tumMusteriMetni: 'Bmw g20 komple ppf düşünüyorum\nGlobal serisi için öneriniz nedir',
  },
  {
    ad: 'kompleye-kismi-teklifi (ikinci kalıp)',
    kaynak: '12 Ağustos ajan: "onların fiyatını da hemen paylaşayım"',
    bekleniyor: 'kompleye-kismi-teklifi',
    mesajlar: [
      'Komple kaplamada seçeneklerimiz: XPEL Xtreme 100.000₺, 190 mikron.',
      'Kısmi kaplama (ön 3 / ön 4 parça) düşünüyorsanız onların fiyatını da hemen paylaşayım.',
    ],
    sonMusteriMetni: 'komple olsun',
    tumMusteriMetni: 'sıfır aracım var ppf düşünüyorum\nkomple olsun',
  },
  {
    ad: 'gereksiz-mat-kisiti',
    kaynak: 'Fatih Bey 12 Ağustos: "yalnızca mat ppf için komple yapıyoruz demesine gerek yok"',
    bekleniyor: 'gereksiz-mat-kisiti',
    mesajlar: [
      'Merhabalar Enis bey, tabi yardımcı olalım.',
      'Mat PPF uygulaması yalnızca komple yapılıyor. Krom detaylar için ayrıca siyah kaplama uygulanabilir.',
    ],
    ilkCevapMi: true,
    isim: 'Enis',
    sonMusteriMetni: 'T10F oltu mat ppf ve kromlar siyah kaplanacak',
    tumMusteriMetni: 'T10F oltu mat ppf ve kromlar siyah kaplanacak',
  },
  {
    ad: 'gereksiz-mat-kisiti (yanlış alarm kontrolü)',
    kaynak: 'Müşteri KISMİ mat isterse cümle DOĞRU — bayrak çıkmamalı',
    bekleniyor: null,
    mesajlar: ['Mat seride kısmi uygulama yapmıyoruz, yalnızca komple uygulanıyor.'],
    sonMusteriMetni: 'Kaputa mat ppf fiyatı nedir',
    tumMusteriMetni: 'Kaputa mat ppf fiyatı nedir',
  },
  {
    ad: 'arac-tekrar-soruldu',
    kaynak: 'Fatih Bey 12 Ağustos: "müşteri aracın modelini yazmış ama tekrardan istiyor"',
    bekleniyor: 'arac-tekrar-soruldu',
    mesajlar: [
      'Yarın için uygunluk durumumuzu kontrol edebilmemiz için saat aralığını iletebilir misiniz?',
      'Aracınızın marka/modelini paylaşır mısınız?',
    ],
    yapiliEzme: { arac: 'BMW G20' },
    sonMusteriMetni: 'Peki yarın için boşlugunuz var mı',
  },
  {
    ad: 'cumle-tekrari',
    kaynak: 'Fatih Bey 12 Ağustos: "sürekli aynı şekilde tekrarlıyor" (dahildir cümlesi)',
    bekleniyor: 'cumle-tekrari',
    mesajlar: [
      'Komple uygulamada ön 2 cam filmi, seramik kaplama, araç içi deri bakımı, kapı eşikleri ve jant seramiği de dahildir.',
    ],
    oncekiBotMetni:
      'Komple uygulamalarda ön 2 cam filmi, seramik kaplama, araç içi deri bakımı, kapı eşikleri ve jant seramiği de dahildir.',
    sonMusteriMetni: 'Aracım Bmw G20',
  },
  {
    ad: 'kuru-acilis',
    kaynak: 'Fatih Bey 12 Ağustos: "tonlamaya bakar mısın, GPT gibi insan var gibi değil"',
    bekleniyor: 'kuru-acilis',
    mesajlar: [
      'Tamamdır, BMW G20 için komple PPF fiyat listemizi yönlendiriyorum.',
      '• XPEL Xtreme PPF – 5 yıl garanti: 100.000₺',
    ],
    sonMusteriMetni: 'komple ppf fiyatı nedir',
  },
  {
    ad: 'ozelliksiz-liste',
    kaynak: 'Fatih Bey 12 Ağustos: çıplak fiyat listesi, özellik yok',
    bekleniyor: 'ozelliksiz-liste',
    mesajlar: [
      'Komple seçeneklerimiz:\n• XPEL Xtreme – 5 yıl garanti: 100.000₺\n• XPEL EXO Armor – 7 yıl garanti: 125.000₺\n• Global PPF – 5 yıl garanti: 75.000₺',
    ],
    sonMusteriMetni: 'komple ppf fiyatı nedir',
  },

  // ── 11 Ağustos bulguları (gerilemediğini kanıtlar) ───────────────────────
  {
    ad: 'kapsama-dahil-kalem-fiyati',
    kaynak: 'Fatih Bey 11 Ağustos: "5 cam demiş, ayrıca ön 2 cam fiyatı vermesine gerek yok"',
    bekleniyor: 'kapsama-dahil-kalem-fiyati',
    mesajlar: [
      'Civic FC5 için ön cam hariç 5 cam komple: XPEL HP 11.000₺.',
      'Ön 2 cam filmi de isterseniz 4.500₺.',
    ],
    yapiliEzme: { kapsam: '5 cam komple' },
    sonMusteriMetni: 'Ön hariç hepsi civic fc5',
    tumMusteriMetni: 'Cam filmi kampanyanız\nÖn hariç hepsi civic fc5',
  },
  {
    ad: 'uydurma-rakam',
    kaynak: '11 Ağustos altın set: 11.000 + 12.000 toplanıp 23.000 uydurulmuş',
    bekleniyor: 'uydurma-rakam',
    mesajlar: [
      '5 cam komple 11.000₺, ön cam filmi 12.000₺.',
      'Ön cam dahil uygulamada toplam 23.000₺ olur.',
    ],
    sonMusteriMetni: '2011 Passat ön cam dahil fiyat',
  },
  {
    ad: 'selamlama-isim',
    kaynak: 'Fatih Bey 9+11 Ağustos: adı bilirken kullanmıyor',
    bekleniyor: 'selamlama-isim',
    mesajlar: ['Tamamdır, Toyota Corolla sedan için cam filmi fiyatlarımızı yönlendiriyorum.'],
    ilkCevapMi: true,
    isim: 'Cemal',
    sonMusteriMetni: 'Toyota corolla sedan cam filmi fiyat',
  },
  {
    ad: 'unisex-hitap',
    kaynak: '10 Ağustos: unisex isimde cinsiyet tahmini ("Deniz bey")',
    bekleniyor: 'unisex-hitap',
    mesajlar: ['Merhabalar Deniz bey, hoşgeldiniz.'],
    ilkCevapMi: true,
    isim: 'Deniz',
    sonMusteriMetni: 'seramik kaplama istiyorum',
  },
  {
    ad: 'liste-tekrari',
    kaynak: 'Fatih Bey 11 Ağustos: "2 kere aynı cevabı verdi"',
    bekleniyor: 'liste-tekrari',
    mesajlar: [
      'Komple kaplamada seçeneklerimiz:\n• XPEL Xtreme: 100.000₺\n• XPEL EXO Armor: 125.000₺\n• Global PPF: 75.000₺',
    ],
    oncekiBotMetni:
      'Komple kaplamada seçeneklerimiz:\n• XPEL Xtreme: 100.000₺\n• XPEL EXO Armor: 125.000₺\n• Global PPF: 75.000₺',
    sonMusteriMetni: 'Şu an kullanıyorum 7.000 km',
  },

  // ── Fatih Bey, 16 Ağustos: "Toplam fiyat ne kadar" → "maalesef veremiyoruz" ──
  {
    ad: 'toplam-reddi',
    kaynak: 'Sahada: müşteri üç kalemin toplamını sordu, bot "toplu rakam veremiyoruz" dedi',
    bekleniyor: 'toplam-reddi',
    mesajlar: [
      'Maalesef kalemleri toplu bir rakam olarak veremiyoruz, her biri ayrı fiyatlandırılıyor.',
    ],
    sonMusteriMetni: 'Toplam fiyat ne kadar oluyor',
    tumMusteriMetni:
      'Seramik kaplama, global adı ceramic cam filmi ve xpel xr blue ön cam toplam ne kadar olur\nToplam fiyat ne kadar oluyor',
  },
  {
    ad: 'toplam-reddi (yanlış alarm yok — kalemler dökülünce liste-tekrari de susmalı)',
    kaynak: 'Toplam sorusunda kalemleri tekrar yazmak meşru; liste-tekrari muafiyeti',
    bekleniyor: null,
    mesajlar: [
      '• Seramik kaplama (Nasiol ZR53): 17.500₺\n• Global QDP Ceramic cam filmi: 10.000₺\n• XPEL XR Blue ön cam: 12.000₺',
      'Aracınızı hangi gün getirmeyi düşünürsünüz?',
    ],
    oncekiBotMetni:
      'Seramik kaplamada Nasiol ZR53 ürününü kullanıyoruz, fiyatı 17.500₺.\nGlobal QDP Ceramic 10.000₺.\nXPEL XR Blue 12.000₺.',
    sonMusteriMetni: 'Toplam fiyat ne kadar oluyor',
  },
]

function kosVaka(v: Vaka): { gecti: boolean; ayrinti: string } {
  const yapili: YapiliCikti = { ...TEMEL, ...v.yapiliEzme, mesajlar: v.mesajlar }
  const eksikler = eksikleriBul(yapili, {
    ilkCevapMi: v.ilkCevapMi ?? false,
    isim: v.isim ?? null,
    oncekiBotMetni: v.oncekiBotMetni ?? '',
    sonMusteriMetni: v.sonMusteriMetni ?? '',
    tumMusteriMetni: v.tumMusteriMetni ?? v.sonMusteriMetni ?? '',
    uzunAradanSonraMi: v.uzunAradanSonraMi,
  })

  const adlar = eksikler.map((e) => e.ad)

  if (v.bekleniyor === null) {
    return adlar.length === 0
      ? { gecti: true, ayrinti: 'eksik yok (doğru)' }
      : { gecti: false, ayrinti: `YANLIŞ ALARM: ${adlar.join(', ')}` }
  }

  return adlar.includes(v.bekleniyor)
    ? { gecti: true, ayrinti: `yakalandı${adlar.length > 1 ? ` (+ ${adlar.filter((a) => a !== v.bekleniyor).join(', ')})` : ''}` }
    : { gecti: false, ayrinti: `KAÇTI — çıkan: ${adlar.join(', ') || 'hiçbiri'}` }
}

console.log('\nKod kilidi sınavı — model çağrısı YOK, bakiye gerekmez\n')

let gecti = 0
const kalanlar: string[] = []

for (const v of VAKALAR) {
  const sonuc = kosVaka(v)
  if (sonuc.gecti) {
    gecti += 1
    console.log(`  ✓ ${v.ad} — ${sonuc.ayrinti}`)
  } else {
    kalanlar.push(v.ad)
    console.log(`  ✗ ${v.ad} — ${sonuc.ayrinti}`)
    console.log(`      kaynak: ${v.kaynak}`)
  }
}

// ── Fiyat listesinin YERİ (Fatih Bey, 15 Ağustos) ─────────────────────────
// Sahada liste, kendisini tanıtan cümleden ÖNCE gitti; "seçeneklerimiz şöyle:"
// listeden sonra öksüz kaldı ve konuşma yarım göründü.
console.log('\nFiyat listesinin yeri — tanıtan cümleden SONRA gelmeli')

const YERLESIM_VAKALARI: {
  ad: string
  mesajlar: string[]
  listeIndeksi: number
  neden: string
}[] = [
  {
    ad: 'Sahadaki vaka: açılış + tanıtım cümlesi',
    mesajlar: [
      'Aracınız şimdiden hayırlı olsun Barış bey 😊 Sıfır km Tesla Model Y için en ideal zaman.',
      'Mat PPF komple uygulanıyor, seçeneklerimiz şöyle:',
    ],
    listeIndeksi: 2,
    neden: 'Liste tanıtım cümlesinin ARDINA girmeli, arasına değil.',
  },
  {
    ad: 'Tek mesaj, iki nokta ile bitiyor',
    mesajlar: ['Komple PPF seçeneklerimiz:'],
    listeIndeksi: 1,
    neden: 'Tanıtım son mesajsa liste en sona eklenir.',
  },
  {
    ad: 'Tanıtım cümlesi yok → eski davranış (ilk mesajdan sonra)',
    mesajlar: ['Merhabalar Ahmet bey, hoşgeldiniz.', 'Teslim süremiz 2-3 iş günü.'],
    listeIndeksi: 1,
    neden: 'Tanıtım bulunamazsa liste açılıştan sonra gelir.',
  },
  {
    ad: '👇 işaretli tanıtım da yakalanır',
    mesajlar: ['Merhabalar Ahmet bey.', 'BMW G20 için komple PPF seçeneklerimiz aşağıda 👇'],
    listeIndeksi: 2,
    neden: 'Sahadaki en sık kalıp; liste ondan sonra gelmeli.',
  },
]

for (const v of YERLESIM_VAKALARI) {
  const sonuc = hazirListeyiYerlestir(v.mesajlar, 'komple-ppf')
  // Listeyi rakamından tanı: fiyat satırı içeren mesaj listenin kendisidir.
  const bulunan = sonuc.findIndex((m) => /\d{2,3}\.\d{3}\s*₺/.test(m))
  if (bulunan === v.listeIndeksi) {
    gecti += 1
    console.log(`  ✓ ${v.ad} — liste ${bulunan}. sırada`)
  } else {
    kalanlar.push(v.ad)
    console.log(`  ✗ ${v.ad} — liste ${bulunan}. sırada, beklenen ${v.listeIndeksi}`)
    console.log(`      kaynak: ${v.neden}`)
  }
}

// ── İş başvurusu tespiti (Fatih Bey, 15 Ağustos: "pas geçsin") ────────────
// Bot turu hiç açılmaz; yanlış pozitif gerçek müşteriyi cevapsız bırakır,
// o yüzden yanlış alarm vakaları en az yakalama vakaları kadar önemli.
console.log('\nİş başvurusu — bot pas geçer mi')

const BASVURU_VAKALARI: { metin: string; beklenen: boolean; neden: string }[] = [
  { metin: 'iş ilanınız var mı', beklenen: true, neden: 'Doğrudan ilan sorusu.' },
  { metin: 'Merhaba eleman alımınız var mı', beklenen: true, neden: 'Eleman alımı.' },
  { metin: 'iş başvurusu yapmak istiyorum', beklenen: true, neden: 'Açık başvuru.' },
  { metin: 'cv gönderebilir miyim', beklenen: true, neden: 'CV.' },
  { metin: 'Usta arıyor musunuz', beklenen: true, neden: 'Usta arayışı.' },
  { metin: 'stajyer alıyor musunuz', beklenen: true, neden: 'Staj.' },
  { metin: 'yanınızda çalışmak istiyorum', beklenen: true, neden: 'İşe girme talebi.' },
  { metin: 'iş arıyorum abi', beklenen: true, neden: 'İş arayışı.' },
  // Yanlış alarm — gerçek müşteri mesajları PAS GEÇİLMEMELİ
  { metin: 'komple ppf fiyatı nedir', beklenen: false, neden: 'Normal fiyat sorusu.' },
  { metin: 'işlem ne kadar sürüyor', beklenen: false, neden: '"işlem" kelimesi iş değil.' },
  { metin: 'bu iş ne kadara olur', beklenen: false, neden: 'Müşteri "iş" der ama başvuru değil.' },
  { metin: 'cam filmi işi yapıyor musunuz', beklenen: false, neden: 'Hizmet sorusu.' },
  { metin: 'aracımı yarın işten çıkınca getirsem olur mu', beklenen: false, neden: 'Müşterinin kendi işi.' },
  { metin: 'sizinle çalışmak isteriz, filo aracımız var', beklenen: false, neden: 'Kurumsal müşteri; "yanınızda çalışmak" değil.' },
]

for (const v of BASVURU_VAKALARI) {
  const sonuc = isBasvurusuMu(v.metin)
  if (sonuc === v.beklenen) {
    gecti += 1
    console.log(`  ✓ ${v.beklenen ? '🔴 ' : ''}"${v.metin}" → ${sonuc ? 'pas' : 'cevaplanır'}`)
  } else {
    kalanlar.push(`isBasvurusuMu("${v.metin}")`)
    console.log(`  ✗ "${v.metin}" → beklenen ${v.beklenen}, gelen ${sonuc} (${v.neden})`)
  }
}

// ── Tur içi tekrar (16 Ağustos: aynı cümlenin iki varyantı art arda gitti) ──
console.log('\nTur içi tekrar — aynı cümle iki balonda gitmesin')

const TEKRAR_VAKALARI: { ad: string; girdi: string[]; beklenen: number; neden: string }[] = [
  {
    ad: 'Sahadaki ikili → tek mesaj kalır',
    girdi: [
      'Ön 4 parça; kaput, ön tampon, farlar ve aynaları kapsıyor.',
      'Ön 4 parça kapsamımız kaput, ön tampon, farlar ve aynalardan oluşuyor.',
    ],
    beklenen: 1,
    neden: 'Birebir sahadaki çift; müşteri aynı cümleyi iki kez okudu.',
  },
  {
    ad: 'Farklı içerikli mesajlar korunur',
    girdi: [
      'Merhabalar Emre bey, hoşgeldiniz 😊',
      'Komple uygulamada ön 2 cam filmi, deri bakımı ve jant seramiği dahil.',
      'Hangi seride ilerlemek istersiniz?',
    ],
    beklenen: 3,
    neden: 'Normal akış üç ayrı mesaj; süzgeç dokunmamalı.',
  },
  {
    ad: 'Kısa mesajlar süzülmez',
    girdi: ['Tabii, yardımcı olalım.', 'Tabi, hemen yardımcı olayım.'],
    beklenen: 2,
    neden: 'Kısa nezaket cümleleri (kök sayısı < 4) yanlış pozitife açık; dokunulmaz.',
  },
]

for (const v of TEKRAR_VAKALARI) {
  const sonuc = turIciTekrariAt(v.girdi)
  if (sonuc.length === v.beklenen) {
    gecti += 1
    console.log(`  ✓ ${v.ad} — ${sonuc.length} mesaj`)
  } else {
    kalanlar.push(v.ad)
    console.log(`  ✗ ${v.ad} — beklenen ${v.beklenen}, gelen ${sonuc.length} (${v.neden})`)
  }
}

// ── Hitap adı: soyadı düşürülüyor mu (Fatih Bey, 15 Ağustos) ──────────────
// Sahada "Merhabalar Asım ALTUN bey" ve "Merhabalar Mustafa Kemiksiz bey"
// gitti. Kaynak WhatsApp pushName: müşteri profiline tam adını yazıyor.
console.log('\nHitap adı — soyadıyla hitap etmesin')

const ISIM_VAKALARI: { girdi: string | null; bekleniyor: string | null; neden: string }[] = [
  { girdi: 'Asım ALTUN', bekleniyor: 'Asım', neden: 'Sahadaki kusur, büyük harfli soyad.' },
  // ⚠ Bu vaka ilk düzeltmeyi DÜŞÜRDÜ: emoji ada bitişik, boşlukla bölme çalışmıyor.
  { girdi: 'Yusuf❤️Dilek', bekleniyor: 'Yusuf', neden: 'Sahada 15 Ağustos: emoji bitişik, boşluk yok.' },
  { girdi: 'Yusuf ❤️ Dilek', bekleniyor: 'Yusuf', neden: 'Emoji ayrıysa da aynı sonuç.' },
  { girdi: '~Ahmet Yılmaz', bekleniyor: 'Ahmet', neden: 'WhatsApp pushName başına ~ koyabiliyor.' },
  { girdi: '🚗Murat', bekleniyor: 'Murat', neden: 'Adın ÖNÜNDE emoji.' },
  { girdi: '905551234567', bekleniyor: null, neden: 'Harf yoksa ad da yok; numarayla hitap edilmez.' },
  { girdi: 'Mustafa Kemiksiz', bekleniyor: 'Mustafa', neden: 'Sahadaki ikinci kusur.' },
  { girdi: 'Emre', bekleniyor: 'Emre', neden: 'Tek kelime olduğu gibi kalır.' },
  { girdi: '  Ayşe   Yılmaz  ', bekleniyor: 'Ayşe', neden: 'Fazla boşluk bozmamalı.' },
  { girdi: 'Ali Rıza Şahin', bekleniyor: 'Ali', neden: 'Üç kelimede de ilk ad alınır.' },
  { girdi: null, bekleniyor: null, neden: 'Adı bilinmeyen müşteri.' },
  { girdi: '   ', bekleniyor: null, neden: 'Boş ad null olmalı.' },
]

for (const v of ISIM_VAKALARI) {
  const sonuc = ilkAd(v.girdi)
  if (sonuc === v.bekleniyor) {
    gecti += 1
    console.log(`  ✓ "${v.girdi ?? '(yok)'}" → ${sonuc ?? '(yok)'}`)
  } else {
    kalanlar.push(`ilkAd("${v.girdi ?? ''}")`)
    console.log(`  ✗ "${v.girdi ?? '(yok)'}" → beklenen ${v.bekleniyor}, gelen ${sonuc}`)
    console.log(`      kaynak: ${v.neden}`)
  }
}

// ── Soru tekrarı (Fatih Bey, 16 Ağustos: "sürekli randevu istiyo") ─────────
// Bot aynı konuşmada seri sorusunu ÜÇ, gün sorusunu ÜÇ kez sordu. Kısa sorular
// cumle-tekrari süzgecinin 45 karakter eşiğinin altında kalıyordu; kodun
// eklediği kapanış sorusu da hiçbir süzgece uğramıyordu.
console.log('\nSoru tekrarı — sorulmuş kapanış sorusu bir daha gitmesin')

const SORU_VAKALARI: {
  ad: string
  mesajlar: string[]
  onceki: string
  sonMusteri: string
  /** true → çıktıda bu kalıp OLMAMALI, false → KORUNMALI */
  silinmeli: boolean
  kalip: RegExp
  neden: string
}[] = [
  {
    ad: 'Seri sorusu ikinci kez gitmez',
    mesajlar: ['Kredi kartıyla 3 aya kadar taksit imkanımız var.', 'Hangi seride ilerlemek istersiniz?'],
    onceki: 'Ön cam için seçeneklerimiz:\n• XPEL XR Blue: 12.000₺\nHangi seride ilerlemek istersiniz?',
    sonMusteri: '3 taksit seçeneği olabilir',
    silinmeli: true,
    kalip: /hangi seride/i,
    neden: 'Sahada aynı soru üç kez gitti; müşteri seçimini 20:38\'de zaten söylemişti.',
  },
  {
    ad: 'Gün sorusu ikinci kez gitmez',
    mesajlar: ['Tabii, 3 taksit ile ilerleyebiliriz.', 'Aracınızı hangi gün getirmeyi düşünürsünüz?'],
    onceki: 'Aracınızı ne zaman getirmeyi düşünürsünüz, ona göre gününüzü ayarlayalım.',
    sonMusteri: '3 taksit seçeneği olabilir',
    silinmeli: true,
    kalip: /hangi gün getirmeyi/i,
    neden: 'Sahada gün sorusu üç kez gitti (20:33, 20:41, 20:42).',
  },
  {
    ad: 'Müşteri erteledi → gün sorusu ilk kez bile gitmez',
    mesajlar: ['Tamamdır, tarihiniz netleştiğinde yazmanız yeterli.', 'Aracınızı hangi gün getirmeyi düşünürsünüz?'],
    onceki: '',
    sonMusteri: 'Şuan teslim tarihim belli değil tarih aldığım zaman tekrar iletişime geçerim',
    silinmeli: true,
    kalip: /hangi gün getirmeyi/i,
    neden: '"Tarih belli değil" diyen müşteriye gün sormak ısrar.',
  },
  {
    ad: 'İlk kez sorulan seri sorusu korunur',
    mesajlar: ['Cam filmi seçeneklerimiz:\n• XPEL HP: 11.000₺\n• Global: 7.500₺', 'Hangi seride ilerlemek istersiniz?'],
    onceki: 'Merhabalar, hoşgeldiniz.',
    sonMusteri: 'Cam filmi ne kadar',
    silinmeli: false,
    kalip: /hangi seride/i,
    neden: 'İlk soru meşru; yanlış alarm kapanış sorusunu öldürür.',
  },
  {
    ad: 'Müşteri gün verdiyse saat/uygunluk soruları serbest',
    mesajlar: ['Yarın için hangi saat sizin için uygun olur?'],
    onceki: 'Aracınızı ne zaman getirmeyi düşünürsünüz?',
    sonMusteri: 'Yarın getireyim',
    silinmeli: false,
    kalip: /hangi saat/i,
    neden: 'Netleştirme sorusu gün sorusunun tekrarı değil.',
  },
]

for (const v of SORU_VAKALARI) {
  const sonuc = tekrarSorulariAt(v.mesajlar, v.onceki, v.sonMusteri).join('\n')
  const kaldi = v.kalip.test(sonuc)
  const dogru = v.silinmeli ? !kaldi : kaldi
  if (dogru) {
    gecti += 1
    console.log(`  ✓ ${v.ad}`)
  } else {
    kalanlar.push(v.ad)
    console.log(`  ✗ ${v.ad} — ${v.silinmeli ? 'soru hâlâ duruyor' : 'soru yanlışlıkla silindi'}`)
    console.log(`      kaynak: ${v.neden}`)
  }
}

// ── Toplam hesabı KODDA (16 Ağustos: "maalesef toplu rakam veremiyoruz") ───
console.log('\nToplam fiyat — müşteri sorunca kod toplar')

const TOPLAM_VAKALARI: {
  ad: string
  mesajlar: string[]
  sonMusteri: string
  beklenen: RegExp | null
  neden: string
}[] = [
  {
    ad: 'Üç kalem → 39.500₺ toplamı eklenir',
    mesajlar: [
      '• Seramik kaplama: 17.500₺\n• Global QDP Ceramic cam filmi: 10.000₺\n• XPEL XR Blue ön cam: 12.000₺',
    ],
    sonMusteri: 'Toplam fiyat ne kadar oluyor',
    beklenen: /toplamı 39\.500₺/,
    neden: 'Sahadaki üçlü: 17.500 + 10.000 + 12.000. Model toplamaz, kod toplar.',
  },
  {
    ad: 'Toplam sorulmadıysa eklenmez',
    mesajlar: ['• XPEL HP: 11.000₺\n• Global: 7.500₺'],
    sonMusteri: 'Cam filmi ne kadar',
    beklenen: null,
    neden: 'Seri listesi dökümünde toplam anlamsız.',
  },
  {
    ad: '5+ rakam (liste dökümü) → toplam eklenmez',
    mesajlar: [
      '• A: 11.000₺\n• B: 7.500₺\n• C: 10.000₺\n• D: 12.000₺\n• E: 17.500₺',
    ],
    sonMusteri: 'hepsi toplam ne kadar',
    beklenen: null,
    neden: 'Alternatif serilerin toplamı müşteriye yanlış rakam söyler.',
  },
]

for (const v of TOPLAM_VAKALARI) {
  const sonuc = toplamiEkle(v.mesajlar, v.sonMusteri).join('\n')
  const dogru = v.beklenen ? v.beklenen.test(sonuc) : !/toplamı/i.test(sonuc)
  if (dogru) {
    gecti += 1
    console.log(`  ✓ ${v.ad}`)
  } else {
    kalanlar.push(v.ad)
    console.log(`  ✗ ${v.ad} — çıktı: ${sonuc.slice(-80)}`)
    console.log(`      kaynak: ${v.neden}`)
  }
}

// ── Öksüz tanıtım cümlesi (16 Ağustos: "şöyle:" deyip liste gelmedi) ───────
console.log('\nÖksüz tanıtım — "şöyle:" deyip listesiz bırakmasın')

const OKSUZ_VAKALARI: { ad: string; mesajlar: string[]; beklenen: number; neden: string }[] = [
  {
    ad: 'Vaadi tutulmayan "şöyle:" mesajı düşer',
    mesajlar: [
      'Anlıyorum, aracınız şimdiden hayırlı olsun 😊',
      'Seçtiğiniz kalemlerin fiyatları ayrı ayrı şöyle:',
      '3 taksit seçeneğimiz mevcut.',
    ],
    beklenen: 2,
    neden: 'Sahada tanıtım cümlesi gitti, ardından liste hiç gelmedi.',
  },
  {
    ad: 'Listesi gelen tanıtım korunur',
    mesajlar: ['Cam filmi seçeneklerimiz şöyle:', '• XPEL HP Serisi – 11.000₺\n• Global – 7.500₺'],
    beklenen: 2,
    neden: 'Vaat tutulmuş; dokunulmaz.',
  },
  {
    ad: 'Sıradan iki nokta kapsam dışı',
    mesajlar: ['Adresimiz:', 'Eryaman, Ankara'],
    beklenen: 2,
    neden: 'Yalnızca liste/fiyat vaat eden tanıtımlara dokunulur.',
  },
]

for (const v of OKSUZ_VAKALARI) {
  const sonuc = oksuzTanitimiAt(v.mesajlar)
  if (sonuc.length === v.beklenen) {
    gecti += 1
    console.log(`  ✓ ${v.ad} — ${sonuc.length} mesaj`)
  } else {
    kalanlar.push(v.ad)
    console.log(`  ✗ ${v.ad} — beklenen ${v.beklenen}, gelen ${sonuc.length} (${v.neden})`)
  }
}

const TOPLAM =
  VAKALAR.length +
  YERLESIM_VAKALARI.length +
  ISIM_VAKALARI.length +
  BASVURU_VAKALARI.length +
  TEKRAR_VAKALARI.length +
  SORU_VAKALARI.length +
  TOPLAM_VAKALARI.length +
  OKSUZ_VAKALARI.length

console.log(`\n${'─'.repeat(70)}`)
console.log(`${gecti}/${TOPLAM} kilit doğru davrandı`)
console.log(
  '\nBu sınav kuralın KODDA doğru yazıldığını kanıtlar (yakalama + yanlış alarm yokluğu).',
)
console.log('Modelin o hatayı kaç koşuda yapacağını ölçmek için: npm run geribildirim:dogrula')

if (kalanlar.length > 0) {
  console.log(`\nDüzeltilecek: ${kalanlar.join(', ')}`)
  process.exit(1)
}
