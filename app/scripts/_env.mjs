// .secrets.env yükleyici (sadece script'ler için, tarayıcıya GİTMEZ).
// Dosya proje kökünün bir üstünde: C:\Users\hp\Desktop\eryaman\.secrets.env
import { readFileSync } from 'node:fs'

export const SECRETS_URL = new URL('../../.secrets.env', import.meta.url)

export function loadSecrets() {
  let raw
  try {
    raw = readFileSync(SECRETS_URL, 'utf8')
  } catch {
    throw new Error(`.secrets.env bulunamadı: ${SECRETS_URL.pathname}`)
  }
  const env = {}
  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
  const need = [
    'SUPABASE_URL',
    'SUPABASE_REF',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_MGMT_TOKEN',
  ]
  for (const k of need) {
    if (!env[k]) throw new Error(`.secrets.env içinde ${k} yok.`)
  }
  return env
}
