// Teslim için .secrets.env şablonu üretir.
// Çalıştır: node scripts/teslim-env.mjs
//
// NEDEN VAR: teslimde ortam değişkenlerinin bir kısmı DEĞİŞİYOR (Supabase,
// Anthropic — hesap sahibi değiştiği için), bir kısmı AYNEN KALIYOR (Meta,
// Telegram — zaten işletmenin kendi hesapları), bir kısmı da ARTIK GEREKSİZ
// (OpenAI, WhatsApp Cloud API). Elle taşırken bir satır atlamak ya da eski
// anahtarı bırakmak sessiz bir arızaya dönüşüyor: uygulama açılıyor, panel
// çalışıyor, ama bot cevap veremiyor.
//
// Bu betik mevcut .secrets.env'i okuyup `.secrets.env.teslim` üretir:
//   • korunacaklar   → değeriyle birlikte aynen taşınır
//   • yenilenecekler → << >> içinde işaretli boşluk bırakılır
//   • üretilebilirler→ rastgele üretilip doldurulur (CRON_SECRET gibi)
//   • gereksizler    → hiç yazılmaz
//
// ⚠ Üretilen dosya SIR İÇERİR. .gitignore'da `.secrets.env*` deseni var.

import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const kok = path.resolve(process.cwd(), '..')
const kaynak = path.join(kok, '.secrets.env')
const hedef = path.join(kok, '.secrets.env.teslim')

if (!existsSync(kaynak)) {
  console.error(`Kaynak bulunamadı: ${kaynak}`)
  console.error('Bu betiği app/ klasöründen çalıştır: node scripts/teslim-env.mjs')
  process.exit(1)
}

const mevcut = {}
for (const satir of readFileSync(kaynak, 'utf8').split(/\r?\n/)) {
  const t = satir.trim()
  if (!t || t.startsWith('#')) continue
  const i = t.indexOf('=')
  if (i > 0) mevcut[t.slice(0, i).trim()] = t.slice(i + 1).trim()
}

const uret = (n) => randomBytes(n).toString('base64url')

/** Bölümler sırayla yazılır; her değişken bir eylem taşır. */
const BOLUMLER = [
  {
    baslik: 'Supabase — YENİ PROJE (Frankfurt, eu-central-1)',
    not: 'Settings → API ekranından kopyalanır. service_role RLS baypas eder, tarayıcıya asla gitmez.',
    degiskenler: [
      ['SUPABASE_URL', 'yenile'],
      ['SUPABASE_REF', 'yenile'],
      ['SUPABASE_ANON_KEY', 'yenile'],
      ['SUPABASE_SERVICE_ROLE_KEY', 'yenile'],
      ['SUPABASE_MGMT_TOKEN', 'yenile', 'Account → Access Tokens'],
    ],
  },
  {
    baslik: 'Yanıt motoru',
    not: 'Anahtar işletmenin kendi Anthropic hesabından alınır. Auto-reload AÇIK olmalı.',
    degiskenler: [
      ['MOTOR_SAGLAYICI', 'koru'],
      ['MOTOR_MODEL', 'koru'],
      ['ANTHROPIC_API_KEY', 'yenile', 'console.anthropic.com → API Keys'],
    ],
  },
  {
    baslik: 'Panel ve zamanlanmış işler',
    not: 'PANEL_ADRES Vercel dağıtımından sonra belli olur; dağıtımı yapıp buraya yaz, sonra yayinla komutunu TEKRAR çalıştır.',
    degiskenler: [
      ['CRON_SECRET', 'uret', 'pg_cron bu sırla çağırıyor; eksikse /api/cron 401 döner'],
      ['NEXT_PUBLIC_PANEL_ADRES', 'yenile', 'Vercel dağıtımından sonra'],
    ],
  },
  {
    baslik: 'WhatsApp — Evolution API (Railway)',
    not: 'Railway dağıtımından sonra doldurulur. API_KEY, Railway şablonundaki AUTHENTICATION_API_KEY ile AYNI olmalı.',
    degiskenler: [
      ['EVOLUTION_API_URL', 'yeni', 'https://xxx.up.railway.app'],
      ['EVOLUTION_API_KEY', 'yeni', 'Railway AUTHENTICATION_API_KEY ile aynı'],
      ['EVOLUTION_INSTANCE', 'yeni', 'bağlı cihaz oturumunun adı'],
      ['EVOLUTION_WEBHOOK_SIR', 'uret', 'webhook adresine ?sir=... diye eklenir'],
    ],
  },
  {
    baslik: 'Instagram — Meta (DEĞİŞMİYOR)',
    not: 'Uygulama zaten işletmenin portföyünde. Bu değerlere dokunulmaz.',
    degiskenler: [
      ['META_WEBHOOK_VERIFY_TOKEN', 'koru'],
      ['META_APP_SECRET', 'koru'],
      ['META_INSTAGRAM_APP_SECRET', 'koru'],
      ['INSTAGRAM_APP_ID', 'koru'],
      ['INSTAGRAM_TOKEN', 'koru', '⚠ 60 günlük, yenileme takibi kurulmadı'],
    ],
  },
  {
    baslik: 'Telegram bildirimi (DEĞİŞMİYOR)',
    not: 'Bot zaten işletmenin; sohbet kimliği veritabanında (settings.telegram_chat_id), burada değil.',
    degiskenler: [['TELEGRAM_BOT_TOKEN', 'koru']],
  },
]

/** Yazılmayacaklar — sebebiyle birlikte dosyanın sonunda hatırlatılır. */
const BIRAKILANLAR = [
  ['OPENAI_API_KEY', 'Anthropic\'e geçildi'],
  ['WHATSAPP_TOKEN', 'Evolution\'a geçildi, Cloud API kullanılmıyor'],
  ['WHATSAPP_PHONE_NUMBER_ID', 'Evolution\'a geçildi'],
  ['WHATSAPP_WABA_ID', 'Evolution\'a geçildi'],
]

const satirlar = [
  '# .secrets.env — TESLİM SÜRÜMÜ',
  '# node scripts/teslim-env.mjs ile üretildi.',
  '#',
  '# << ... >> içindeki her satır DOLDURULMALI. Dolduruldukça bu dosya',
  '# .secrets.env olarak kaydedilir, sonra: cd app && npm run env',
  '',
]

const eksikler = []
const korunanlar = []

for (const bolum of BOLUMLER) {
  satirlar.push(`# ---- ${bolum.baslik} ----`)
  if (bolum.not) satirlar.push(`# ${bolum.not}`)

  for (const [ad, eylem, aciklama] of bolum.degiskenler) {
    if (aciklama) satirlar.push(`# ${aciklama}`)

    if (eylem === 'koru') {
      const deger = mevcut[ad]
      if (deger) {
        satirlar.push(`${ad}=${deger}`)
        korunanlar.push(ad)
      } else {
        satirlar.push(`${ad}=<< EKSİK — eski dosyada da yoktu >>`)
        eksikler.push(ad)
      }
    } else if (eylem === 'uret') {
      satirlar.push(`${ad}=${uret(24)}`)
    } else {
      satirlar.push(`${ad}=<< DOLDUR >>`)
      eksikler.push(ad)
    }
  }
  satirlar.push('')
}

satirlar.push('# ---- Bilerek YAZILMAYANLAR ----')
for (const [ad, sebep] of BIRAKILANLAR) satirlar.push(`# ${ad} — ${sebep}`)
satirlar.push('')

writeFileSync(hedef, satirlar.join('\n'), 'utf8')

console.log(`✓ ${path.relative(kok, hedef)} yazıldı\n`)
console.log(`Eski dosyadan AYNEN taşınan (${korunanlar.length}): ${korunanlar.join(', ')}`)
console.log(`Otomatik üretilen: CRON_SECRET, EVOLUTION_WEBHOOK_SIR`)
console.log(`\nDoldurulacak ${eksikler.length} değer:`)
for (const ad of eksikler) console.log(`  • ${ad}`)
console.log('\nHepsi dolunca:')
console.log('  1. .secrets.env.teslim → .secrets.env olarak kaydet')
console.log('  2. cd app && npm run env      (app/.env.local üretir)')
console.log('  3. cd app && npm run yayinla  (Vercel\'e yükler)')
