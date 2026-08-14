import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const require = createRequire('C:/Users/hp/Desktop/operiqoyeni - Kopya (2)/panel/package.json')
const { chromium } = require('playwright')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ctx = await chromium.launchPersistentContext(path.join(root, '.wa-profile'), { headless: false, viewport: null, args: ['--start-maximized'] })
const page = ctx.pages()[0] ?? (await ctx.newPage())
await page.goto('https://web.whatsapp.com/', { waitUntil: 'domcontentloaded' })
await page.waitForSelector('#pane-side', { timeout: 120000 })
await new Promise(r => setTimeout(r, 4000))
const r = await page.evaluate(() => {
  const bilgi = (e) => ({ tag: e.tagName, role: e.getAttribute('role'), tab: e.getAttribute('data-tab'),
    ph: e.getAttribute('placeholder') || e.getAttribute('aria-placeholder') || '', al: e.getAttribute('aria-label') || '',
    ce: e.getAttribute('contenteditable'), x: Math.round(e.getBoundingClientRect().x), y: Math.round(e.getBoundingClientRect().y) })
  return {
    contenteditable: Array.from(document.querySelectorAll('[contenteditable="true"]')).map(bilgi),
    inputs: Array.from(document.querySelectorAll('input')).map(bilgi),
    textbox: Array.from(document.querySelectorAll('[role="textbox"]')).map(bilgi),
    aramaButonu: Array.from(document.querySelectorAll('button,[role="button"]')).map(e => (e.getAttribute('aria-label')||e.innerText||'').trim()).filter(t => /ara|search/i.test(t)).slice(0,5),
  }
})
console.log(JSON.stringify(r, null, 1))
await ctx.close()
