// Mesaj yonu nasil anlasilir: data-id degerleri ve balon siniflari.
import { createRequire } from 'node:module'
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

// Karsilikli yazisma olan bir sohbet ac: listede "Arda BEY"
const hedef = await page.evaluate(() => {
  const pane = document.querySelector('#pane-side')
  for (const satir of pane.querySelectorAll('[role="row"]')) {
    const ad = satir.querySelector('span[title]')?.getAttribute('title') || ''
    if (ad.includes('Arda')) {
      const k = satir.getBoundingClientRect()
      return { ad, x: Math.round(k.x + k.width / 2), y: Math.round(k.y + k.height / 2) }
    }
  }
  return null
})
console.log('HEDEF: ' + JSON.stringify(hedef))
if (hedef) { await page.mouse.click(hedef.x, hedef.y); await bekle(3000) }

const veri = await page.evaluate(() => {
  const genislik = window.innerWidth
  const satirlar = Array.from(document.querySelectorAll('#main [role="row"]')).slice(0, 14)
  return satirlar.map((r) => {
    const idEl = r.querySelector('[data-id]') || r
    const id = idEl.getAttribute('data-id') || ''
    const k = r.getBoundingClientRect()
    const balon = r.querySelector('.copyable-text') || r.firstElementChild
    const bk = balon?.getBoundingClientRect()
    return {
      idOnEki: id.slice(0, 22),
      metin: (r.innerText || '').replace(/\n/g, ' ').trim().slice(0, 45),
      balonMerkezi: bk ? Math.round(bk.x + bk.width / 2) : null,
      ekranYarisi: Math.round(genislik / 2),
      siniflar: (balon?.className || '').toString().slice(0, 60),
    }
  })
})
console.log(JSON.stringify(veri, null, 1))
await ctx.close()
