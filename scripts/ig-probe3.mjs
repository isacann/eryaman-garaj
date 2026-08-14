// Sohbet acma yontemini bulur: locator click vs ust kapsayiciya tiklama.
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

const dene = async (etiket, fn) => {
  console.log(`\n--- ${etiket} ---`)
  try {
    await fn()
    await bekle(5000)
    console.log('URL: ' + page.url())
    return page.url().includes('/direct/t/')
  } catch (e) {
    console.log('HATA: ' + e.message.split('\n')[0])
    return false
  }
}

let oldu = await dene('1) locator: isim metnine tikla', async () => {
  await page.getByText('Oğuz Boran', { exact: true }).first().click({ timeout: 8000 })
})

if (!oldu) {
  await page.goto('https://www.instagram.com/direct/inbox/', { waitUntil: 'domcontentloaded' })
  await bekle(6000)
  oldu = await dene('2) isim span\'inin 5. ust kapsayicisina tikla', async () => {
    const el = page.locator('span', { hasText: /^Oğuz Boran$/ }).first()
    const kutu = await el.boundingBox()
    if (!kutu) throw new Error('kutu yok')
    await page.mouse.move(kutu.x + 5, kutu.y + 5)
    await bekle(300)
    await page.mouse.down()
    await bekle(80)
    await page.mouse.up()
  })
}

if (oldu) {
  console.log('\nSOHBET ACILDI, mesaj yapisi:')
  const yapi = await page.evaluate(() => {
    const genislik = window.innerWidth
    const kutular = Array.from(document.querySelectorAll('div[role="row"], span, div'))
      .filter((e) => e.childElementCount === 0 && (e.textContent || '').trim().length > 2)
      .map((e) => {
        const k = e.getBoundingClientRect()
        return {
          metin: e.textContent.trim().slice(0, 90),
          x: Math.round(k.x),
          w: Math.round(k.width),
          y: Math.round(k.y),
          sag: k.x + k.width / 2 > genislik * 0.5,
        }
      })
      .filter((a) => a.w > 20 && a.y > 100)
    return { genislik, adet: kutular.length, ornek: kutular.slice(-20) }
  })
  console.log(JSON.stringify(yapi, null, 1))
  await page.screenshot({ path: path.join(outDir, 'ig-sohbet.png') })
}

await ctx.close()
