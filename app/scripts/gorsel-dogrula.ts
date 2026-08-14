// Fiyat listesi görseli davranışının hedefli sınavı.
//
// Altın set gerçek arşiv konuşmalarından üretildi ve içinde "listenizi yollayın"
// diyen bir vaka yok; o yüzden görsel kuralını orada göremiyoruz. Burada iki
// senaryo doğrudan sorulur:
//
//   A) Açılışta "fiyat listeniz var mı"  → görsel GÖNDERİLMEMELİ (fiyatla açma)
//   B) Araç + kapsam netleştikten sonra liste istenir → görsel gönderilebilir
//
// Çalıştır: npx tsx scripts/gorsel-dogrula.ts

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { saglayiciAl, yanitUret } from '../src/lib/motor'
import { bayraklariBul, ilkTurdaFiyatSerbestMi } from '../src/lib/motor/denetim'
import { fiyatBilgisiAl } from '../src/lib/motor/fiyat'
import type { KonusmaMesaji } from '../src/lib/motor/types'

// altin-set.ts ile aynı kalıp: bu betik Next dışında koştuğu için .env.local
// elle yüklenir. Kabuktaki değişken dosyayı ezer.
function envYukle(): void {
  const yol = path.join(process.cwd(), '.env.local')
  if (!existsSync(yol)) return
  for (const satir of readFileSync(yol, 'utf8').split(/\r?\n/)) {
    const temiz = satir.trim()
    if (!temiz || temiz.startsWith('#')) continue
    const i = temiz.indexOf('=')
    if (i === -1) continue
    const ad = temiz.slice(0, i).trim()
    if (!process.env[ad]) process.env[ad] = temiz.slice(i + 1).trim()
  }
}
envYukle()

const saglayici = saglayiciAl()
const fiyat = fiyatBilgisiAl()
// Mesai dışında sistem promptu "asıl cevabı yazma" diyor; sınav gündüz
// davranışını ölçmeli, o yüzden saati sabitliyoruz.
const OGLEN = new Date('2026-08-10T09:00:00.000Z') // TR 12:00

let gecti = 0
let kaldi = 0

function kontrol(ad: string, sonuc: boolean, ayrinti = '') {
  if (sonuc) {
    gecti += 1
    console.log(`  ✓ ${ad}`)
  } else {
    kaldi += 1
    console.log(`  ✗ ${ad}${ayrinti ? ` — ${ayrinti}` : ''}`)
  }
}

async function tur(konusma: KonusmaMesaji[], ilkCevapMi: boolean) {
  const yanit = await yanitUret({ konusma, simdi: OGLEN }, saglayici)
  const bayraklar = bayraklariBul(yanit.metin, {
    ilkCevapMi,
    izinliRakamlar: fiyat.izinliRakamlar,
    teyitBekleyenIsler: fiyat.teyitBekleyenIsler,
    fiyatGorseliGonderildiMi: yanit.yapili.fiyat_gorseli !== null,
    fiyatVerilebilirMi: yanit.yapili.fiyat_verilebilir_mi,
    ilkTurdaFiyatSerbestMi: ilkTurdaFiyatSerbestMi(yanit.yapili),
          kalemFiyatlari: fiyat.kalemFiyatlari,
  })
  return { yanit, bayraklar }
}

// tsx bu betiği cjs'e çeviriyor, üst seviye await desteklenmiyor.
async function main() {
console.log('\nFiyat görseli davranış sınavı\n')

// --- A) Açılışta liste isteniyor --------------------------------------------
console.log('A) Açılışta "fiyat listeniz var mı"')
const a = await tur(
  [{ rol: 'musteri', metin: 'Merhaba, fiyat listeniz var mı? Yollayabilir misiniz?' }],
  true,
)
console.log(`   bot: ${a.yanit.yapili.mesajlar.join(' / ').slice(0, 150)}`)
console.log(`   fiyat_gorseli: ${a.yanit.yapili.fiyat_gorseli ?? '-'}`)
kontrol(
  'ilk cevapta görsel göndermedi (fiyatla açma yasağı)',
  a.yanit.yapili.fiyat_gorseli === null,
  `gönderilen: ${a.yanit.yapili.fiyat_gorseli}`,
)
kontrol('kırmızı bayrak yok', a.bayraklar.length === 0, a.bayraklar.map((b) => b.tur).join(', '))

// --- B) Kapsam netleştikten sonra liste isteniyor ----------------------------
console.log('\nB) Araç + kapsam netleştikten sonra liste isteniyor')
const b = await tur(
  [
    { rol: 'musteri', metin: 'Merhaba ppf yaptırmak istiyorum' },
    { rol: 'bot', metin: 'Merhabalar, aracınızın marka model ve yılını öğrenebilir miyim?' },
    { rol: 'musteri', metin: 'Passat 2020' },
    { rol: 'bot', metin: 'Ön 3 parça mı yoksa komple mi düşünüyorsunuz?' },
    { rol: 'musteri', metin: 'Ön 3 parça. Bu arada fiyat listenizi de yollar mısınız?' },
  ],
  false,
)
console.log(`   bot: ${b.yanit.yapili.mesajlar.join(' / ').slice(0, 200)}`)
console.log(`   fiyat_verilebilir_mi: ${b.yanit.yapili.fiyat_verilebilir_mi}`)
console.log(`   fiyat_gorseli: ${b.yanit.yapili.fiyat_gorseli ?? '-'}`)
kontrol('kırmızı bayrak yok', b.bayraklar.length === 0, b.bayraklar.map((b2) => b2.tur).join(', '))
kontrol(
  'görsel gönderildiyse ppf listesi (yanlış liste değil)',
  b.yanit.yapili.fiyat_gorseli === null || b.yanit.yapili.fiyat_gorseli === 'ppf',
  `gönderilen: ${b.yanit.yapili.fiyat_gorseli}`,
)

// --- C) Şema kilidi: fiyat verilemezken görsel istense da temizlenir ---------
console.log('\nC) Şema kilidi (model kural dışına çıkarsa)')
const { ciktiyiCoz } = await import('../src/lib/motor/sema')
const zorlanmis = ciktiyiCoz({
  mesajlar: ['Fiyat listemizi yönlendiriyorum.'],
  niyet: 'fiyat-genel',
  arac: '',
  kapsam: '',
  fiyat_verilebilir_mi: false,
  devir_gerekli_mi: false,
  devir_sebebi: 'yok',
  randevu_talebi: '',
  gorsel_notu: '',
  fiyat_gorseli: 'ppf',
  guven: 0.9,
})
kontrol(
  'fiyat verilemezken görsel zorla silindi',
  zorlanmis.fiyat_gorseli === null,
  `kalan: ${zorlanmis.fiyat_gorseli}`,
)

console.log(`\n${'─'.repeat(50)}`)
console.log(`${gecti}/${gecti + kaldi} kontrol geçti`)
if (kaldi > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
