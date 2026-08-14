// Eryaman Garaj icin Supabase projesi acar ve anahtarlari .secrets.env'e yazar.
// Kullanim: node scripts/supabase-kur.mjs
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const panelEnv = 'C:/Users/hp/Desktop/operiqoyeni - Kopya (2)/panel/.secrets.env'

const env = Object.fromEntries(
  fs.readFileSync(panelEnv, 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
)
const TOKEN = env.SUPABASE_MGMT_TOKEN
const h = { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }
const bekle = (ms) => new Promise((r) => setTimeout(r, ms))

const orglar = await (await fetch('https://api.supabase.com/v1/organizations', { headers: h })).json()
const orgId = orglar[0].id

const mevcut = await (await fetch('https://api.supabase.com/v1/projects', { headers: h })).json()
let proje = mevcut.find((p) => p.name === 'eryaman-garaj' || p.name === 'eryaman')

if (proje) {
  console.log('proje zaten var: ' + proje.id + ' (' + proje.status + ')')
} else {
  const dbSifre = crypto.randomBytes(24).toString('base64url')
  const r = await fetch('https://api.supabase.com/v1/projects', {
    method: 'POST',
    headers: h,
    body: JSON.stringify({
      organization_id: orgId,
      name: 'eryaman-garaj',
      region: 'eu-central-1', // Frankfurt, Ankara'ya en yakin
      db_pass: dbSifre,
      plan: 'free',
    }),
  })
  const govde = await r.json()
  if (!r.ok) {
    console.log('HATA ' + r.status + ': ' + JSON.stringify(govde))
    process.exit(1)
  }
  proje = govde
  fs.writeFileSync(path.join(root, '.db-sifre.txt'), dbSifre, 'utf8')
  console.log('proje olusturuldu: ' + proje.id)
}

// Hazir olana kadar bekle
for (let i = 0; i < 40; i++) {
  const d = await (await fetch('https://api.supabase.com/v1/projects/' + proje.id, { headers: h })).json()
  console.log('durum: ' + d.status)
  if (d.status === 'ACTIVE_HEALTHY') break
  await bekle(10000)
}

// Anahtarlari al
const anahtarlar = await (await fetch(`https://api.supabase.com/v1/projects/${proje.id}/api-keys`, { headers: h })).json()
const anon = anahtarlar.find((k) => k.name === 'anon')?.api_key
const service = anahtarlar.find((k) => k.name === 'service_role')?.api_key

const gizli = [
  '# Eryaman Garaj - Supabase (git-ignore, tarayiciya GITMEZ)',
  `SUPABASE_URL=https://${proje.id}.supabase.co`,
  `SUPABASE_REF=${proje.id}`,
  `SUPABASE_ANON_KEY=${anon ?? ''}`,
  `SUPABASE_SERVICE_ROLE_KEY=${service ?? ''}`,
  `SUPABASE_MGMT_TOKEN=${TOKEN}`,
  '',
].join('\n')
fs.writeFileSync(path.join(root, '.secrets.env'), gizli, 'utf8')

console.log('ANAHTARLAR .secrets.env dosyasina yazildi.')
console.log('proje ref : ' + proje.id)
console.log('bolge     : ' + (proje.region ?? 'bilinmiyor'))
console.log('anon key  : ' + (anon ? 'alindi' : 'ALINAMADI'))
console.log('service   : ' + (service ? 'alindi' : 'ALINAMADI'))
