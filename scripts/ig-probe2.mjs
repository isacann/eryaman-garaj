// Bir sohbeti acar ve mesaj panelinin yapisini cikarir.
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire('C:/Users/hp/Desktop/operiqoyeni - Kopya (2)/panel/package.json')
const { chromium } = require('playwright')

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'arsiv')
fs.mkdirSync(outDir, { recursive: true })
const bekle = (ms) => new Promise((r) => setTimeout(r, ms))

const ctx = await chromium.launchPersistentContext(path.join(root, '.ig-profile'), {
  headless: false,
  viewport: null,
  args: ['--start-maximized'],
})
const page = ctx.pages()[0] ?? (await ctx.newPage())
await page.goto('https://www.instagram.com/direct/inbox/', { waitUntil: 'domcontentloaded' })
await bekle(8000)

// Sohbet satirlarinin konumlarini bul (isim span'lari)
const satirlar = await page.evaluate(() => {
  const kaydirilabilir = Array.from(document.querySelectorAll('div')).find(
    (d) => d.scrollHeight > d.clientHeight + 50 && d.clientHeight > 200,
  )
  if (!kaydirilabilir) return []
  const spanlar = Array.from(kaydirilabilir.querySelectorAll('span'))
    .filter((s) => s.childElementCount === 0 && (s.textContent || '').trim().length > 1)
  const gorulen = new Set()
  const cikti = []
  for (const s of spanlar) {
    const kutu = s.getBoundingClientRect()
    if (kutu.height < 10 || kutu.width < 10) continue
    const satirY = Math.round(kutu.top / 20) * 20
    if (gorulen.has(satirY)) continue
    gorulen.add(satirY)
    cikti.push({ metin: s.textContent.trim(), x: Math.round(kutu.x + kutu.width / 2), y: Math.round(kutu.y + kutu.height / 2) })
  }
  return cikti
})
console.log('SATIRLAR:')
console.log(JSON.stringify(satirlar.slice(0, 12), null, 1))

if (satirlar.length) {
  const ilk = satirlar[0]
  console.log(`\nTikliyorum: ${ilk.metin} (${ilk.x},${ilk.y})`)
  await page.mouse.click(ilk.x, ilk.y)
  await bekle(6000)
  console.log('URL: ' + page.url())

  const yapi = await page.evaluate(() => {
    const genislik = window.innerWidth
    const kaydirilabilirler = Array.from(document.querySelectorAll('div'))
      .filter((d) => d.scrollHeight > d.clientHeight + 50 && d.clientHeight > 200)
      .map((d) => ({ cocuk: d.childElementCount, sh: d.scrollHeight, ch: d.clientHeight }))
    const roller = {
      row: document.querySelectorAll('div[role="row"]').length,
      listitem: document.querySelectorAll('div[role="listitem"]').length,
      gridcell: document.querySelectorAll('div[role="gridcell"]').length,
      presentation: document.querySelectorAll('div[role="presentation"]').length,
    }
    // Mesaj balonlarini tahmin et: metni olan, genisligi sinirli, x konumu belli elementler
    const adaylar = Array.from(document.querySelectorAll('span, div'))
      .filter((e) => e.childElementCount === 0 && (e.textContent || '').trim().length > 2)
      .map((e) => {
        const k = e.getBoundingClientRect()
        return { metin: e.textContent.trim().slice(0, 80), x: Math.round(k.x), w: Math.round(k.width), sag: k.x + k.width / 2 > genislik * 0.55 }
      })
      .filter((a) => a.w > 20)
      .slice(-25)
    return { genislik, kaydirilabilirler, roller, adaylar }
  })
  console.log('\nYAPI:')
  console.log(JSON.stringify(yapi, null, 1))
  await page.screenshot({ path: path.join(outDir, 'ig-sohbet.png') })
  console.log('Ekran goruntusu: arsiv/ig-sohbet.png')
}

await ctx.close()
