// Fatih Bey'in 12 Ağustos şikâyetlerinin UÇTAN UCA sınavı — BEDAVA KOŞAR.
//
// `kilit-dogrula` yalnızca denetim fonksiyonunu sınıyordu ("kural doğru yazılmış
// mı"). Bu sınav bir adım öteye gidiyor: sağlayıcıya Fatih Bey'in EKRANINDA
// GÖRDÜĞÜ bozuk cevabı ürettirip `yanitUret()`'in tamamını koşuyor —
// eksik tespiti → düzeltme turu → kod müdahalesi → müşteriye giden son metin.
//
// Yani cevapladığı soru şu: "Model bu hatayı yaparsa, sistem müşteriye giden
// mesajı düzeltiyor mu?" Cevabı bakiye olmadan alınabiliyor.
//
// Cevaplamadığı soru: "Gerçek model bu hatayı kaç koşuda yapar?" — onun için
// `npm run geribildirim:dogrula` ve bakiye gerekir.
//
// Çalıştır: npx tsx scripts/uctan-uca-dogrula.ts

import { saglayiciAl, yanitUret } from '../src/lib/motor'
import { sahteSenaryoKur, sahteSenaryoTemizle } from '../src/lib/motor/sahte'
import type { KonusmaMesaji } from '../src/lib/motor/types'

process.env.MOTOR_SAGLAYICI = 'sahte'

type Vaka = {
  ad: string
  sikayet: string
  konusma: KonusmaMesaji[]
  isim?: string
  /** 1. çağrı: modelin ürettiği BOZUK cevap (Fatih Bey'in gördüğü). */
  bozuk: string[]
  /** 2. çağrı: düzeltme turunda modelin verdiği düzgün cevap. */
  duzgun: string[]
  bozukYapili?: Record<string, unknown>
  /** Son çıktıda OLMAMASI gereken kalıp. */
  olmamali: RegExp
  /** Son çıktıda OLMASI gereken kalıp (varsa). */
  olmali?: RegExp
}

const VAKALAR: Vaka[] = [
  {
    ad: '1. Gereksiz mat kısıtlaması',
    sikayet: '"Yalnızca mat ppf için komple yapıyoruz demesine gerek yok"',
    isim: 'Enis',
    konusma: [{ rol: 'musteri', metin: 'T10F oltu mat ppf ve kromlar siyah kaplanacak' }],
    bozuk: [
      'Merhabalar Enis bey, tabi yardımcı olalım.',
      'Mat PPF uygulaması yalnızca komple yapılıyor. Krom detaylar için ayrıca siyah kaplama uygulanabilir.',
    ],
    duzgun: [
      'Merhabalar Enis bey, hoşgeldiniz 😊',
      'T10F için mat PPF ve krom detayların siyaha dönüşümü çok şık duruyor. Uygulama içeriklerimizi yönlendiriyorum.',
    ],
    bozukYapili: { fiyat_verilebilir_mi: false, kapsam: 'mat PPF' },
    olmamali: /(yalnızca|sadece)[^.\n]{0,20}komple[^.\n]{0,30}(yapıl|uygulan)/i,
  },
  {
    ad: '2. Randevuda telefon istemiyor',
    sikayet: '"İletişim numarasını istesin, size hemen dönüş sağlıyoruz desin"',
    konusma: [
      { rol: 'musteri', metin: 'Bmw G20 komple ppf fiyatı nedir' },
      { rol: 'bot', metin: 'Komple PPF: XPEL Xtreme 100.000₺, Global PPF 75.000₺.' },
      { rol: 'musteri', metin: 'Peki yarın için boşlugunuz var mı' },
    ],
    bozuk: [
      'Yarın için uygunluk durumumuzu kontrol edebilmemiz için saat aralığını iletebilir misiniz?',
      'Aracınızı da yazarsanız ona göre yardımcı olalım.',
    ],
    duzgun: [
      'Yarın için müsaitliğimizi kontrol edip size dönüş sağlıyoruz.',
      'İletişim numaranızı paylaşırsanız hemen dönüş yapalım.',
    ],
    bozukYapili: { arac: 'BMW G20', niyet: 'randevu', fiyat_verilebilir_mi: false },
    olmamali: /aracınızı da yaz|marka.{0,15}model/i,
    olmali: /numara|telefon/i,
  },
  {
    ad: '3. Bildiği aracı tekrar soruyor',
    sikayet: '"Müşteri aracın modelini yazmış ama tekrardan istiyor"',
    konusma: [
      { rol: 'musteri', metin: 'Komple ppf düşünüyorum' },
      { rol: 'bot', metin: 'Komple PPF için değerlendirelim.' },
      { rol: 'musteri', metin: 'Aracım Bmw G20' },
    ],
    bozuk: ['Aracınızın marka/modelini paylaşırsanız size en doğru fiyatı hemen yönlendireyim.'],
    duzgun: ['BMW G20 için komple PPF uygulamasında yüzey hazırlığını ona göre planlıyoruz.'],
    bozukYapili: { arac: 'BMW G20', fiyat_verilebilir_mi: false },
    olmamali: /marka.{0,15}model|aracınız(ın)?\s*(ne|hangi)/i,
  },
  {
    ad: '4. Komple isteyene kısmi teklif',
    sikayet: '"Komple olana 4 parça sunuyor"',
    konusma: [
      { rol: 'musteri', metin: 'Bmw G20 komple ppf düşünüyorum' },
      { rol: 'bot', metin: 'Komple kaplamada Global PPF 75.000₺.' },
      { rol: 'musteri', metin: 'Global serisi için öneriniz nedir' },
    ],
    bozuk: [
      'Global seride komple kaplama 75.000₺, 5 yıl garanti ve 190 mikron koruma sunar.',
      'İsterseniz kaput / ön 3 / ön 4 parça seçeneklerini de ayrıca yönlendirebilirim.',
    ],
    duzgun: [
      'Global seride komple kaplama 75.000₺, 5 yıl garanti ve 190 mikron koruma sunar.',
      'Uygun görürseniz randevu için iletişim numaranızı paylaşın, hemen dönüş sağlayalım.',
    ],
    olmamali: /(kaput|ön\s*3|ön\s*4)[^.\n]{0,70}(yönlendir|paylaş|sun|ilet)/i,
  },
  {
    ad: '5. Ton — kuru açılış + çıplak liste',
    sikayet: '"Tonlamaya bakar mısın, GPT\'de cidden karşısında insan var gibi"',
    isim: 'Furkan',
    konusma: [
      {
        rol: 'musteri',
        metin:
          'Aracım yarın bayiden çıkıyor komple ppf kapatmayı düşünüyorum fiyatlariniz ne durumda',
      },
    ],
    bozuk: [
      'Tamamdır, komple PPF fiyat listemizi yönlendiriyorum.',
      '• XPEL Xtreme PPF – 5 yıl garanti: 100.000₺\n• XPEL EXO Armor – 7 yıl garanti: 125.000₺\n• Global PPF – 5 yıl garanti: 75.000₺',
    ],
    duzgun: [
      'Merhabalar Furkan bey, aracınız şimdiden hayırlı olsun 😊 Bayiden yarın çıkacak olması PPF için en ideal zaman; teslim alınır alınmaz uygulandığında boya ilk kilometreden itibaren korunmuş oluyor.',
      'Komple PPF seçeneklerimiz:\nXPEL Xtreme – 100.000₺\n• 190 mikron, 5 yıl garanti\n• Üstün parlaklık\nGlobal PPF – 75.000₺\n• 190 mikron, 5 yıl garanti\n• Giriş seviyesi taş izi ve UV koruması',
    ],
    olmamali: /^(tamamdır|tabi+)[^.!?]{0,70}(yönlendiriyorum|paylaşıyorum)[.!]?$/i,
    olmali: /hayırlı olsun|ideal zaman|mikron/i,
  },
  {
    ad: '6. Uydurma ürün özelliği',
    sikayet: '12 Ağustos ajanı: Xtreme satırına self-healing + %100 TPU yazdı',
    konusma: [{ rol: 'musteri', metin: 'komple ppf fiyatı nedir, hangi ürünleri kullanıyorsunuz' }],
    bozuk: [
      'Komple PPF seçeneklerimiz:\nXPEL Xtreme – 100.000₺\n• %100 TPU, 190 mikron\n• 5 yıl garanti\n• Self-healing yüzey',
    ],
    duzgun: [
      'Komple PPF seçeneklerimiz:\nXPEL Xtreme – 100.000₺\n• 190 mikron, 5 yıl garanti\n• Üstün parlaklık, günlük kullanım için ideal',
    ],
    olmamali: /xtreme[\s\S]{0,120}(self[- ]?healing|%\s*100\s*tpu)/i,
  },
]

async function kos(v: Vaka): Promise<{ gecti: boolean; ayrinti: string; sonMetin: string }> {
  sahteSenaryoKur([{ mesajlar: v.bozuk, yapili: v.bozukYapili }, { mesajlar: v.duzgun }])

  const yanit = await yanitUret(
    { konusma: v.konusma, kisiAdi: v.isim ?? null, simdi: new Date('2026-08-12T09:00:00Z') },
    saglayiciAl('sahte'),
  )

  const sonMetin = yanit.yapili.mesajlar.join('\n')
  sahteSenaryoTemizle()

  if (v.olmamali.test(sonMetin)) {
    return { gecti: false, ayrinti: 'KUSUR MÜŞTERİYE GİTTİ', sonMetin }
  }
  if (v.olmali && !v.olmali.test(sonMetin)) {
    return { gecti: false, ayrinti: 'beklenen içerik yok', sonMetin }
  }
  return { gecti: true, ayrinti: 'sistem düzeltti', sonMetin }
}

async function main() {
  console.log('\nFatih Bey şikâyetleri — UÇTAN UCA sınav (sahte sağlayıcı, bakiye gerekmez)')
  console.log('Kurgu: modele Fatih Bey\'in gördüğü BOZUK cevabı ürettiriyoruz.')
  console.log('Ölçülen: müşteriye giden SON metinde kusur kaldı mı.\n')

  let gecti = 0
  for (const v of VAKALAR) {
    const s = await kos(v)
    if (s.gecti) gecti += 1
    console.log(`${s.gecti ? '✓' : '✗'} ${v.ad} — ${s.ayrinti}`)
    console.log(`    şikâyet: ${v.sikayet}`)
    console.log(`    giden:   ${s.sonMetin.replace(/\n/g, ' / ').slice(0, 130)}`)
    console.log('')
  }

  console.log('─'.repeat(72))
  console.log(`${gecti}/${VAKALAR.length} şikâyette sistem bozuk cevabı müşteriye GÖNDERMEDİ`)
  console.log(
    '\n⚠ Bu sınav "sistem hatayı yakalayıp düzeltiyor mu" sorusunu cevaplar.',
  )
  console.log('  "Gerçek model hatayı kaç koşuda yapar" için: npm run geribildirim:dogrula (bakiye gerekir)')

  if (gecti < VAKALAR.length) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
