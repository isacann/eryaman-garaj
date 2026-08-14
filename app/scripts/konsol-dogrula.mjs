// Test konsolunun uçtan uca doğrulaması: giriş → mesaj → botun cevabı →
// panelde görünmesi → elle cevap (devir) → bota geri verme.
// Masaüstü ve mobil görünümde ayrı ayrı ekran görüntüsü alır.
//
// Sunucu ayakta olmalı. Playwright panel projesinden ödünç alınır.
// Çalıştır: node scripts/konsol-dogrula.mjs <e-posta> <sifre>

import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const PLAYWRIGHT_KOK = 'C:/Users/hp/Desktop/operiqoyeni - Kopya (2)/panel/'
const require = createRequire(`${PLAYWRIGHT_KOK}package.json`)
const { chromium, devices } = require('playwright')

const ADRES = process.env.PANEL_ADRES ?? 'http://localhost:3000'
const [EPOSTA, SIFRE] = process.argv.slice(2)
if (!EPOSTA || !SIFRE) {
  console.error('Kullanım: node scripts/konsol-dogrula.mjs <e-posta> <sifre>')
  process.exit(1)
}

const cikti = new URL('../_ekran/', import.meta.url)
mkdirSync(cikti, { recursive: true })
const yol = (ad) => new URL(`${ad}.png`, cikti).pathname.slice(1)

const hatalar = []
const sonuclar = []
function kontrol(ad, gecti, ek = '') {
  sonuclar.push({ ad, gecti, ek })
  console.log(`  ${gecti ? '✓' : '✗'} ${ad}${ek ? ` (${ek})` : ''}`)
}

const tarayici = await chromium.launch()

async function baglamKur(secenekler) {
  const baglam = await tarayici.newContext(secenekler)
  const sayfa = await baglam.newPage()
  sayfa.on('console', (m) => {
    if (m.type() === 'error') hatalar.push(`[${secenekler.etiket ?? 'masaüstü'}] ${m.text()}`)
  })
  sayfa.on('pageerror', (e) => hatalar.push(`[${secenekler.etiket ?? 'masaüstü'}] ${String(e)}`))
  return { baglam, sayfa }
}

async function girisYap(sayfa) {
  await sayfa.goto(`${ADRES}/giris`)
  await sayfa.fill('#eposta', EPOSTA)
  await sayfa.fill('#sifre', SIFRE)
  await sayfa.click('button[type=submit]')
  await sayfa.waitForURL(`${ADRES}/`, { timeout: 30000 })
}

/**
 * Konsola bir mesaj yazar ve botun cevabını bekler.
 * Sağlayıcının ücretsiz katmanı dakikada sınırlı istek veriyor; kotaya
 * takılırsak bekleyip tekrar deniyoruz, testi bu yüzden kaybetmeyelim.
 */
async function konsolaYaz(sayfa, metin, kalanDeneme = 3) {
  const oncekiAnaliz = await sayfa.getByText('Botun analizi', { exact: false }).count()

  await sayfa.fill('textarea[placeholder="Müşteri gibi yaz..."]', metin)
  await sayfa.getByRole('button', { name: 'Gönder' }).click()
  await sayfa.getByText('Bot yazıyor...').last().waitFor({ state: 'detached', timeout: 120000 })

  const yeniAnaliz = await sayfa.getByText('Botun analizi', { exact: false }).count()
  if (yeniAnaliz > oncekiAnaliz) return true

  const kota = await sayfa.getByText('kotası doldu', { exact: false }).count()
  if (kota > 0 && kalanDeneme > 1) {
    console.log('    (kota doldu, 65 sn bekleyip tekrar deniyorum)')
    await sayfa.waitForTimeout(65000)
    return konsolaYaz(sayfa, metin, kalanDeneme - 1)
  }
  return false
}

/**
 * Fotoğraf yolunu denemek için tarayıcıda basit bir araç çizimi üretir.
 * Gerçek araç fotoğrafı deposunda yok, uydurma dosya da koymuyoruz;
 * burada test edilen şey modelin araç tanıma başarısı değil, fotoğrafın
 * küçültülüp modele gitmesi ve gözlemin panele düşmesi.
 */
async function ornekFotograf(sayfa) {
  const veriUrl = await sayfa.evaluate(() => {
    const tuval = document.createElement('canvas')
    tuval.width = 900
    tuval.height = 600
    const b = tuval.getContext('2d')
    b.fillStyle = '#dfe3e8'
    b.fillRect(0, 0, 900, 600)
    b.fillStyle = '#1b3a6b'
    b.beginPath()
    b.moveTo(120, 420)
    b.lineTo(220, 300)
    b.lineTo(560, 290)
    b.lineTo(700, 380)
    b.lineTo(780, 420)
    b.lineTo(780, 470)
    b.lineTo(120, 470)
    b.closePath()
    b.fill()
    b.fillStyle = '#9ec5f0'
    b.fillRect(250, 315, 130, 70)
    b.fillRect(400, 315, 140, 70)
    b.fillStyle = '#111'
    b.beginPath()
    b.arc(250, 470, 55, 0, Math.PI * 2)
    b.arc(660, 470, 55, 0, Math.PI * 2)
    b.fill()
    return tuval.toDataURL('image/jpeg', 0.85)
  })
  const yolAdi = new URL('ornek-arac.jpg', cikti).pathname.slice(1)
  writeFileSync(yolAdi, Buffer.from(veriUrl.split(',')[1], 'base64'))
  return yolAdi
}

// ---------------------------------------------------------------- masaüstü
console.log('\nMasaüstü (1440x900)')
const { sayfa } = await baglamKur({ viewport: { width: 1440, height: 900 } })

await girisYap(sayfa)
kontrol('giriş yapıldı', true)

await sayfa.goto(`${ADRES}/test`)
await sayfa.waitForSelector('textarea[placeholder="Müşteri gibi yaz..."]')
await sayfa.screenshot({ path: yol('10-test-konsolu-bos') })

const cevapGeldi = await konsolaYaz(sayfa, 'merhaba ppf yaptırmak istiyorum fiyat ne kadar')
const botBalonlari = await sayfa.locator('.justify-start .rounded-tl-sm').count()
kontrol('bot cevap yazdı', cevapGeldi && botBalonlari > 0, `${botBalonlari} baloncuk`)

await sayfa.getByText('Botun analizi', { exact: false }).first().click()
await sayfa.waitForTimeout(300)
kontrol('yapılandırılmış çıktı görünüyor', await sayfa.getByText('Fiyat verilebilir mi').first().isVisible())
await sayfa.screenshot({ path: yol('11-test-konsolu-cevap'), fullPage: true })

// Fotoğraf yolu
const fotografYolu = await ornekFotograf(sayfa)
await sayfa.setInputFiles('input[type=file]', fotografYolu)
await sayfa.getByText('Fotoğrafı kaldır').waitFor({ timeout: 10000 })
kontrol('fotoğraf seçilince önizleme çıkıyor', true)

const fotoCevap = await konsolaYaz(sayfa, 'aracım bu, ne önerirsiniz')
kontrol('fotoğraflı mesaja cevap geldi', fotoCevap)

const sonAnaliz = sayfa.locator('details').last()
await sonAnaliz.click()
// Alanı sırayla değil ETİKETLE seç: analiz kartına satır eklendiğinde (fiyat
// görseli 8 Ağustos'ta eklendi) indeks kayıyor ve test sessizce yanlış alanı
// okuyup "boş" sanıyordu.
const fotoNotu = (
  await sonAnaliz
    .locator('div', { has: sayfa.locator('dt', { hasText: 'Fotoğraf notu' }) })
    .last()
    .locator('dd')
    .innerText()
).trim()
kontrol('fotoğraf notu dolduruldu', fotoNotu !== '—' && fotoNotu.length > 3, fotoNotu.slice(0, 60))
await sayfa.screenshot({ path: yol('14-test-konsolu-fotograf'), fullPage: true })

// Konuşma panelde görünüyor mu
await sayfa.goto(`${ADRES}/`)
await sayfa.waitForSelector('a[href^="/sohbet/"]')
const testRozeti = await sayfa.getByText('Test konsolu', { exact: true }).count()
kontrol('gelen kutusunda Test konsolu rozeti var', testRozeti > 0)
await sayfa.screenshot({ path: yol('12-gelen-kutusu') })

await sayfa.locator('a[href^="/sohbet/"]').first().click()
await sayfa.waitForURL(/\/sohbet\//, { timeout: 20000 })
await sayfa.waitForSelector('textarea[aria-label="Ekip cevabı"]')

// Elle cevap → devir
await sayfa.fill('textarea[aria-label="Ekip cevabı"]', 'Merhabalar, ben ekipten yazıyorum.')
await sayfa.getByRole('button', { name: 'Gönder' }).click()
await sayfa.getByText('Bu yazışmada bot susuyor', { exact: false }).waitFor({ timeout: 20000 })
kontrol('elle cevap yazıldı, yazışma devre geçti', true)
await sayfa.screenshot({ path: yol('13-sohbet-devir'), fullPage: true })

const devirRozeti = await sayfa.locator('header').getByText('Devir', { exact: true }).count()
kontrol('devir rozeti göründü', devirRozeti > 0)

// Devirdeyken bot susuyor mu
const sohbetAdresi = sayfa.url()
await sayfa.goto(`${ADRES}/test`)
await sayfa.fill('textarea[placeholder="Müşteri gibi yaz..."]', 'peki randevu alabilir miyim')
await sayfa.getByRole('button', { name: 'Gönder' }).click()
await sayfa.getByText('ekip devraldı', { exact: false }).waitFor({ timeout: 30000 })
kontrol('devirdeyken bot susuyor', true)

// Bota geri ver
await sayfa.goto(sohbetAdresi)
await sayfa.getByRole('button', { name: "Bot'a geri ver" }).click()
await sayfa.getByText('Buraya yazarsan', { exact: false }).waitFor({ timeout: 20000 })
kontrol("bot'a geri verildi", true)

// ------------------------------------------------------------------ mobil
console.log('\nMobil (iPhone 13)')
const { sayfa: mobil } = await baglamKur({ ...devices['iPhone 13'], etiket: 'mobil' })
await girisYap(mobil)
await mobil.goto(`${ADRES}/test`)
await mobil.waitForSelector('textarea[placeholder="Müşteri gibi yaz..."]')

const mobilCevap = await konsolaYaz(mobil, 'aracım 2021 golf, ön 3 parça ppf ne kadar')
const mobilBalon = await mobil.locator('.justify-start .rounded-tl-sm').count()
kontrol('mobilde bot cevap yazdı', mobilCevap && mobilBalon > 0, `${mobilBalon} baloncuk`)
await mobil.screenshot({ path: yol('20-mobil-test-konsolu'), fullPage: true })

// Gönder düğmesi ekranda mı (yapışkan alt çubuk)
const gonderKutusu = await mobil.getByRole('button', { name: 'Gönder' }).boundingBox()
const ekranYuksekligi = mobil.viewportSize().height
kontrol(
  'mobilde gönder düğmesi ekran içinde',
  gonderKutusu !== null && gonderKutusu.y + gonderKutusu.height <= ekranYuksekligi + 1,
  gonderKutusu ? `alt kenar ${Math.round(gonderKutusu.y + gonderKutusu.height)} / ${ekranYuksekligi}` : 'bulunamadı',
)

// Mobilde liste → sohbet geçişi
await mobil.goto(`${ADRES}/`)
await mobil.waitForSelector('a[href^="/sohbet/"]')
await mobil.screenshot({ path: yol('21-mobil-gelen-kutusu') })
await mobil.locator('a[href^="/sohbet/"]').first().click()
await mobil.waitForURL(/\/sohbet\//, { timeout: 20000 })
const listeGizliMi = await mobil.locator('a[href^="/sohbet/"]').first().isHidden()
kontrol('mobilde sohbet açılınca liste gizleniyor', listeGizliMi)
await mobil.screenshot({ path: yol('22-mobil-sohbet'), fullPage: true })
const geriBaglantisi = await mobil.getByText('← Gelen kutusu').isVisible()
kontrol('mobilde listeye dönüş bağlantısı var', geriBaglantisi)

await tarayici.close()

console.log('')
if (hatalar.length) {
  console.error('⚠ konsol hataları:')
  for (const h of hatalar) console.error('  -', h)
} else {
  console.log('✓ konsol temiz')
}

const kalan = sonuclar.filter((s) => !s.gecti)
console.log(`\n${sonuclar.length - kalan.length}/${sonuclar.length} kontrol geçti`)
if (kalan.length || hatalar.length) process.exit(1)
