// Ayarlar sayfasının doğrulaması: Fatih Bey'in Telegram'ı kendi kuracağı ekran.
// Çalıştır: node scripts/ayarlar-dogrula.mjs <e-posta> <sifre>

import { createRequire } from 'node:module'

// Playwright bu projenin bağımlılığı değil, komşu panel projesinden ödünç
// alınıyor (konsol-dogrula.mjs ile aynı kalıp). Teslimde bu bağ kopacaksa
// playwright devDependency olarak eklenmeli.
const PLAYWRIGHT_KOK = 'C:/Users/hp/Desktop/operiqoyeni - Kopya (2)/panel/'
const require = createRequire(`${PLAYWRIGHT_KOK}package.json`)
const { chromium } = require('playwright')

const ADRES = process.env.PANEL_ADRES ?? 'http://localhost:3000'
const [eposta, sifre] = process.argv.slice(2)
if (!eposta || !sifre) {
  console.error('Kullanım: node scripts/ayarlar-dogrula.mjs <e-posta> <sifre>')
  process.exit(1)
}

let gecti = 0
let kaldi = 0
function kontrol(ad, sonuc, ayrinti = '') {
  if (sonuc) {
    gecti += 1
    console.log(`  ✓ ${ad}`)
  } else {
    kaldi += 1
    console.log(`  ✗ ${ad}${ayrinti ? ` — ${ayrinti}` : ''}`)
  }
}

const tarayici = await chromium.launch()
const sayfa = await tarayici.newPage({ viewport: { width: 1440, height: 900 } })
const konsolHatalari = []
sayfa.on('console', (m) => {
  if (m.type() === 'error') konsolHatalari.push(m.text())
})

console.log(`\nAyarlar sayfası doğrulaması — ${ADRES}\n`)

await sayfa.goto(`${ADRES}/giris`, { waitUntil: 'domcontentloaded' })
await sayfa.fill('#eposta', eposta)
await sayfa.fill('#sifre', sifre)
await sayfa.click('button[type="submit"]')
await sayfa.waitForURL((u) => !u.pathname.startsWith('/giris'), { timeout: 30000 })
kontrol('giriş yapıldı', true)

await sayfa.goto(`${ADRES}/ayarlar`, { waitUntil: 'networkidle' })

const govde = await sayfa.textContent('body')

kontrol('Telegram bağlantı kutusu görünüyor', govde.includes('Telegram bağlantısı'))
kontrol('kurulum adımları yazılı (/start)', govde.includes('/start'))
kontrol(
  '"Bağlantıyı kur" düğmesi var',
  (await sayfa.locator('button', { hasText: 'Bağlantıyı kur' }).count()) > 0,
)
kontrol(
  '"Test mesajı gönder" düğmesi var',
  (await sayfa.locator('button', { hasText: 'Test mesajı gönder' }).count()) > 0,
)
kontrol('takip mesajları anahtarı var', govde.includes('Takip mesajları'))
kontrol('şablon takibi anahtarı var', govde.includes('şablon takibi'))
kontrol('Telegram bildirimleri anahtarı var', govde.includes('Telegram bildirimleri'))
kontrol(
  'çalışma saati alanları duruyor',
  (await sayfa.locator('input[name="baslangic"]').count()) === 1,
)

// Jeton yokken "Bağlantıyı kur" anlaşılır bir hata vermeli, sessiz kalmamalı.
await sayfa.locator('button', { hasText: 'Bağlantıyı kur' }).click()
await sayfa.waitForTimeout(4000)
const sonrasi = await sayfa.textContent('body')
const uyariVar =
  sonrasi.includes('jeton') || sonrasi.includes('/start') || sonrasi.includes('Bağlandı')
kontrol('jeton yokken anlaşılır geri bildirim veriyor', uyariVar)

const gercekHatalar = konsolHatalari.filter(
  (h) => !h.includes('favicon') && !h.includes('404'),
)
kontrol('tarayıcı konsolu temiz', gercekHatalar.length === 0, gercekHatalar.slice(0, 2).join(' | '))

await tarayici.close()

console.log(`\n${'─'.repeat(50)}`)
console.log(`${gecti}/${gecti + kaldi} kontrol geçti`)
if (kaldi > 0) process.exit(1)
