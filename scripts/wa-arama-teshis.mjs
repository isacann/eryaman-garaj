import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const require = createRequire('C:/Users/hp/Desktop/operiqoyeni - Kopya (2)/panel/package.json')
const { chromium } = require('playwright')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const bekle = (ms) => new Promise(r => setTimeout(r, ms))
const ctx = await chromium.launchPersistentContext(path.join(root, '.wa-profile'), { headless: false, viewport: null, args: ['--start-maximized'] })
const page = ctx.pages()[0] ?? (await ctx.newPage())
await page.goto('https://web.whatsapp.com/', { waitUntil: 'domcontentloaded' })
await page.waitForSelector('#pane-side', { timeout: 120000 })
await bekle(4000)

const ad = process.argv[2] || 'Arda BEY'
const kutu = page.locator('input[role="textbox"]').first()
await kutu.click(); await kutu.fill(''); await kutu.fill(ad)
await bekle(2500)

const sonuc = await page.evaluate(() => {
  const pane = document.querySelector('#pane-side')
  const satirlar = Array.from(pane.querySelectorAll('[role="row"]')).map(r => {
    const k = r.getBoundingClientRect()
    return { metin: (r.innerText||'').replace(/\n/g,' | ').slice(0,60), y: Math.round(k.y), h: Math.round(k.height) }
  })
  const basliklar = Array.from(pane.querySelectorAll('[role="heading"], h2, ._ak8j')).map(e => (e.innerText||'').trim()).filter(Boolean).slice(0,6)
  return { satirSayisi: satirlar.length, ilk5: satirlar.slice(0,5), basliklar }
})
console.log('ARAMA SONUCU: ' + JSON.stringify(sonuc, null, 1))

// ilk gercek satira tikla
const hedef = await page.evaluate(() => {
  const pane = document.querySelector('#pane-side')
  for (const r of pane.querySelectorAll('[role="row"]')) {
    const k = r.getBoundingClientRect()
    if (k.height >= 40) return { x: Math.round(k.x + k.width/2), y: Math.round(k.y + k.height/2), metin: (r.innerText||'').slice(0,40) }
  }
  return null
})
console.log('TIKLANAN: ' + JSON.stringify(hedef))
if (hedef) { await page.mouse.click(hedef.x, hedef.y); await bekle(3500) }

const sonra = await page.evaluate(() => ({
  mainVar: !!document.querySelector('#main'),
  baslik: document.querySelector('#main header')?.innerText?.split('\n')[0] ?? null,
  satir: document.querySelectorAll('#main [role="row"]').length,
  govde: (document.querySelector('#main')?.innerText || '').slice(0, 200).replace(/\n/g,' | '),
}))
console.log('TIKLAMA SONRASI: ' + JSON.stringify(sonra, null, 1))
await ctx.close()
