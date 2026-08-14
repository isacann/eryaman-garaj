// Panelin ekran görüntülerini alır ve konsol hatası olup olmadığını raporlar.
// Sunucu ayakta olmalı (npm run dev). Playwright panel projesinden ödünç alınır.
// Çalıştır: node scripts/ekran.mjs
import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'

const PLAYWRIGHT_KOK = 'C:/Users/hp/Desktop/operiqoyeni - Kopya (2)/panel/'
const require = createRequire(`${PLAYWRIGHT_KOK}package.json`)
const { chromium } = require('playwright')

const ADRES = process.env.PANEL_ADRES ?? 'http://localhost:3000'
const EPOSTA = process.argv[2]
const SIFRE = process.argv[3]
if (!EPOSTA || !SIFRE) {
  console.error('Kullanım: node scripts/ekran.mjs <e-posta> <sifre>')
  process.exit(1)
}

const cikti = new URL('../_ekran/', import.meta.url)
mkdirSync(cikti, { recursive: true })

const tarayici = await chromium.launch()
const baglam = await tarayici.newContext({ viewport: { width: 1440, height: 900 } })
const sayfa = await baglam.newPage()

const hatalar = []
sayfa.on('console', (m) => {
  if (m.type() === 'error') hatalar.push(m.text())
})
sayfa.on('pageerror', (e) => hatalar.push(String(e)))

async function cek(ad) {
  await sayfa.waitForLoadState('networkidle')
  await sayfa.screenshot({ path: new URL(`${ad}.png`, cikti).pathname.slice(1) })
  console.log(`  ✓ ${ad}.png`)
}

await sayfa.goto(`${ADRES}/giris`)
await cek('01-giris')

await sayfa.fill('#eposta', EPOSTA)
await sayfa.fill('#sifre', SIFRE)
await sayfa.click('button[type=submit]')
await sayfa.waitForURL(`${ADRES}/`, { timeout: 20000 })
await cek('02-gelen-kutusu')

const ilkSohbet = sayfa.locator('a[href^="/sohbet/"]').first()
if (await ilkSohbet.count()) {
  await ilkSohbet.click()
  await sayfa.waitForURL(/\/sohbet\//, { timeout: 20000 })
  await cek('03-sohbet')
}

await sayfa.goto(`${ADRES}/randevular`)
await cek('04-randevular')

await sayfa.goto(`${ADRES}/ayarlar`)
await cek('05-ayarlar')

await tarayici.close()

if (hatalar.length) {
  console.error('\n⚠ konsol hataları:')
  for (const h of hatalar) console.error('  -', h)
  process.exit(1)
}
console.log('\n✓ konsol temiz')
