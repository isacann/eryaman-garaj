// Sohbet satirlarinin DOM yapisini cikarir: hangi element, hangi rol, tiklanabilir mi.
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire('C:/Users/hp/Desktop/operiqoyeni - Kopya (2)/panel/package.json')
const { chromium } = require('playwright')

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ctx = await chromium.launchPersistentContext(path.join(root, '.ig-profile'), {
  headless: false,
  viewport: null,
  args: ['--start-maximized'],
})
const page = ctx.pages()[0] ?? (await ctx.newPage())
await page.goto('https://www.instagram.com/direct/inbox/', { waitUntil: 'domcontentloaded' })
await new Promise((r) => setTimeout(r, 8000))

const rapor = await page.evaluate(() => {
  // Bilinen bir sohbet ismini iceren en kucuk elementi bul, yukari dogru satiri ara
  const hedefler = ['Oğuz Boran', 'Berkant Tunç', 'Muss']
  const cikti = []
  for (const ad of hedefler) {
    const hepsi = Array.from(document.querySelectorAll('span, div'))
      .filter((e) => e.childElementCount === 0 && e.textContent?.trim() === ad)
    const el = hepsi[0]
    if (!el) { cikti.push({ ad, bulundu: false }); continue }
    const zincir = []
    let p = el
    for (let i = 0; i < 8 && p; i++) {
      zincir.push({
        tag: p.tagName,
        role: p.getAttribute('role'),
        tabindex: p.getAttribute('tabIndex'),
        cls: (p.className || '').toString().slice(0, 60),
        cocuk: p.childElementCount,
        yukseklik: Math.round(p.getBoundingClientRect().height),
      })
      p = p.parentElement
    }
    cikti.push({ ad, bulundu: true, zincir })
  }
  // Kaydirilabilir kapsayicilari bul
  const kaydirilabilir = Array.from(document.querySelectorAll('div'))
    .filter((d) => d.scrollHeight > d.clientHeight + 50 && d.clientHeight > 200)
    .slice(0, 5)
    .map((d) => ({
      role: d.getAttribute('role'),
      cls: (d.className || '').toString().slice(0, 60),
      cocuk: d.childElementCount,
      scrollHeight: d.scrollHeight,
      clientHeight: d.clientHeight,
    }))
  return { cikti, kaydirilabilir }
})

console.log(JSON.stringify(rapor, null, 2))
await ctx.close()
