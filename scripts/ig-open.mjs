// Instagram DM kutusunu kalici profille acar. Bir kez giris yapinca oturum profilde kalir.
// Kullanim: node scripts/ig-open.mjs
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire('C:/Users/hp/Desktop/operiqoyeni - Kopya (2)/panel/package.json')
const { chromium } = require('playwright')

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const profile = path.join(root, '.ig-profile')

const ctx = await chromium.launchPersistentContext(profile, {
  headless: false,
  viewport: null,
  args: ['--start-maximized'],
})

const page = ctx.pages()[0] ?? (await ctx.newPage())
await page.goto('https://www.instagram.com/direct/inbox/', { waitUntil: 'domcontentloaded' })

console.log('Instagram acildi. Eryaman Garaj hesabiyla giris yap.')
console.log('Profil: ' + profile)

// Sure siniri YOK. Giris yapilana kadar bekler, sonra acik kalir.
let bildirildi = false
setInterval(async () => {
  try {
    const url = page.url()
    const girdi = url.includes('/direct/')
      && (await page.locator('text=Mesajlar').count()) + (await page.locator('text=Messages').count()) > 0
    if (girdi && !bildirildi) {
      bildirildi = true
      console.log('GIRIS TAMAM. DM kutusu acik: ' + url)
    }
  } catch {
    // sayfa gecis halindeyse sessiz gec
  }
}, 5000)

ctx.on('close', () => {
  console.log('Tarayici kapatildi.')
  process.exit(0)
})
