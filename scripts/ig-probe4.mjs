// Tiklama neden gitmiyor: o koordinatta hangi element var, uzerinde katman var mi.
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire('C:/Users/hp/Desktop/operiqoyeni - Kopya (2)/panel/package.json')
const { chromium } = require('playwright')

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const bekle = (ms) => new Promise((r) => setTimeout(r, ms))

const ctx = await chromium.launchPersistentContext(path.join(root, '.ig-profile'), {
  headless: false,
  viewport: null,
  args: ['--start-maximized'],
})
const page = ctx.pages()[0] ?? (await ctx.newPage())
await page.goto('https://www.instagram.com/direct/inbox/', { waitUntil: 'domcontentloaded' })
await bekle(8000)

const rapor = await page.evaluate(() => {
  const bilgi = (e) =>
    e
      ? {
          tag: e.tagName,
          role: e.getAttribute('role'),
          cls: (e.className || '').toString().slice(0, 70),
          pe: getComputedStyle(e).pointerEvents,
          metin: (e.textContent || '').trim().slice(0, 40),
        }
      : null

  // Oğuz Boran satirinin konumu
  const hedef = Array.from(document.querySelectorAll('span')).find(
    (s) => s.childElementCount === 0 && s.textContent?.trim() === 'Oğuz Boran',
  )
  const k = hedef?.getBoundingClientRect()
  const nokta = k ? { x: Math.round(k.x + k.width / 2), y: Math.round(k.y + k.height / 2) } : null
  const ustteki = nokta ? document.elementFromPoint(nokta.x, nokta.y) : null

  // Hedefin atalarinda tiklanabilir bir sey var mi
  const atalar = []
  let p = hedef
  for (let i = 0; i < 10 && p; i++) {
    atalar.push(bilgi(p))
    p = p.parentElement
  }

  // Sayfada dialog / overlay var mi
  const dialoglar = Array.from(document.querySelectorAll('[role="dialog"], [aria-modal="true"]')).map(bilgi)

  // En ustteki elementin atalari
  const ustAtalar = []
  let q = ustteki
  for (let i = 0; i < 6 && q; i++) {
    ustAtalar.push(bilgi(q))
    q = q.parentElement
  }

  return { nokta, hedefVar: !!hedef, ustteki: bilgi(ustteki), ustAtalar, atalar, dialoglar, gorunurluk: document.visibilityState }
})

console.log(JSON.stringify(rapor, null, 1))
await ctx.close()
