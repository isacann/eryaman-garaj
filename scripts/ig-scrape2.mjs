// IKINCI TUR: tum sohbetleri tarar.
// 1) Once butun isimleri kaydirarak toplar (tiklamadan).
// 2) Sonra her ismi ARAMA KUTUSUNA yazip acar. Boylece liste kaydirma sorunu bitiyor.
// Onceki turda cekilenler korunur, ustune eklenir (devam edebilir).
// Kullanim: node scripts/ig-scrape2.mjs
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire('C:/Users/hp/Desktop/operiqoyeni - Kopya (2)/panel/package.json')
const { chromium } = require('playwright')

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'arsiv')
fs.mkdirSync(outDir, { recursive: true })
const jsonYol = path.join(outDir, 'instagram-dm.json')
const isimYol = path.join(outDir, 'ig-isimler.json')
const bekle = (ms) => new Promise((r) => setTimeout(r, ms))

// Onceki turun sonucunu yukle (devam etmek icin)
let sohbetler = []
try {
  sohbetler = JSON.parse(fs.readFileSync(jsonYol, 'utf8'))
  console.log(`onceki turdan ${sohbetler.length} sohbet yuklendi`)
} catch {}
const islenen = new Set(sohbetler.map((s) => s.ad))

function yazDiske() {
  fs.writeFileSync(jsonYol, JSON.stringify(sohbetler, null, 2), 'utf8')
  const md = sohbetler
    .map((s) => {
      const govde = s.mesajlar
        .map((m) => `${m.yon === 'isletme' ? 'ERYAMAN GARAJ' : 'MUSTERI'}: ${m.metin.replace(/\n+/g, ' / ')}`)
        .join('\n')
      return `## ${s.ad}\n${govde || '(bos)'}\n`
    })
    .join('\n')
  fs.writeFileSync(path.join(outDir, 'instagram-dm.md'), md, 'utf8')
}

const ctx = await chromium.launchPersistentContext(path.join(root, '.ig-profile'), {
  headless: false,
  viewport: null,
  args: ['--start-maximized'],
})
const page = ctx.pages()[0] ?? (await ctx.newPage())

async function kapatPencereler() {
  for (const m of ['Şimdi Değil', 'Not Now', 'Daha Sonra']) {
    try {
      const b = page.getByRole('button', { name: m })
      if (await b.count()) {
        await b.first().click({ timeout: 2500 })
        await bekle(900)
        return true
      }
    } catch {}
  }
  return false
}

async function gorunurIsimler() {
  return page.evaluate(() => {
    const liste = Array.from(document.querySelectorAll('div')).find(
      (d) => d.scrollHeight > d.clientHeight + 50 && d.clientHeight > 200 && d.getBoundingClientRect().x < 400,
    )
    if (!liste) return []
    const kutu = liste.getBoundingClientRect()
    const spanlar = Array.from(liste.querySelectorAll('span')).filter(
      (s) => s.childElementCount === 0 && (s.textContent || '').trim().length > 1,
    )
    const satirlar = []
    const gorulenY = new Set()
    for (const s of spanlar) {
      const k = s.getBoundingClientRect()
      if (k.height < 10 || k.width < 10) continue
      if (k.y < kutu.y + 5 || k.y > kutu.y + kutu.height - 5) continue
      const satirY = Math.round(k.y / 24)
      if (gorulenY.has(satirY)) continue
      gorulenY.add(satirY)
      satirlar.push({ metin: s.textContent.trim(), y: k.y })
    }
    const isimler = []
    for (let i = 0; i < satirlar.length; i++) {
      const s = satirlar[i]
      const sonraki = satirlar[i + 1]
      const kisa = s.metin.length <= 40 && !s.metin.includes('\n')
      const cop = /^(Sen:|·|Unread|Okunmadı|\d+ new message|Yenilikler|Notun|Primary|General|Request|Birincil|Genel|İstek)/i.test(s.metin)
      if (kisa && !cop && sonraki && sonraki.y - s.y < 40) {
        isimler.push(s.metin)
        i++
      }
    }
    return isimler
  })
}

async function mesajlariCek() {
  return page.evaluate(() => {
    const genislik = window.innerWidth
    const solSinir = genislik * 0.28
    const cop = [
      /^View ad$/i, /^Reklamı gör$/i, /^Mesaj\.\.\.$/, /^Message\.\.\.$/,
      /^Görüldü/, /^Seen/, /^New messages$/i, /^Yeni mesaj/i,
      /^\d{1,2}:\d{2}$/, /^(Pzt|Sal|Çrş|Prş|Cum|Cts|Paz)\s/i, /^\d+ ?(d|h|w|g|s|hf) önce$/i,
      /^Active/i, /^Aktif/i, /^Yanıtla$/i, /^Reply$/i, /^Instagram$/i, /· Instagram$/,
      /^Enter$/i, /^Gönder$/i, /^Send$/i, /^Profili Görüntüle$/i, /^View profile$/i,
      /sana yanıt verdi$/i, /gördü$/i, /^Ara$/i, /^Search$/i,
    ]
    const elemanlar = Array.from(document.querySelectorAll('span, div'))
      .filter((e) => e.childElementCount === 0 && (e.textContent || '').trim().length > 0)
      .map((e) => {
        const k = e.getBoundingClientRect()
        return { metin: e.textContent.trim(), x: k.x, w: k.width, y: k.y, merkez: k.x + k.width / 2 }
      })
      .filter((a) => a.x > solSinir && a.w > 15 && a.y > 80)
      .sort((a, b) => a.y - b.y)
    const mesajlar = []
    const gorulen = new Set()
    for (const e of elemanlar) {
      if (cop.some((r) => r.test(e.metin)) || e.metin.length < 2) continue
      const anahtar = e.metin + '|' + Math.round(e.y)
      if (gorulen.has(anahtar)) continue
      gorulen.add(anahtar)
      mesajlar.push({ metin: e.metin, yon: e.merkez > genislik * 0.62 ? 'isletme' : 'musteri' })
    }
    return mesajlar
  })
}

await page.goto('https://www.instagram.com/direct/inbox/', { waitUntil: 'domcontentloaded' })
await bekle(7000)
await kapatPencereler()

// --- 1. TUM ISIMLERI TOPLA ---
let isimler = []
try {
  isimler = JSON.parse(fs.readFileSync(isimYol, 'utf8'))
  console.log(`kayitli isim listesi kullaniliyor: ${isimler.length}`)
} catch {
  const kume = new Set(await gorunurIsimler())
  let bosTur = 0
  let tur = 0
  while (tur < 60 && bosTur < 4) {
    const onceki = kume.size
    await page.mouse.move(220, 500)
    await page.mouse.wheel(0, 600)
    await bekle(1400)
    for (const a of await gorunurIsimler()) kume.add(a)
    bosTur = kume.size === onceki ? bosTur + 1 : 0
    tur++
    if (tur % 5 === 0) console.log(`isim toplaniyor... ${kume.size}`)
  }
  isimler = Array.from(kume)
  fs.writeFileSync(isimYol, JSON.stringify(isimler, null, 2), 'utf8')
  console.log(`TOPLAM ${isimler.length} isim bulundu, kaydedildi.`)
}

const kalan = isimler.filter((a) => !islenen.has(a))
console.log(`${kalan.length} sohbet cekilecek (${islenen.size} zaten var).`)

// --- 2. HER ISMI ARAMA KUTUSUNDAN AC ---
async function aramaKutusu() {
  const adaylar = [
    'input[placeholder="Ara"]',
    'input[placeholder="Search"]',
    'input[aria-label="Ara"]',
    'input[aria-label="Search input"]',
    'input[type="text"]',
  ]
  for (const s of adaylar) {
    const el = page.locator(s).first()
    if (await el.count()) return el
  }
  return null
}

let basari = 0
let hata = 0
for (const [i, ad] of kalan.entries()) {
  try {
    await page.goto('https://www.instagram.com/direct/inbox/', { waitUntil: 'domcontentloaded' })
    await bekle(3500)
    await kapatPencereler()

    const kutu = await aramaKutusu()
    if (!kutu) {
      console.log('arama kutusu bulunamadi, duruyorum')
      break
    }
    await kutu.click({ timeout: 5000 })
    await kutu.fill('')
    await kutu.type(ad.slice(0, 20), { delay: 40 })
    await bekle(2800)

    // ilk sonuca tikla
    const sonuc = await page.evaluate(() => {
      const liste = Array.from(document.querySelectorAll('div')).find(
        (d) => d.getBoundingClientRect().x < 400 && d.clientHeight > 200,
      )
      if (!liste) return null
      const spanlar = Array.from(liste.querySelectorAll('span')).filter(
        (s) => s.childElementCount === 0 && (s.textContent || '').trim().length > 1,
      )
      for (const s of spanlar) {
        const k = s.getBoundingClientRect()
        if (k.y > 150 && k.height > 10 && k.width > 10) {
          return { x: Math.round(k.x + k.width / 2), y: Math.round(k.y + k.height / 2), metin: s.textContent.trim() }
        }
      }
      return null
    })
    if (!sonuc) {
      console.log(`[${i + 1}/${kalan.length}] sonuc yok: ${ad}`)
      hata++
      continue
    }

    await page.mouse.click(sonuc.x, sonuc.y)
    await bekle(4000)
    if (!page.url().includes('/direct/t/')) {
      console.log(`[${i + 1}/${kalan.length}] acilmadi: ${ad}`)
      hata++
      continue
    }

    for (let k = 0; k < 20; k++) {
      const devam = await page.evaluate(() => {
        const adaylar = Array.from(document.querySelectorAll('div')).filter(
          (d) => d.scrollHeight > d.clientHeight + 50 && d.clientHeight > 200 && d.getBoundingClientRect().x > 400,
        )
        const d = adaylar[adaylar.length - 1]
        if (!d) return false
        const onceki = d.scrollTop
        d.scrollTop = 0
        return onceki > 30
      })
      if (!devam) break
      await bekle(850)
    }

    const mesajlar = await mesajlariCek()
    sohbetler.push({ ad, url: page.url(), mesajlar })
    islenen.add(ad)
    yazDiske()
    basari++
    console.log(`[${i + 1}/${kalan.length}] ${ad} - ${mesajlar.length} satir (toplam ${sohbetler.length})`)
  } catch (e) {
    hata++
    console.log(`[${i + 1}/${kalan.length}] HATA ${ad}: ${e.message.split('\n')[0]}`)
  }
}

console.log(`BITTI. ${basari} yeni, ${hata} basarisiz, toplam ${sohbetler.length} sohbet.`)
await ctx.close()
