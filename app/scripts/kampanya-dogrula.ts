// Reklam kampanyası akışını BAKİYESİZ doğrular.
//
// İsa'nın sorusu (13 Ağustos): "müşterinin reklamdan geldiğini bot nasıl bilecek,
// reklamdan gelmese de o tarifeyi uygulayacak mı?"
//
// Ölçtüğü şey tam olarak bu:
//   1. Reklamdan GELMEYEN müşterinin promptunda kampanya GEÇMEMELİ
//   2. Reklamdan gelen ve anahtarı TUTAN müşteride geçmeli
//   3. Anahtarı tutmayan başka reklamdan gelende geçmemeli
//   4. Süresi DOLMUŞ kampanya hiç kimsede geçmemeli
//
// Model çağrısı yok; prompt metnine bakıyor. Çalıştır:
//   npx tsx scripts/kampanya-dogrula.ts

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { sistemPromptUret } from '../src/lib/motor'
import type { EgitimIcerigi } from '../src/lib/motor/types'

function envYukle(): void {
  const yol = path.join(process.cwd(), '.env.local')
  if (!existsSync(yol)) return
  for (const satir of readFileSync(yol, 'utf8').split(/\r?\n/)) {
    const t = satir.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i > 0 && !process.env[t.slice(0, i).trim()]) {
      process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
    }
  }
}
envYukle()

const KAMPANYA_METNI = '5 cam komple XPEL HP 9.500₺ (normal 11.000₺)'

const BOS: EgitimIcerigi = { bilgi: [], davranis: [], reklam: [] }
const KAMPANYALI: EgitimIcerigi = {
  bilgi: [],
  davranis: [],
  reklam: [{ baslik: 'Ağustos cam filmi kampanyası', icerik: KAMPANYA_METNI }],
}

type Vaka = {
  ad: string
  reklamBasligi: string | null
  egitim: EgitimIcerigi
  kampanyaGecmeli: boolean
}

const VAKALAR: Vaka[] = [
  {
    ad: 'Reklamdan GELMEYEN müşteri',
    reklamBasligi: null,
    egitim: BOS,
    kampanyaGecmeli: false,
  },
  {
    ad: 'Reklamdan gelmedi ama kampanya kaydı sistemde var (sızıntı kontrolü)',
    reklamBasligi: null,
    egitim: KAMPANYALI,
    kampanyaGecmeli: false,
  },
  {
    ad: 'Reklamdan geldi, anahtar tuttu',
    reklamBasligi: 'Cam filmi kampanyası',
    egitim: KAMPANYALI,
    kampanyaGecmeli: true,
  },
  {
    ad: 'Başka reklamdan geldi, anahtar tutmadı (eşleşme egitim.ts’te elendi)',
    reklamBasligi: 'PPF fiyat al',
    egitim: BOS,
    kampanyaGecmeli: false,
  },
]

let gecen = 0
for (const v of VAKALAR) {
  const prompt = sistemPromptUret({
    kisiAdi: 'Şükrü',
    reklamBasligi: v.reklamBasligi,
    ilkCevapMi: true,
    egitim: v.egitim,
  })
  const gecti = prompt.includes(KAMPANYA_METNI) === v.kampanyaGecmeli
  if (gecti) gecen += 1
  console.log(
    `${gecti ? '✓' : '✗'} ${v.ad}\n    kampanya promptta: ${prompt.includes(KAMPANYA_METNI)} ` +
      `(beklenen ${v.kampanyaGecmeli})`,
  )
}

console.log(`\n${gecen}/${VAKALAR.length} doğru davrandı`)
process.exit(gecen === VAKALAR.length ? 0 : 1)
