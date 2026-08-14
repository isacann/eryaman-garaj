// Instagram DM arsivini ceker. Ayni kalici profili kullanir, tekrar giris istemez.
// Sol liste sohbet acikken de duruyor; gelen kutusuna donmeden siradaki sohbete tiklanir.
// Kullanim: node scripts/ig-scrape.mjs [kac_sohbet]   (bos birakirsan hepsi)
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire('C:/Users/hp/Desktop/operiqoyeni - Kopya (2)/panel/package.json')
const { chromium } = require('playwright')

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'arsiv')
fs.mkdirSync(outDir, { recursive: true })

const LIMIT = Number(process.argv[2] || 0) || Infinity
const bekle = (ms) => new Promise((r) => setTimeout(r, ms))

function yazDiske(sohbetler) {
  fs.writeFileSync(path.join(outDir, 'instagram-dm.json'), JSON.stringify(sohbetler, null, 2), 'utf8')
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
        await b.first().click({ timeout: 3000 })
        await bekle(1000)
        return true
      }
    } catch {}
  }
  return false
}

// Sol listedeki gorunur sohbet satirlari (isim + tiklama koordinati)
async function gorunurSatirlar() {
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
      satirlar.push({ metin: s.textContent.trim(), x: Math.round(k.x + k.width / 2), y: Math.round(k.y + k.height / 2) })
    }
    // isim satirlarini ayikla: kisa metin + hemen altinda onizleme
    const isimler = []
    for (let i = 0; i < satirlar.length; i++) {
      const s = satirlar[i]
      const sonraki = satirlar[i + 1]
      const kisa = s.metin.length <= 40 && !s.metin.includes('\n')
      const cop = /^(Sen:|·|Unread|Okunmadı|\d+ new message|Yenilikler|Notun|Primary|General|Request)/i.test(s.metin)
      if (kisa && !cop && sonraki && sonraki.y - s.y < 40) {
        isimler.push(s)
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
      /^\d{1,2}:\d{2}$/, /^\d+ ?(d|h|w|g|s|hf) önce$/i, /^Active/i, /^Aktif/i,
      /^Yanıtla$/i, /^Reply$/i, /^Instagram$/i, /· Instagram$/, /^Enter$/i,
      /^Gönder$/i, /^Send$/i, /^Profili Görüntüle$/i, /^View profile$/i,
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

const sohbetler = []
const islenen = new Set()
const gorulenUrl = new Set()
let bosTur = 0

while (sohbetler.length < LIMIT && bosTur < 4) {
  const satirlar = await gorunurSatirlar()
  const bekleyen = satirlar.filter((s) => !islenen.has(s.metin))

  if (!bekleyen.length) {
    // gorunur satirlarin hepsi islendi, listeyi asagi kaydir
    await page.mouse.move(220, 500)
    await page.mouse.wheel(0, 500)
    await bekle(1800)
    bosTur++
    continue
  }
  bosTur = 0

  const hedef = bekleyen[0]
  islenen.add(hedef.metin)

  try {
    await page.mouse.click(hedef.x, hedef.y)
    await bekle(4000)
    const url = page.url()
    if (!url.includes('/direct/t/')) {
      console.log(`atlandi (acilmadi): ${hedef.metin}`)
      await kapatPencereler()
      continue
    }
    if (gorulenUrl.has(url)) {
      console.log(`atlandi (tekrar): ${hedef.metin}`)
      continue
    }
    gorulenUrl.add(url)

    // gecmisi yukle
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
      await bekle(900)
    }

    const mesajlar = await mesajlariCek()
    sohbetler.push({ ad: hedef.metin, url, mesajlar })
    yazDiske(sohbetler)
    console.log(`[${sohbetler.length}] ${hedef.metin} - ${mesajlar.length} satir`)
  } catch (e) {
    console.log(`HATA ${hedef.metin}: ${e.message.split('\n')[0]}`)
  }
  await bekle(800)
}

console.log(`BITTI. ${sohbetler.length} sohbet: arsiv/instagram-dm.json + .md`)
await ctx.close()
