// Tarama eksik mi: liste sonuna kadar indi mi, arsivlenmis sohbet var mi, filtre acik mi.
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const require = createRequire('C:/Users/hp/Desktop/operiqoyeni - Kopya (2)/panel/package.json')
const { chromium } = require('playwright')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const bekle = (ms) => new Promise((r) => setTimeout(r, ms))

const ctx = await chromium.launchPersistentContext(path.join(root, '.wa-profile'), {
  headless: false, viewport: null, args: ['--start-maximized'],
})
const page = ctx.pages()[0] ?? (await ctx.newPage())
await page.goto('https://web.whatsapp.com/', { waitUntil: 'domcontentloaded' })
await page.waitForSelector('#pane-side', { timeout: 120000 })
await bekle(3500)

// Listeyi sonuna kadar kaydir, tum isimleri topla
const isimler = new Set()
let bosTur = 0
for (let i = 0; i < 80 && bosTur < 5; i++) {
  const yeni = await page.evaluate(() => {
    const pane = document.querySelector('#pane-side')
    return Array.from(pane.querySelectorAll('[role="row"]'))
      .map((r) => r.querySelector('span[title]')?.getAttribute('title')?.trim())
      .filter(Boolean)
  })
  const onceki = isimler.size
  yeni.forEach((a) => isimler.add(a))
  if (isimler.size === onceki) bosTur++
  else bosTur = 0
  await page.mouse.move(200, 500)
  await page.mouse.wheel(0, 700)
  await bekle(900)
}

const durum = await page.evaluate(() => {
  const govde = document.body.innerText
  return {
    arsivVar: /Arşivlenmiş|Archived/i.test(govde),
    arsivSatiri: (govde.match(/Arşivlenmiş.*/i) || [])[0] || null,
    filtreler: Array.from(document.querySelectorAll('[role="tablist"] button, header button'))
      .map((b) => (b.innerText || b.getAttribute('aria-label') || '').trim())
      .filter((t) => t && t.length < 30).slice(0, 12),
    okunmamis: (govde.match(/Okunmamış|Unread/i) || [])[0] || null,
  }
})

const cekilen = JSON.parse(fs.readFileSync(path.join(root, 'arsiv/whatsapp.json'), 'utf8')).map((s) => s.ad)
const eksik = [...isimler].filter((a) => !cekilen.includes(a))

console.log('listede gorunen sohbet : ' + isimler.size)
console.log('cekilmis sohbet        : ' + cekilen.length)
console.log('EKSIK                  : ' + eksik.length)
if (eksik.length) console.log('  ' + eksik.slice(0, 20).join('\n  '))
console.log('durum: ' + JSON.stringify(durum, null, 1))

await ctx.close()
