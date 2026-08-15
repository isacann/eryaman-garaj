// 🆓 BAKİYE GEREKMEZ — randevu zamanı çözücüsünün ve hatırlatma metninin sınavı.
//
// Koş: npm run randevu:dogrula
//
// NEDEN VAR: `randevu_at` üzerine müşteriye giden bir mesaj zamanlanıyor
// ("yarın aracınızı getirecektiniz"). Model burada uydurursa ya da yıl/ay
// karıştırırsa yanlış güne mesaj gider — müşteri gözünde sistem güvenilmez
// olur. Tarih doğrulaması bu yüzden koda kilitli, modele bırakılmadı.

import { randevuTalebiGecerliMi, randevuZamaniCoz } from '../src/lib/motor/sema'
import { proaktifSessizMi } from '../src/lib/motor/saat'
import { hatirlatmaAni, randevuHatirlatmaMetni } from '../src/lib/randevu'

// Sabit "şimdi": 14 Ağustos 2026 Cuma, 12:00 Türkiye saati.
const SIMDI = new Date('2026-08-14T09:00:00Z')

type Vaka = {
  ad: string
  neden: string
  girdi: unknown
  /** null = reddedilmeli. Metin = beklenen ISO çıktı. */
  bekleniyor: string | null
}

const VAKALAR: Vaka[] = [
  {
    ad: 'Yarın 14:00',
    neden: 'En sık senaryo. Türkiye saati UTC+3, 14:00 → 11:00Z.',
    girdi: '2026-08-15T14:00',
    bekleniyor: '2026-08-15T11:00:00.000Z',
  },
  {
    ad: 'Boşlukla ayrılmış biçim',
    neden: 'Model bazen T yerine boşluk yazıyor; kabul edilmeli.',
    girdi: '2026-08-20 09:30',
    bekleniyor: '2026-08-20T06:30:00.000Z',
  },
  {
    ad: 'Saniye eklenmiş biçim',
    neden: 'Fazladan saniye alanı biçimi bozmamalı.',
    girdi: '2026-08-18T16:45:00',
    bekleniyor: '2026-08-18T13:45:00.000Z',
  },
  {
    ad: '🔴 Geçmiş tarih',
    neden: 'Geçmişe hatırlatma kurulamaz. Model "dün"ü çevirdiyse reddedilmeli.',
    girdi: '2026-08-13T10:00',
    bekleniyor: null,
  },
  {
    ad: '🔴 Aynı an',
    neden: 'Şu ana randevu, hatırlatma için de geç.',
    girdi: '2026-08-14T12:00',
    bekleniyor: null,
  },
  {
    ad: '🔴 Yıl karışması (2027)',
    neden:
      'Modelin en tipik hatası. Müşteri "cumartesi" dedi, model bir sonraki yılı yazdı — 6 ay sınırı bunu yakalar.',
    girdi: '2027-08-15T14:00',
    bekleniyor: null,
  },
  {
    ad: '🔴 Olmayan tarih (31 Şubat)',
    neden: 'JS bunu sessizce 3 Mart yapar; müşterinin dediği gün değildir.',
    girdi: '2027-02-31T10:00',
    bekleniyor: null,
  },
  {
    ad: '🔴 Serbest metin',
    neden: 'Model biçime uymayıp "yarın öğleden sonra" yazarsa reddedilmeli.',
    girdi: 'yarın öğleden sonra',
    bekleniyor: null,
  },
  {
    ad: '🔴 Boş metin',
    neden: 'Zaman netleşmediğinde model burayı boş bırakıyor — normal durum.',
    girdi: '',
    bekleniyor: null,
  },
  {
    ad: '🔴 Sayı geldi',
    neden: 'Tip bozuksa patlamamalı, sessizce reddetmeli.',
    girdi: 12345,
    bekleniyor: null,
  },
  {
    ad: 'Sınırın hemen içi (5 ay sonra)',
    neden: 'Uzak ama makul randevu reddedilmemeli.',
    girdi: '2027-01-10T11:00',
    bekleniyor: '2027-01-10T08:00:00.000Z',
  },
]

let gecen = 0
const dusenler: string[] = []

console.log('\nRandevu zamanı çözücüsü — bakiyesiz sınav')
console.log(`(şimdi = 14 Ağustos 2026 Cuma, 12:00 TR)\n`)
console.log('─'.repeat(72))

for (const vaka of VAKALAR) {
  let sonuc: string | null
  try {
    sonuc = randevuZamaniCoz(vaka.girdi, SIMDI)
  } catch (e) {
    dusenler.push(`${vaka.ad} — ÇÖZÜCÜ PATLADI: ${e instanceof Error ? e.message : e}`)
    console.log(`✗ ${vaka.ad}\n    çözücü patladı`)
    continue
  }

  if (sonuc !== vaka.bekleniyor) {
    dusenler.push(`${vaka.ad} — beklenen ${vaka.bekleniyor ?? 'null'}, gelen ${sonuc ?? 'null'}`)
    console.log(`✗ ${vaka.ad}`)
    console.log(`    beklenen: ${vaka.bekleniyor ?? 'null (reddetmeliydi)'}`)
    console.log(`    gelen:    ${sonuc ?? 'null'}`)
    console.log(`    neden önemli: ${vaka.neden}`)
    continue
  }

  gecen++
  console.log(`✓ ${vaka.ad}`)
}

// ---- Hatırlatma anı: kademeli seçim ----
//
// 14 Ağustos uçtan uca sınavında yakalandı: katı 24 saat kuralı, sahadaki en
// sık senaryoyu ("bugün yazıp yarın getireyim") hatırlatmasız bırakıyordu.
console.log('\nHatırlatma anı (kademeli)')
console.log('─'.repeat(72))

const anVakalari: {
  ad: string
  neden: string
  randevu: string
  simdi: string
  bekleniyor: string | null
}[] = [
  {
    ad: '3 gün sonrası → 24 saat önce',
    neden: 'Bol zaman varken tercih edilen kademe kullanılmalı.',
    randevu: '2026-08-17T11:00:00Z', // TR pazartesi 14:00
    simdi: '2026-08-14T09:00:00Z',
    bekleniyor: '2026-08-16T11:00:00.000Z',
  },
  {
    ad: 'Yarın 15:00, şimdi 15:30 → randevu günü sabahı',
    neden:
      'ASIL SENARYO. 24 saat öncesi geçmişte kaldı; hatırlatma sabaha kaymalı, yoksa hiç gitmez.',
    randevu: '2026-08-15T12:00:00Z', // TR cumartesi 15:00
    simdi: '2026-08-14T12:30:00Z', // TR cuma 15:30
    bekleniyor: '2026-08-15T07:00:00.000Z', // TR cumartesi 10:00
  },
  {
    ad: 'Bugün 18:00, şimdi 12:00 → 2 saat önce',
    neden: 'Aynı gün randevusunda sabah da geçmişse son kademe devreye girer.',
    randevu: '2026-08-14T15:00:00Z', // TR 18:00
    simdi: '2026-08-14T09:00:00Z', // TR 12:00
    bekleniyor: '2026-08-14T13:00:00.000Z', // TR 16:00
  },
  {
    ad: '🔴 Randevuya 1 saat kaldı → hatırlatma yok',
    neden: 'Müşteri zaten yola çıkmış olabilir; bu noktada mesaj rahatsızlıktır.',
    randevu: '2026-08-14T10:00:00Z',
    simdi: '2026-08-14T09:00:00Z',
    bekleniyor: null,
  },
]

for (const v of anVakalari) {
  const sonuc = hatirlatmaAni(new Date(v.randevu), new Date(v.simdi))
  const gelen = sonuc ? sonuc.toISOString() : null
  if (gelen !== v.bekleniyor) {
    dusenler.push(`${v.ad} — beklenen ${v.bekleniyor ?? 'null'}, gelen ${gelen ?? 'null'}`)
    console.log(`✗ ${v.ad}`)
    console.log(`    beklenen: ${v.bekleniyor ?? 'null'}`)
    console.log(`    gelen:    ${gelen ?? 'null'}`)
    console.log(`    neden önemli: ${v.neden}`)
  } else {
    gecen++
    console.log(`✓ ${v.ad}`)
  }
}

// ---- Hatırlatma metni ----
console.log('\nHatırlatma metni')
console.log('─'.repeat(72))

const metinVakalari: {
  ad: string
  randevu: Date
  gonderim: Date
  kisi: string | null
  icermeli: string[]
  icermemeli?: string[]
}[] = [
  {
    ad: 'Bir gün önce gönderiliyor → "yarın"',
    randevu: new Date('2026-08-15T11:00:00Z'), // TR cumartesi 14:00
    gonderim: new Date('2026-08-14T11:00:00Z'), // TR cuma 14:00
    kisi: 'Mustafa bey',
    icermeli: ['Mustafa bey', '14:00', 'Cumartesi', 'yarın'],
  },
  {
    ad: '🔴 Aynı gün gönderiliyor → "bugün" demeli',
    randevu: new Date('2026-08-15T12:00:00Z'), // TR cumartesi 15:00
    gonderim: new Date('2026-08-15T07:00:00Z'), // TR cumartesi 10:00
    kisi: 'Mustafa bey',
    icermeli: ['bugün', '15:00', 'Cumartesi'],
    // "yarın" yazarsa müşteriye yanlış gün söylenmiş olur.
    icermemeli: ['yarın'],
  },
  {
    ad: 'İsimsiz müşteri',
    randevu: new Date('2026-08-17T06:30:00Z'), // TR pazartesi 09:30
    gonderim: new Date('2026-08-16T06:30:00Z'),
    kisi: null,
    icermeli: ['Merhabalar,', '09:30', 'Pazartesi'],
  },
]

for (const m of metinVakalari) {
  const metin = randevuHatirlatmaMetni(m.randevu, m.kisi, m.gonderim)
  const fazla = (m.icermemeli ?? []).filter((p) => metin.includes(p))
  if (fazla.length > 0) {
    dusenler.push(`${m.ad} — metinde olmaması gereken: ${fazla.join(', ')}`)
    console.log(`✗ ${m.ad}\n    olmamalıydı: ${fazla.join(', ')}\n    metin: ${metin}`)
    continue
  }
  const eksik = m.icermeli.filter((p) => !metin.includes(p))
  if (eksik.length > 0) {
    dusenler.push(`${m.ad} — metinde eksik: ${eksik.join(', ')}`)
    console.log(`✗ ${m.ad}\n    eksik: ${eksik.join(', ')}\n    metin: ${metin}`)
  } else {
    gecen++
    console.log(`✓ ${m.ad}`)
    console.log(`    "${metin}"`)
  }
}

// ── Randevu talebi filtresi (Fatih Bey, 15 Ağustos: "en ufak merhaba mesajına
// bile randevu alıyor"). Kayda değer olan gün/saat; niyet değil.
console.log('\nRandevu talebi filtresi — gün/saat yoksa kayıt açılmaz')
console.log('─'.repeat(72))

const talepVakalari: { metin: string; gecerli: boolean; neden: string }[] = [
  // Reddedilmeli — sahadaki kusur bunlar
  { metin: 'merhaba', gecerli: false, neden: 'Selamlama. Sahada randevu bildirimi düşürüyordu.' },
  { metin: 'randevu almak istiyor', gecerli: false, neden: 'Niyet var, gün yok.' },
  { metin: 'gelmek istiyor', gecerli: false, neden: 'Niyet var, gün yok.' },
  { metin: 'ne zaman müsaitsiniz', gecerli: false, neden: 'Soru soruyor, gün söylemiyor.' },
  { metin: 'fiyat sordu', gecerli: false, neden: 'Randevuyla alakasız.' },
  { metin: 'yok', gecerli: false, neden: 'Modelin "alan boş" kalıbı.' },
  { metin: 'birkaç güne', gecerli: false, neden: 'Belirsiz — hatırlatma kurulamaz.' },
  // Kabul edilmeli — gerçek randevular kaçmamalı
  { metin: 'yarın 14:00', gecerli: true, neden: 'Gün + saat.' },
  { metin: 'cumartesi öğleden sonra', gecerli: true, neden: 'Hafta günü + bölüm.' },
  { metin: 'bugün akşam', gecerli: true, neden: 'Göreli gün + bölüm.' },
  { metin: 'salı sabah getireceğim', gecerli: true, neden: 'Hafta günü.' },
  { metin: '20 Ağustos', gecerli: true, neden: 'Tarih.' },
  { metin: '20.08 saat 10', gecerli: true, neden: 'Sayısal tarih + saat.' },
  { metin: 'hafta sonu uğrayacak', gecerli: true, neden: 'Hafta sonu somut bir aralık.' },
  { metin: 'saat 15 gibi', gecerli: true, neden: 'Saat söylenmiş.' },
]

for (const v of talepVakalari) {
  const sonuc = randevuTalebiGecerliMi(v.metin)
  const isaret = v.gecerli ? '' : '🔴 '
  if (sonuc === v.gecerli) {
    gecen++
    console.log(`✓ ${isaret}"${v.metin}" → ${sonuc ? 'kayıt açılır' : 'kayıt açılmaz'}`)
  } else {
    dusenler.push(`randevu talebi "${v.metin}" — beklenen ${v.gecerli}, gelen ${sonuc}`)
    console.log(`✗ ${isaret}"${v.metin}" → beklenen ${v.gecerli}, gelen ${sonuc} (${v.neden})`)
  }
}

// ── Proaktif sessiz saat (Fatih Bey, 15 Ağustos: "gecenin 1'inde mesaj atıyor").
// Mesai 01:00'e kadar sürer ama botun KENDİ başlattığı mesaj 22:00'de susar.
console.log('\nProaktif sessiz saat — takip/hatırlatma gece gitmez')
console.log('─'.repeat(72))

const saatVakalari: { saat: string; sessiz: boolean; neden: string }[] = [
  { saat: '2026-08-14T21:50:00+03:00', sessiz: false, neden: '22:00 öncesi, gönderilir.' },
  { saat: '2026-08-14T22:00:00+03:00', sessiz: true, neden: 'Sınır anı — susar.' },
  { saat: '2026-08-14T23:30:00+03:00', sessiz: true, neden: 'Gece.' },
  { saat: '2026-08-15T00:50:00+03:00', sessiz: true, neden: 'SAHADAKİ KUSUR: bu saatte takip gitmişti.' },
  { saat: '2026-08-15T03:00:00+03:00', sessiz: true, neden: 'Gece.' },
  { saat: '2026-08-15T07:59:00+03:00', sessiz: true, neden: 'Açılıştan bir dakika önce.' },
  { saat: '2026-08-15T08:00:00+03:00', sessiz: false, neden: 'Açılış — kuyruk boşalır.' },
  { saat: '2026-08-15T14:00:00+03:00', sessiz: false, neden: 'Gündüz.' },
]

for (const v of saatVakalari) {
  const an = new Date(v.saat)
  const sonuc = proaktifSessizMi(an)
  const yerel = v.saat.slice(11, 16)
  if (sonuc === v.sessiz) {
    gecen++
    console.log(`✓ ${v.sessiz ? '🔴 ' : ''}${yerel} → ${sonuc ? 'sabaha ertelenir' : 'gönderilir'}`)
  } else {
    dusenler.push(`proaktif saat ${yerel} — beklenen ${v.sessiz}, gelen ${sonuc}`)
    console.log(`✗ ${yerel} → beklenen ${v.sessiz}, gelen ${sonuc} (${v.neden})`)
  }
}

const toplam =
  VAKALAR.length +
  anVakalari.length +
  metinVakalari.length +
  talepVakalari.length +
  saatVakalari.length
console.log('─'.repeat(72))
console.log(`\n${gecen}/${toplam} kontrol geçti\n`)

if (dusenler.length > 0) {
  console.log('Düşenler:')
  for (const d of dusenler) console.log(`  • ${d}`)
  console.log('')
  process.exit(1)
}
