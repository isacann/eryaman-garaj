// WhatsApp Web yapisini cikarir: satir kapsayicisi nedir, tiklaninca ne oluyor, mesajlar nerede.
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire('C:/Users/hp/Desktop/operiqoyeni - Kopya (2)/panel/package.json')
const { chromium } = require('playwright')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const bekle = (ms) => new Promise((r) => setTimeout(r, ms))

const ctx = await chromium.launchPersistentContext(path.join(root, '.wa-profile'), {
  headless: false, viewport: null, args: ['--start-maximized'],
})
const page = ctx.pages()[0] ?? (await ctx.newPage())
await page.goto('https://web.whatsapp.com/', { waitUntil: 'domcontentloaded' })
await page.waitForSelector('#pane-side', { timeout: 120000 })
await bekle(4000)

// 1) Liste satirlarinin yapisi
const liste = await page.evaluate(() => {
  const pane = document.querySelector('#pane-side')
  const say = (s) => pane.querySelectorAll(s).length
  const ilkSatir = pane.querySelector('[role="listitem"], [role="row"], [role="gridcell"]')
  const zincir = []
  let p = pane.querySelector('span[title]')
  for (let i = 0; i < 7 && p; i++) {
    zincir.push({ tag: p.tagName, role: p.getAttribute('role'), cls: (p.className || '').toString().slice(0, 50), h: Math.round(p.getBoundingClientRect().height) })
    p = p.parentElement
  }
  return {
    sayimlar: {
      listitem: say('[role="listitem"]'), row: say('[role="row"]'), gridcell: say('[role="gridcell"]'),
      grid: say('[role="grid"]'), spanTitle: say('span[title]'), listitemDiv: say('div[role="listitem"]'),
    },
    ilkSatirRole: ilkSatir?.getAttribute('role') ?? null,
    spanTitleZinciri: zincir,
  }
})
console.log('LISTE: ' + JSON.stringify(liste, null, 1))

// 2) Ilk satira tikla (span degil, ust kapsayici)
const tiklandi = await page.evaluate(() => {
  const pane = document.querySelector('#pane-side')
  const satir = pane.querySelector('[role="listitem"]') || pane.querySelector('[role="row"]')
  if (!satir) return null
  const k = satir.getBoundingClientRect()
  return { x: Math.round(k.x + k.width / 2), y: Math.round(k.y + k.height / 2), h: Math.round(k.height) }
})
console.log('TIKLAMA HEDEFI: ' + JSON.stringify(tiklandi))
if (tiklandi) {
  await page.mouse.click(tiklandi.x, tiklandi.y)
  await bekle(3500)
}

// 3) Sohbet acildi mi, mesajlar nerede
const sohbet = await page.evaluate(() => {
  const main = document.querySelector('#main')
  const say = (s) => document.querySelectorAll(s).length
  const ornek = Array.from(document.querySelectorAll('[data-pre-plain-text]')).slice(0, 3)
    .map((e) => ({ on: e.getAttribute('data-pre-plain-text'), metin: (e.innerText || '').trim().slice(0, 60) }))
  return {
    mainVar: !!main,
    baslik: main?.querySelector('header')?.innerText?.split('\n')[0] ?? null,
    sayimlar: {
      messageIn: say('div.message-in'), messageOut: say('div.message-out'),
      prePlain: say('[data-pre-plain-text]'), dataId: say('#main [data-id]'),
      copyable: say('#main .copyable-text'), row: say('#main [role="row"]'),
    },
    ornek,
  }
})
console.log('SOHBET: ' + JSON.stringify(sohbet, null, 1))
await ctx.close()
