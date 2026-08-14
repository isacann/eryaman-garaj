// Instagram sayfasinda ne oldugunu tespit eder: URL, baslik, secici sayilari, ekran goruntusu.
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire('C:/Users/hp/Desktop/operiqoyeni - Kopya (2)/panel/package.json')
const { chromium } = require('playwright')

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'arsiv')
fs.mkdirSync(outDir, { recursive: true })

const ctx = await chromium.launchPersistentContext(path.join(root, '.ig-profile'), {
  headless: false,
  viewport: null,
  args: ['--start-maximized'],
})
const page = ctx.pages()[0] ?? (await ctx.newPage())
await page.goto('https://www.instagram.com/direct/inbox/', { waitUntil: 'domcontentloaded' })
await new Promise((r) => setTimeout(r, 8000))

console.log('URL   : ' + page.url())
console.log('BASLIK: ' + (await page.title()))

const sayimlar = await page.evaluate(() => ({
  'a[href^="/direct/t/"]': document.querySelectorAll('a[href^="/direct/t/"]').length,
  'a[href*="/direct/t/"]': document.querySelectorAll('a[href*="/direct/t/"]').length,
  'div[role="listitem"]': document.querySelectorAll('div[role="listitem"]').length,
  'div[role="row"]': document.querySelectorAll('div[role="row"]').length,
  'div[role="button"]': document.querySelectorAll('div[role="button"]').length,
  'input[name="username"]': document.querySelectorAll('input[name="username"]').length,
  govdeMetni: document.body.innerText.slice(0, 600),
}))
console.log(JSON.stringify(sayimlar, null, 2))

await page.screenshot({ path: path.join(outDir, 'ig-teshis.png'), fullPage: false })
console.log('Ekran goruntusu: arsiv/ig-teshis.png')
await ctx.close()
