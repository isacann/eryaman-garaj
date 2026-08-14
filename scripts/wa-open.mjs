// WhatsApp Web'i kalici profille acar. Bir kez QR okutunca oturum profilde kalir.
// Kullanim: node scripts/wa-open.mjs
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire('C:/Users/hp/Desktop/operiqoyeni - Kopya (2)/panel/package.json')
const { chromium } = require('playwright')

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const profile = path.join(root, '.wa-profile')

const ctx = await chromium.launchPersistentContext(profile, {
  headless: false,
  viewport: null,
  args: ['--start-maximized'],
})

const page = ctx.pages()[0] ?? (await ctx.newPage())
await page.goto('https://web.whatsapp.com/', { waitUntil: 'domcontentloaded' })

console.log('WhatsApp Web acildi. Telefondan QR okut (0531 734 26 59).')
console.log('Profil: ' + profile)

// Sure siniri YOK. Giris yapilana kadar bekler, sonra acik kalir.
let bildirildi = false
setInterval(async () => {
  try {
    const girdi = await page.locator('#pane-side').count()
    if (girdi && !bildirildi) {
      bildirildi = true
      console.log('GIRIS TAMAM. Sohbet listesi yuklendi.')
    }
  } catch {
    // sayfa gecis halindeyse sessiz gec
  }
}, 5000)

ctx.on('close', () => {
  console.log('Tarayici kapatildi.')
  process.exit(0)
})
