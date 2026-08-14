// Supabase şemasını kurar (Management API) ve auth URL'lerini ayarlar.
// Çalıştır: npm run db:kur
import { readFileSync } from 'node:fs'
import { loadSecrets } from './_env.mjs'

const env = loadSecrets()
const schema = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8')

async function runSQL(sql) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${env.SUPABASE_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.SUPABASE_MGMT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    },
  )
  const text = await res.text()
  if (!res.ok) throw new Error(`SQL hata ${res.status}: ${text}`)
  return text
}

async function setAuthConfig() {
  // Tek yönetici kullanıcı, e-posta + şifre (KAPSAM karar 10). Sihirli link kapalı.
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${env.SUPABASE_REF}/config/auth`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${env.SUPABASE_MGMT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        site_url: 'http://localhost:3000',
        uri_allow_list: 'http://localhost:3000,http://localhost:3000/**',
        disable_signup: true,
        external_email_enabled: true,
        mailer_autoconfirm: true,
      }),
    },
  )
  if (!res.ok) console.warn('  auth config uyarı:', res.status, await res.text())
  else console.log('  ✓ auth ayarları yazıldı (kayıt kapalı, e-posta + şifre)')
}

console.log('→ Şema kuruluyor:', env.SUPABASE_REF)
await runSQL(schema)
console.log('  ✓ şema çalıştı')

const tables = JSON.parse(
  await runSQL(
    `select table_name from information_schema.tables
     where table_schema='public' order by table_name;`,
  ),
).map((r) => r.table_name)
console.log('  tablolar:', tables.join(', '))

const policies = JSON.parse(
  await runSQL(
    `select tablename, policyname from pg_policies
     where schemaname='public' order by tablename;`,
  ),
)
console.log('  RLS policy sayısı:', policies.length)

const rlsOff = JSON.parse(
  await runSQL(
    `select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relkind='r' and c.relrowsecurity=false;`,
  ),
)
if (rlsOff.length) console.warn('  ⚠ RLS KAPALI tablolar:', rlsOff.map((r) => r.relname).join(', '))
else console.log('  ✓ tüm tablolarda RLS açık')

await setAuthConfig()
console.log('✓ provision bitti')
