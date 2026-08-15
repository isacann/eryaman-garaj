// PROMPT NETLİK SINAVI — bakiye gerekmez.
//
// Soru: "Model bu hataları gerçekten YAPMAZ mı?" Bunu bakiyesiz tam olarak
// cevaplamak imkânsız (gerçek model çağrısı gerekir). Ama bir adım atılabilir:
//
// Aşağıdaki cevaplar, sistem promptu BAŞTAN SONA OKUNARAK ve kurallarına
// uyularak elle yazıldı (Claude Opus 5 tarafından, üretimdeki modelin okuduğu
// promptun aynısından). Sonra `yanitUret()` akışından geçiriliyor.
//
// Eğer bu cevaplarda HİÇ eksik çıkmıyorsa: prompt, kurallarını izleyen bir
// modelin Fatih Bey'in şikâyet ettiği hataları YAPMAMASI için yeterince net.
// Eğer eksik çıkıyorsa: prompt kendi kurallarıyla çelişiyor ya da bulanık —
// yani kusur modelin değil, promptun. Bu ayrım bakiyesiz ölçülebiliyor.
//
// Çalıştır: npx tsx scripts/prompt-netlik-dogrula.ts

import { saglayiciAl, yanitUret } from '../src/lib/motor'
import { sahteSenaryoKur, sahteSenaryoTemizle } from '../src/lib/motor/sahte'
import type { KonusmaMesaji } from '../src/lib/motor/types'

process.env.MOTOR_SAGLAYICI = 'sahte'

type Vaka = {
  ad: string
  sikayet: string
  konusma: KonusmaMesaji[]
  isim?: string
  /** Promptu izleyerek yazılmış cevap. Eksik ÇIKMAMASI bekleniyor. */
  cevap: string[]
  yapili?: Record<string, unknown>
}

const VAKALAR: Vaka[] = [
  {
    ad: 'T10F mat + krom (13:11 ekranı)',
    sikayet: '"Yalnızca mat ppf için komple yapıyoruz demesine gerek yok"',
    isim: 'Enis',
    konusma: [{ rol: 'musteri', metin: 'T10F oltu mat ppf ve kromlar siyah kaplanacak' }],
    // Prompt kuralları: ilk cevapta selam+isim (satır 37 civarı), müşteri komple
    // mat istiyor → kısıt cümlesi KURMA (satır 51-55), fiyat sorulmadı →
    // içerik anlat fiyat sonraki turda, sıcak açılış (satır 102).
    cevap: [
      'Merhabalar Enis bey, hoşgeldiniz 😊',
      'T10F\'nizde mat PPF ile kromların Piano Black dönüşümü gerçekten şık bir kombinasyon oluyor.',
      'Uygulama içeriklerimizi yönlendiriyorum:\n✅ XPEL Mat PPF, 190 mikron, 5 yıl garanti\n✅ Krom detaylarda Piano Black dönüşüm\n✅ Bilgisayarlı kesimle aracınıza özel uygulama',
      'Teslim süremiz 2-3 iş günü. Fiyat bilgisini de hemen yönlendirebilirim, ister misiniz?',
    ],
    yapili: { fiyat_verilebilir_mi: false, kapsam: 'komple mat PPF + obsidyen', arac: 'Togg T10F' },
  },
  {
    ad: 'Randevu sorusu (16:15 ekranı)',
    // ⚠ 15 Ağustos: numara isteme kuralı TERSİNE döndü, örnek cevap güncellendi.
    sikayet: 'Randevuda numara İSTEMEDEN gün/saate götürme + araç tekrar sorma',
    konusma: [
      { rol: 'musteri', metin: 'Bmw G20 komple ppf fiyatı nedir' },
      {
        rol: 'bot',
        metin: 'Komple PPF: XPEL Xtreme 100.000₺ (190 mikron, 5 yıl garanti), Global PPF 75.000₺.',
      },
      { rol: 'musteri', metin: 'Peki yarın için boşlugunuz var mı' },
    ],
    // Prompt randevu bölümü: numara isteme YASAK, net gün/saate götür.
    // Prompt: aracı biliyorsan tekrar sorma, adıyla an.
    cevap: [
      'Yarın için müsaitliğimiz var, BMW G20\'nizi bekliyoruz.',
      'Sabah mı öğleden sonra mı sizin için uygun olur?',
    ],
    yapili: {
      arac: 'BMW G20',
      niyet: 'randevu',
      fiyat_verilebilir_mi: false,
      randevu_talebi: 'yarın',
    },
  },
  {
    ad: 'Komple isteyene Global önerisi (16:23 ekranı)',
    sikayet: '"Komple olana 4 parça sunuyor"',
    konusma: [
      { rol: 'musteri', metin: 'Bmw G20 komple ppf düşünüyorum' },
      {
        rol: 'bot',
        metin:
          'Komple kaplamada seçeneklerimiz:\nXPEL Xtreme – 100.000₺\n• 190 mikron, 5 yıl garanti\nGlobal PPF – 75.000₺\n• 190 mikron, 5 yıl garanti',
      },
      { rol: 'musteri', metin: 'Global serisi için öneriniz nedir' },
    ],
    // Prompt satır 46-50: komple diyene kısmi sunma.
    // Prompt satır 124-126: Global'e self-healing/TPU yazma.
    cevap: [
      'Global PPF, komple kaplamada bütçe dostu ve dengeli bir tercih oluyor.',
      'Giriş seviyesi olarak taş izi, çizilme ve UV korumasını 190 mikron kalınlıkla, 5 yıl garantiyle sağlıyor.',
      'Fiyat/performans olarak XPEL Xtreme\'i de değerlendirebilirsiniz; aradaki fark parlaklık ve dayanımda kendini gösteriyor.',
      'Karar verdiğinizde hangi gün getirmek istediğinizi yazmanız yeterli, randevunuzu hemen planlayalım.',
    ],
    yapili: { arac: 'BMW G20', kapsam: 'komple PPF' },
  },
  {
    ad: 'Ton — sıfır araç, fiyat sorusu (Furkan testi)',
    sikayet: '"Tonlamaya bakar mısın, GPT\'de cidden karşısında insan var gibi"',
    isim: 'Furkan',
    konusma: [
      {
        rol: 'musteri',
        metin:
          'Aracım yarın bayiden çıkıyor komple ppf kapatmayı düşünüyorum fiyatlariniz ne durumda hangi ürünleri kullanıyorsunuz',
      },
    ],
    // Prompt satır 102-127: duruma özel sıcak açılış + ürünleri özellikleriyle
    // yaz + Xtreme'e self-healing/TPU YAZMA.
    cevap: [
      'Merhabalar Furkan bey, aracınız şimdiden hayırlı olsun 😊 Bayiden yarın çıkacak olması PPF için en ideal zaman; teslim alınır alınmaz uygulandığında boya ilk kilometreden itibaren korunmuş oluyor.',
      'Komple PPF seçeneklerimiz:\nXPEL Xtreme – 100.000₺\n• 190 mikron, 5 yıl garanti\n• Üstün parlaklık, günlük kullanım için ideal\nXPEL EXO Armor – 125.000₺\n• 200+ mikron, 7 yıl garanti\n• En çok tercih edilen, maksimum darbe ve taş izi direnci\nXPEL Ultimate Plus – 170.000₺\n• 200 mikron, 10 yıl garanti\n• Self-healing, hidrofobik yüzey\nGlobal PPF – 75.000₺\n• 190 mikron, 5 yıl garanti\n• Giriş seviyesi taş izi ve UV koruması',
      'Fiyat/performans olarak özellikle XPEL Xtreme çok güzel bir tercih oluyor.',
      'Komple uygulamada ön 2 cam filmi, seramik kaplama, araç içi deri bakımı, kapı eşikleri ve jant seramiği de dahildir. Teslim süremiz 2-3 iş günü.',
    ],
  },
  {
    ad: 'Kısmi mat sorusu (yapılmıyor, devretme)',
    sikayet: '11 Ağustos kararı: kısmi mat YAPILMIYOR, bot devretmez net söyler',
    konusma: [{ rol: 'musteri', metin: 'Kaputa mat ppf yaptırmak istiyorum fiyatı nedir' }],
    // Prompt satır 51-55 + kısmi mat bloğu: net söyle, devretme, rakam uydurma.
    cevap: [
      'Mat uygulamayı yalnızca komple yapıyoruz, kısmi mat (kaput / ön 3 / ön 4 parça) uygulamamız bulunmuyor.',
      'Komple mat PPF fiyatlarımız:\nXPEL Xtreme MAT – 110.000₺\n• 190 mikron, 5 yıl garanti\nXPEL Ultimate Stealth – 175.000₺\n• 200 mikron, 10 yıl garanti',
      'Kaput bölgesinde koruma istiyorsanız parlak seride kısmi seçeneklerimizi de anlatabilirim.',
    ],
    yapili: { kapsam: 'kısmi mat PPF', devir_gerekli_mi: false },
  },
  {
    ad: '5 cam komple (ön 2 cam eklemesin)',
    sikayet: 'Fatih Bey 11 Ağustos: "5 cam demiş, ayrıca ön 2 cam fiyatı vermesine gerek yok"',
    isim: 'Halim',
    konusma: [
      { rol: 'musteri', metin: 'Cam Filmi Kampanyanız hakkında bilgi alabilirmiyim' },
      { rol: 'bot', metin: 'Merhabalar Halim bey, hoşgeldiniz. Aracınız ve kaç cam düşünüyorsunuz?' },
      { rol: 'musteri', metin: 'Ön hariç hepsi civic fc5 arka kelebeklerde var' },
    ],
    // Prompt satır 61-66: istenmeyen kalemin fiyatını yazma.
    cevap: [
      'Tabi, Civic FC5 için ön cam hariç 5 cam komple fiyatlarımız:\n• XPEL HP Serisi – 11.000₺\n• Global QDP Ceramic – 10.000₺ (en çok tercih edilen)\n• Global HP Black – 7.500₺',
      'Hepsinde ömür boyu garanti var; arka kelebek camlarınız da bu kapsama dahil.',
      'Ön cam ayrıca fiyatlandırılıyor, isterseniz onu da paylaşabilirim.',
    ],
    yapili: { arac: 'Honda Civic FC5', kapsam: '5 cam komple' },
  },
]

async function kos(v: Vaka) {
  // Senaryoya TEK cevap koyuyoruz: düzeltme turu tetiklenirse aynı cevap tekrar
  // döner, yani "kalan eksik" olarak raporlanır. Böylece promptu izleyen cevabın
  // kuralları geçip geçmediği net görülür.
  sahteSenaryoKur([{ mesajlar: v.cevap, yapili: v.yapili }])

  const yanit = await yanitUret(
    { konusma: v.konusma, kisiAdi: v.isim ?? null, simdi: new Date('2026-08-12T09:00:00Z') },
    saglayiciAl('sahte'),
  )
  sahteSenaryoTemizle()

  // Cevap değişmediyse hiç eksik bulunmadı (düzeltme turu koşmadı).
  const degismedi = yanit.yapili.mesajlar.join('\n') === v.cevap.join('\n')
  return { temiz: degismedi, giden: yanit.yapili.mesajlar.join(' / ') }
}

async function main() {
  console.log('\nPROMPT NETLİK SINAVI (bakiye gerekmez)')
  console.log('Cevaplar sistem promptu okunarak, kurallarına uyularak yazıldı.')
  console.log('Ölçülen: promptu izleyen bir cevap denetimden temiz geçiyor mu.\n')

  let temiz = 0
  for (const v of VAKALAR) {
    const s = await kos(v)
    if (s.temiz) temiz += 1
    console.log(`${s.temiz ? '✓' : '✗'} ${v.ad}`)
    console.log(`    şikâyet: ${v.sikayet}`)
    if (!s.temiz) console.log(`    ⚠ denetim müdahale etti → ${s.giden.slice(0, 160)}`)
    console.log('')
  }

  console.log('─'.repeat(72))
  console.log(`${temiz}/${VAKALAR.length} vakada promptu izleyen cevap denetimden TEMİZ geçti`)
  console.log('\nBu ne demek:')
  console.log('  ✔ Prompt, kurallarını izleyen bir modelin Fatih Bey\'in şikâyet ettiği')
  console.log('    hataları YAPMAMASI için yeterince net ve kendi içinde çelişkisiz.')
  console.log('  ✖ Bu sınav gerçek modelin kaç koşuda kurala uyacağını ÖLÇMEZ.')
  console.log('    Onun için: npm run geribildirim:dogrula (bakiye gerekir)')

  if (temiz < VAKALAR.length) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
