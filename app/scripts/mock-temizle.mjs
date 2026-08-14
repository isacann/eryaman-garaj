// Test verisini siler: betikle beslenen sahte kanal (mock) ve paneldeki
// test konsolu (test). Gerçek WhatsApp/Instagram yazışmalarına dokunmaz.
// Çalıştır: npm run test:temizle
import { loadSecrets } from './_env.mjs'

const env = loadSecrets()

async function api(yol, secenekler = {}) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${yol}`, {
    ...secenekler,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...secenekler.headers,
    },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${res.status}: ${text}`)
  return text ? JSON.parse(text) : []
}

// contacts silinince conversations ve messages cascade ile gider.
const silinen = await api('contacts?kanal=in.(mock,test)', { method: 'DELETE' })
console.log(`✓ ${silinen.length} test kişisi ve bağlı yazışmaları silindi`)

const log = await api('activity_log?tip=in.(mock_gonderim,test_gonderim)', { method: 'DELETE' })
console.log(`✓ ${log.length} test gönderim kaydı silindi`)
