// TAM TARAMA (iki fazli):
//  1) Tiklamadan kaydirarak TUM sohbet isimlerini topla, diske yaz.
//  2) Her ismi ARAMA KUTUSUNDAN ac, mesajlari cek. Boylece liste kaydirma sorunu bitiyor.
// Onceki kosulardan cekilenler korunur, ustune eklenir.
// Kullanim: node scripts/wa-scrape2.mjs
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire('C:/Users/hp/Desktop/operiqoyeni - Kopya (2)/panel/package.json')
const { chromium } = require('playwright')

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'arsiv')
const jsonYol = path.join(outDir, 'whatsapp.json')
const isimYol = path.join(outDir, 'wa-isimler.json')
const bekle = (ms) => new Promise((r) => setTimeout(r, ms))

let sohbetler = []
try { sohbetler = JSON.parse(fs.readFileSync(jsonYol, 'utf8')) } catch {}
const islenen = new Set(sohbetler.map((s) => s.ad))
console.log(`onceki kosulardan ${sohbetler.length} sohbet var`)

function yazDiske() {
  fs.writeFileSync(jsonYol, JSON.stringify(sohbetler, null, 2), 'utf8')
  const md = sohbetler.map((s) => {
    const govde = s.mesajlar
      .map((m) => `${m.yon === 'isletme' ? 'ERYAMAN GARAJ' : 'MUSTERI'}${m.zaman ? ' [' + m.zaman + ']' : ''}: ${m.metin.replace(/\n+/g, ' / ')}`)
      .join('\n')
    return `## ${s.ad}\n${govde || '(bos)'}\n`
  }).join('\n')
  fs.writeFileSync(path.join(outDir, 'whatsapp.md'), md, 'utf8')
}

const ctx = await chromium.launchPersistentContext(path.join(root, '.wa-profile'), {
  headless: false, viewport: null, args: ['--start-maximized'],
})
const page = ctx.pages()[0] ?? (await ctx.newPage())
await page.goto('https://web.whatsapp.com/', { waitUntil: 'domcontentloaded' })
await page.waitForSelector('#pane-side', { timeout: 120000 })
await bekle(3500)

// ---------- FAZ 1: isimler ----------
let isimler = []
try {
  isimler = JSON.parse(fs.readFileSync(isimYol, 'utf8'))
  console.log(`kayitli isim listesi: ${isimler.length}`)
} catch {
  const kume = new Set()
  let bosTur = 0
  for (let i = 0; i < 120 && bosTur < 6; i++) {
    const yeni = await page.evaluate(() => {
      const pane = document.querySelector('#pane-side')
      return Array.from(pane.querySelectorAll('[role="row"]'))
        .map((r) => r.querySelector('span[title]')?.getAttribute('title')?.trim())
        .filter(Boolean)
    })
    const onceki = kume.size
    yeni.forEach((a) => kume.add(a))
    bosTur = kume.size === onceki ? bosTur + 1 : 0
    await page.mouse.move(200, 500)
    await page.mouse.wheel(0, 700)
    await bekle(850)
    if (i % 10 === 0) console.log(`isim toplaniyor... ${kume.size}`)
  }
  isimler = [...kume]
  fs.writeFileSync(isimYol, JSON.stringify(isimler, null, 2), 'utf8')
  console.log(`TOPLAM ${isimler.length} isim`)
}

const kalan = isimler.filter((a) => !islenen.has(a))
console.log(`${kalan.length} sohbet cekilecek`)

// ---------- FAZ 2: arama kutusundan ac ----------
// WhatsApp Web arama kutusu: <input role="textbox" data-tab="3"> (2026-08 dogrulandi)
async function aramaKutusu() {
  for (const s of ['input[role="textbox"]', 'input[placeholder*="Arat"]', 'input[aria-label*="Arat"]']) {
    const el = page.locator(s).first()
    if (await el.count()) return el
  }
  return null
}

async function mesajlariCek() {
  return page.evaluate(() => {
    const main = document.querySelector('#main')
    if (!main) return []
    const mk = main.getBoundingClientRect()
    const merkez = mk.x + mk.width / 2
    const sistem = [
      /Meta'nın sunduğu güvenli bir hizmeti/i, /Bu mesaj yüklenemedi/i, /Bu mesaj silindi/i,
      /veri paylaşımı devre dışı/i, /uçtan uca şifreleme/i, /Bu sohbet .* reklamdan başlatıldı/i,
      /^\d+([.,]\d+)? ?(kB|MB)$/i, /^(PDF|JPG|PNG|MP4|DOC)\b.*(kB|MB)$/i,
      /Görüntülemek için mesajı telefonunuzda açın/i, /güvenlik kodu değişti/i,
    ]
    const cikti = []
    for (const satir of main.querySelectorAll('[role="row"]')) {
      const ham = (satir.innerText || '').trim()
      if (!ham) continue
      const teslim = /(^|\n)\s*(İletildi|Görüldü|Okundu|Gönderildi)\s*(\n|$)/i.test(ham)
      const balon = satir.querySelector('.copyable-text') || satir.firstElementChild
      const bk = balon?.getBoundingClientRect()
      const sag = bk ? bk.x + bk.width / 2 > merkez + 20 : false
      const on = satir.querySelector('[data-pre-plain-text]')?.getAttribute('data-pre-plain-text') || ''
      const zaman = (on.match(/\[([^\]]+)\]/) || [])[1] || ''
      let metin = (satir.querySelector('.selectable-text')?.innerText || '').trim()
      if (!metin) {
        metin = ham.split('\n').map((s) => s.trim())
          .filter((s) => s && !/^\d{1,2}:\d{2}$/.test(s) && !/^(Görüldü|İletildi|Okundu|Gönderildi|Sen)$/i.test(s))
          .join(' ')
      }
      metin = metin.replace(/\s*(İletildi|Görüldü|Okundu)\s*$/i, '').trim()
      if (!metin || metin.length < 2) continue
      if (sistem.some((r) => r.test(metin))) continue
      cikti.push({ metin, zaman, yon: teslim || sag ? 'isletme' : 'musteri' })
    }
    return cikti
  })
}

let basari = 0, hata = 0
for (const [i, ad] of kalan.entries()) {
  try {
    const kutu = await aramaKutusu()
    if (!kutu) { console.log('arama kutusu yok, duruyorum'); break }
    await kutu.click({ timeout: 5000 })
    await kutu.fill('')
    await kutu.fill(ad.slice(0, 25))
    await bekle(1800)

    // DIKKAT: arama sonucunda "Sohbetler", "Ortak Gruplar", "Yildizli mesajlar" gibi
    // BOLUM BASLIKLARI da [role="row"] olarak gelir ve tiklanınca hicbir sey acilmaz.
    // Gercek sohbet satirinin isareti: icinde span[title] olmasi.
    const hedef = await page.evaluate((aranan) => {
      const pane = document.querySelector('#pane-side')
      const adaylar = []
      for (const satir of pane.querySelectorAll('[role="row"]')) {
        const k = satir.getBoundingClientRect()
        if (k.height < 40) continue
        const baslik = satir.querySelector('span[title]')?.getAttribute('title')?.trim()
        if (!baslik) continue // bolum basligi
        adaylar.push({ baslik, x: Math.round(k.x + k.width / 2), y: Math.round(k.y + k.height / 2) })
      }
      // Tam eslesen varsa onu sec, yoksa ilk sohbet satiri
      return adaylar.find((a) => a.baslik === aranan) ?? adaylar[0] ?? null
    }, ad)
    if (!hedef) { hata++; console.log(`[${i + 1}/${kalan.length}] sonuc yok: ${ad}`); continue }

    await page.mouse.click(hedef.x, hedef.y)
    await bekle(2000)

    for (let k = 0; k < 25; k++) {
      const devam = await page.evaluate(() => {
        const kap = Array.from(document.querySelectorAll('#main div'))
          .find((d) => d.scrollHeight > d.clientHeight + 60 && d.clientHeight > 200)
        if (!kap) return false
        const onceki = kap.scrollTop
        kap.scrollTop = 0
        return onceki > 30
      })
      if (!devam) break
      await bekle(800)
    }

    const mesajlar = await mesajlariCek()
    sohbetler.push({ ad, mesajlar })
    islenen.add(ad)
    yazDiske()
    basari++
    if (basari % 10 === 0 || mesajlar.length > 5) console.log(`[${i + 1}/${kalan.length}] ${ad} - ${mesajlar.length} mesaj (toplam ${sohbetler.length})`)
  } catch (e) {
    hata++
    console.log(`[${i + 1}/${kalan.length}] HATA ${ad}: ${e.message.split('\n')[0]}`)
  }
}

console.log(`BITTI. ${basari} yeni, ${hata} basarisiz, toplam ${sohbetler.length}`)
await ctx.close()
