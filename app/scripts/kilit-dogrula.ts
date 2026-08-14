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

import { eksikleriBul } from '../src/lib/motor'
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
]

function kosVaka(v: Vaka): { gecti: boolean; ayrinti: string } {
  const yapili: YapiliCikti = { ...TEMEL, ...v.yapiliEzme, mesajlar: v.mesajlar }
  const eksikler = eksikleriBul(yapili, {
    ilkCevapMi: v.ilkCevapMi ?? false,
    isim: v.isim ?? null,
    oncekiBotMetni: v.oncekiBotMetni ?? '',
    sonMusteriMetni: v.sonMusteriMetni ?? '',
    tumMusteriMetni: v.tumMusteriMetni ?? v.sonMusteriMetni ?? '',
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

console.log(`\n${'─'.repeat(70)}`)
console.log(`${gecti}/${VAKALAR.length} kilit doğru davrandı`)
console.log(
  '\nBu sınav kuralın KODDA doğru yazıldığını kanıtlar (yakalama + yanlış alarm yokluğu).',
)
console.log('Modelin o hatayı kaç koşuda yapacağını ölçmek için: npm run geribildirim:dogrula')

if (kalanlar.length > 0) {
  console.log(`\nDüzeltilecek: ${kalanlar.join(', ')}`)
  process.exit(1)
}
