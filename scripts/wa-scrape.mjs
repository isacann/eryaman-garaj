// WhatsApp Web arsivini ceker. Kalici profil, listeyi terk etmeden ilerler, her sohbette diske yazar.
// Yapi (2026-08 itibariyle dogrulandi):
//   satirlar : #pane-side [role="row"]   (isim = icindeki ilk span[title])
//   mesajlar : #main [data-id]           (yon = data-id "true_" ile basliyorsa giden)
//   zaman    : [data-pre-plain-text] = "[15:49, 07.08.2026] Ad: "
// Kullanim: node scripts/wa-scrape.mjs [kac_sohbet]
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire('C:/Users/hp/Desktop/operiqoyeni - Kopya (2)/panel/package.json')
const { chromium } = require('playwright')

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'arsiv')
fs.mkdirSync(outDir, { recursive: true })
const jsonYol = path.join(outDir, 'whatsapp.json')
const LIMIT = Number(process.argv[2] || 0) || Infinity
const bekle = (ms) => new Promise((r) => setTimeout(r, ms))

let sohbetler = []
try { sohbetler = JSON.parse(fs.readFileSync(jsonYol, 'utf8')) } catch {}
const islenen = new Set(sohbetler.map((s) => s.ad))
if (sohbetler.length) console.log(`onceki kosudan ${sohbetler.length} sohbet yuklendi`)

function yazDiske() {
  fs.writeFileSync(jsonYol, JSON.stringify(sohbetler, null, 2), 'utf8')
  const md = sohbetler.map((s) => {
    const govde = s.mesajlar
      .map((m) => `${m.yon === 'isletme' ? 'ERYAMAN GARAJ' : 'MUSTERI'}${m.zaman ? ' [' + m.zaman + ']' : ''}: ${m.metin.replace(/\n+/g, ' / ')}`)
      .join('\n')
    return `## ${s.ad}\n${govde || '(bos)'}\n`
  }).join('\n')
  fs.writeFileSync(path.join(outDir, 'whatsapp.md'), md, 'utf8')
}

const ctx = await chromium.launchPersistentContext(path.join(root, '.wa-profile'), {
  headless: false, viewport: null, args: ['--start-maximized'],
})
const page = ctx.pages()[0] ?? (await ctx.newPage())
await page.goto('https://web.whatsapp.com/', { waitUntil: 'domcontentloaded' })
await page.waitForSelector('#pane-side', { timeout: 120000 })
await bekle(3500)

async function gorunurSatirlar() {
  return page.evaluate(() => {
    const pane = document.querySelector('#pane-side')
    if (!pane) return []
    const kutu = pane.getBoundingClientRect()
    const cikti = []
    for (const satir of pane.querySelectorAll('[role="row"]')) {
      const k = satir.getBoundingClientRect()
      if (k.height < 40) continue
      if (k.y < kutu.y - 10 || k.y > kutu.y + kutu.height) continue
      const ad = satir.querySelector('span[title]')?.getAttribute('title')?.trim()
      if (!ad) continue
      cikti.push({ ad, x: Math.round(k.x + k.width / 2), y: Math.round(k.y + k.height / 2) })
    }
    return cikti
  })
}

async function mesajlariCek() {
  return page.evaluate(() => {
    const main = document.querySelector('#main')
    if (!main) return []
    const mk = main.getBoundingClientRect()
    const merkez = mk.x + mk.width / 2

    // Sohbet degil, sistem/bildirim metinleri
    const sistem = [
      /Meta'nın sunduğu güvenli bir hizmeti/i,
      /Bu mesaj yüklenemedi/i,
      /Bu mesaj silindi/i,
      /veri paylaşımı devre dışı/i,
      /uçtan uca şifreleme/i,
      /Bu sohbet .* reklamdan başlatıldı/i,
      /^\d+([.,]\d+)? ?(kB|MB)$/i,
      /^(PDF|JPG|PNG|MP4|DOC)\b.*(kB|MB)$/i,
      /Görüntülemek için mesajı telefonunuzda açın/i,
      /güvenlik kodu değişti/i,
    ]

    const cikti = []
    for (const satir of main.querySelectorAll('[role="row"]')) {
      const ham = (satir.innerText || '').trim()
      if (!ham) continue

      // Yon: once teslim isareti (sadece giden mesajlarda olur), sonra konum
      const teslimIsareti = /(^|\n)\s*(İletildi|Görüldü|Okundu|Gönderildi)\s*(\n|$)/i.test(ham)
      const balon = satir.querySelector('.copyable-text') || satir.firstElementChild
      const bk = balon?.getBoundingClientRect()
      const konumSag = bk ? bk.x + bk.width / 2 > merkez + 20 : false
      const giden = teslimIsareti || konumSag

      const on = satir.querySelector('[data-pre-plain-text]')?.getAttribute('data-pre-plain-text') || ''
      const zaman = (on.match(/\[([^\]]+)\]/) || [])[1] || ''

      let metin = (satir.querySelector('.selectable-text')?.innerText || '').trim()
      if (!metin) {
        metin = ham.split('\n')
          .map((s) => s.trim())
          .filter((s) => s && !/^\d{1,2}:\d{2}$/.test(s) && !/^(Görüldü|İletildi|Okundu|Gönderildi|Sen)$/i.test(s))
          .join(' ')
      }
      metin = metin.replace(/\s*(İletildi|Görüldü|Okundu)\s*$/i, '').trim()
      if (!metin || metin.length < 2) continue
      if (sistem.some((r) => r.test(metin))) continue

      cikti.push({ metin, zaman, yon: giden ? 'isletme' : 'musteri' })
    }
    return cikti
  })
}

let bosTur = 0
while (sohbetler.length < LIMIT && bosTur < 5) {
  const gorunur = await gorunurSatirlar()
  const bekleyen = gorunur.filter((s) => !islenen.has(s.ad))
  if (!bekleyen.length) {
    await page.mouse.move(200, 500)
    await page.mouse.wheel(0, 500)
    await bekle(1400)
    bosTur++
    continue
  }
  bosTur = 0
  const hedef = bekleyen[0]
  islenen.add(hedef.ad)
  try {
    await page.mouse.click(hedef.x, hedef.y)
    await bekle(2200)
    // gecmisi yukle: #main icindeki kaydirilabilir kapsayiciyi yukari cek
    for (let i = 0; i < 25; i++) {
      const devam = await page.evaluate(() => {
        const kap = Array.from(document.querySelectorAll('#main div'))
          .find((d) => d.scrollHeight > d.clientHeight + 60 && d.clientHeight > 200)
        if (!kap) return false
        const onceki = kap.scrollTop
        kap.scrollTop = 0
        return onceki > 30
      })
      if (!devam) break
      await bekle(850)
    }
    const mesajlar = await mesajlariCek()
    sohbetler.push({ ad: hedef.ad, mesajlar })
    yazDiske()
    console.log(`[${sohbetler.length}] ${hedef.ad} - ${mesajlar.length} mesaj`)
  } catch (e) {
    console.log(`HATA ${hedef.ad}: ${e.message.split('\n')[0]}`)
  }
  await bekle(600)
}

console.log(`BITTI. ${sohbetler.length} sohbet: arsiv/whatsapp.json + .md`)
await ctx.close()
