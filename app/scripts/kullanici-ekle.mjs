// Panelin tek yönetici kullanıcısını açar (KAPSAM karar 10).
// Kayıt sayfası yok, kullanıcı buradan açılır.
// Çalıştır: node scripts/kullanici-ekle.mjs <e-posta> <sifre>
import { loadSecrets } from './_env.mjs'

const env = loadSecrets()
const [email, password] = process.argv.slice(2)

if (!email || !password) {
  console.error('Kullanım: node scripts/kullanici-ekle.mjs <e-posta> <sifre>')
  process.exit(1)
}

const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
  method: 'POST',
  headers: {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ email, password, email_confirm: true }),
})

const data = await res.json()
if (!res.ok) {
  console.error('Hata', res.status, data)
  process.exit(1)
}
console.log('✓ kullanıcı hazır:', data.email, data.id)
