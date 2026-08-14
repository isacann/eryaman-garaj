// WhatsApp arsivinden olculebilir bulgular: hacim, cevap suresi, cevapsiz kalma, fiyat davranisi.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const d = JSON.parse(fs.readFileSync(path.join(root, 'arsiv/whatsapp.json'), 'utf8'))

const zamanCoz = (z) => {
  const m = (z || '').match(/^(\d{1,2}):(\d{2}), (\d{2})\.(\d{2})\.(\d{4})$/)
  if (!m) return null
  return new Date(+m[5], +m[4] - 1, +m[3], +m[1], +m[2])
}

// --- Hacim ---
const aylik = new Map()
let zamanli = 0
for (const s of d) for (const m of s.mesajlar) {
  const t = zamanCoz(m.zaman)
  if (!t) continue
  zamanli++
  const k = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`
  aylik.set(k, (aylik.get(k) || 0) + 1)
}

// --- Cevap suresi: musteri mesajindan sonraki ilk isletme mesaji ---
const gecikmeler = []
const cevapsiz = []
for (const s of d) {
  const ms = s.mesajlar.map((m) => ({ ...m, t: zamanCoz(m.zaman) })).filter((m) => m.t)
  for (let i = 0; i < ms.length; i++) {
    if (ms[i].yon !== 'musteri') continue
    if (i > 0 && ms[i - 1].yon === 'musteri') continue // ardisik musteri mesajlarinda ilkini al
    const cevap = ms.slice(i + 1).find((m) => m.yon === 'isletme')
    if (!cevap) {
      if (i === ms.length - 1 || !ms.slice(i + 1).some((m) => m.yon === 'isletme')) {
        cevapsiz.push({ kisi: s.ad, metin: ms[i].metin.slice(0, 80), zaman: ms[i].zaman })
      }
      continue
    }
    const dk = (cevap.t - ms[i].t) / 60000
    if (dk >= 0 && dk < 60 * 24 * 7) gecikmeler.push(dk)
  }
}
gecikmeler.sort((a, b) => a - b)
const yuzdelik = (p) => (gecikmeler.length ? gecikmeler[Math.floor(gecikmeler.length * p)] : 0)
const bicim = (dk) => (dk < 60 ? `${Math.round(dk)} dk` : dk < 1440 ? `${(dk / 60).toFixed(1)} saat` : `${(dk / 1440).toFixed(1)} gün`)

console.log('=== HACIM ===')
for (const [k, v] of [...aylik].sort()) console.log(`  ${k}: ${v} mesaj`)
console.log(`  toplam zamanli mesaj: ${zamanli}`)

console.log('\n=== CEVAP SURESI (musteri sorusundan isletmenin ilk cevabina) ===')
console.log(`  olculen: ${gecikmeler.length} soru`)
console.log(`  ortanca      : ${bicim(yuzdelik(0.5))}`)
console.log(`  %25 hizli    : ${bicim(yuzdelik(0.25))}`)
console.log(`  %75 yavas    : ${bicim(yuzdelik(0.75))}`)
console.log(`  %90 yavas    : ${bicim(yuzdelik(0.9))}`)
console.log(`  1 saatten gec: ${gecikmeler.filter((x) => x > 60).length} (%${Math.round((gecikmeler.filter((x) => x > 60).length / gecikmeler.length) * 100)})`)
console.log(`  1 gunden gec : ${gecikmeler.filter((x) => x > 1440).length}`)

console.log(`\n=== HIC CEVAPLANMAMIS MUSTERI MESAJI: ${cevapsiz.length} ===`)
for (const c of cevapsiz.slice(0, 12)) console.log(`  [${c.zaman}] ${c.kisi}: ${c.metin}`)

// --- Isletme kaliplari ---
const eg = d.flatMap((s) => s.mesajlar.filter((m) => m.yon === 'isletme').map((m) => m.metin))
const ms = d.flatMap((s) => s.mesajlar.filter((m) => m.yon === 'musteri').map((m) => m.metin))
const say = (a, r) => a.filter((t) => r.test(t)).length
console.log('\n=== ISLETME KALIPLARI (WhatsApp) ===')
console.log(`  merhabalar        : ${say(eg, /merhabalar/i)}`)
console.log(`  yardimci ol       : ${say(eg, /yardımcı ol/i)}`)
console.log(`  net fiyat (₺)     : ${say(eg, /[0-9][0-9.]*\s*₺|[0-9][0-9.]* ?(tl|TL)/)}`)
console.log(`  randevu           : ${say(eg, /randevu/i)}`)
console.log(`  musait/gun ver    : ${say(eg, /müsait|hangi gün|ne zaman gel/i)}`)
console.log(`  rica ederiz       : ${say(eg, /rica eder/i)}`)
console.log('\n=== MUSTERI (WhatsApp) ===')
console.log(`  fiyat/ne kadar    : ${say(ms, /fiyat|ne kadar|ücret|kaç para/i)}`)
console.log(`  ppf               : ${say(ms, /ppf/i)}`)
console.log(`  cam filmi         : ${say(ms, /cam film/i)}`)
console.log(`  randevu/gelmek    : ${say(ms, /randevu|gelebilir|geleyim|müsait/i)}`)
console.log(`  adres/nerede      : ${say(ms, /nerede|adres|konum/i)}`)
