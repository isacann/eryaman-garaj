// Vercel'e yayınlar: projeyi bağlar, ortam değişkenlerini yazar, üretime çıkar.
//
// Anahtarlar ../.secrets.env'den okunur, komut satırına yazılmaz, depoya girmez.
// Vercel CLI'da OTURUM AÇIK olmalı; bir kez "vercel login" demek yeterli.
//
// Çalıştır: npm run yayinla
//           npm run yayinla -- --proje eryaman-garaj-panel

import { execFileSync } from 'node:child_process'
import { loadSecrets } from './_env.mjs'

const env = loadSecrets()

const argv = process.argv.slice(2)
function bayrak(ad, varsayilan) {
  const i = argv.indexOf(`--${ad}`)
  return i !== -1 && argv[i + 1] ? argv[i + 1] : varsayilan
}
const PROJE = bayrak('proje', 'eryaman-garaj-panel')

/** Uygulamanın çalışması için Vercel'de bulunması gereken değişkenler. */
const DEGISKENLER = {
  NEXT_PUBLIC_SUPABASE_URL: env.SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
  MOTOR_SAGLAYICI: env.MOTOR_SAGLAYICI ?? 'openai',
  MOTOR_MODEL: env.MOTOR_MODEL ?? 'gpt-5.4-mini',
  // Zamanlanmış işlerin kapısı. Supabase pg_cron bu sırla çağırıyor;
  // eksikse /api/cron üretimde 401 döner ve hiçbir takip gönderilmez.
  CRON_SECRET: env.CRON_SECRET,
  // Bildirimlerdeki "Panelde aç" bağlantısı ve fiyat görsellerinin adresi.
  NEXT_PUBLIC_PANEL_ADRES: env.NEXT_PUBLIC_PANEL_ADRES,
}

/**
 * Olmasa da uygulamanın çalıştığı, ilgili özelliği sessizce kapatan değişkenler.
 * Telegram jetonunu Operiqo üretir; gelene kadar bildirimler kuyrukta bekler.
 */
const ISTEGE_BAGLI = {
  TELEGRAM_BOT_TOKEN: env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_OPERIQO_CHAT_ID: env.TELEGRAM_OPERIQO_CHAT_ID,
  // Sağlayıcı anahtarları: hangisi tanımlıysa o yüklenir. MOTOR_SAGLAYICI
  // hangisini seçerse onun anahtarı bulunmak zorunda.
  OPENAI_API_KEY: env.OPENAI_API_KEY,
  GEMINI_API_KEY: env.GEMINI_API_KEY,
  ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,

  // ⚠ 14 Ağustos'ta eklendi. Bunlar listede YOKTU: Meta değişkenleri Vercel'e
  // elle girilmişti ve `npm run yayinla` onları taşımıyordu. Teslimde yeni
  // hesaba dağıtım yapılınca bot sessizce cevap veremez hâle gelirdi —
  // hata da vermez, çünkü kanal katmanı anahtar yoksa istisna atıp yutuluyor.

  // WhatsApp — Evolution API (kendi Railway sunucumuz)
  EVOLUTION_API_URL: env.EVOLUTION_API_URL,
  EVOLUTION_API_KEY: env.EVOLUTION_API_KEY,
  EVOLUTION_INSTANCE: env.EVOLUTION_INSTANCE,
  EVOLUTION_WEBHOOK_SIR: env.EVOLUTION_WEBHOOK_SIR,

  // Instagram — Meta resmî API'sinde kalıyor
  META_WEBHOOK_VERIFY_TOKEN: env.META_WEBHOOK_VERIFY_TOKEN,
  META_APP_SECRET: env.META_APP_SECRET,
  META_INSTAGRAM_APP_SECRET: env.META_INSTAGRAM_APP_SECRET,
  INSTAGRAM_APP_ID: env.INSTAGRAM_APP_ID,
  INSTAGRAM_TOKEN: env.INSTAGRAM_TOKEN,
}

const ORTAMLAR = ['production', 'preview']

function vercel(argumanlar, secenekler = {}) {
  return execFileSync('vercel', argumanlar, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    ...secenekler,
  })
}

// 1. Oturum
let kim
try {
  kim = vercel(['whoami'], { input: '', timeout: 20000 }).trim()
} catch {
  console.error(
    'Vercel CLI oturumu yok.\n' +
      'Bir kez şunu çalıştır: vercel login\n' +
      '(tarayıcıda doğrulama ister, sonra bu betik tek başına çalışır)',
  )
  process.exit(1)
}
console.log(`✓ Vercel oturumu: ${kim}`)

// 2. Proje bağlama
console.log(`· proje bağlanıyor: ${PROJE}`)
vercel(['link', '--yes', '--project', PROJE], { input: '', stdio: ['pipe', 'inherit', 'inherit'] })

// 3. Ortam değişkenleri
for (const [ad, deger] of Object.entries(DEGISKENLER)) {
  if (!deger) {
    console.error(`✗ ${ad} boş. ../.secrets.env dosyasına ekle.`)
    process.exit(1)
  }
  for (const ortam of ORTAMLAR) {
    try {
      vercel(['env', 'rm', ad, ortam, '--yes'], { input: '' })
    } catch {
      // Yoksa silinecek bir şey de yok.
    }
    vercel(['env', 'add', ad, ortam], { input: deger })
  }
  console.log(`✓ ${ad}`)
}

for (const [ad, deger] of Object.entries(ISTEGE_BAGLI)) {
  if (!deger) {
    // Yerelde silinmiş bir anahtar yayında KALMAMALI. Eskiden burası sadece
    // "atlandı" deyip geçiyordu; kullanılmayan sağlayıcı anahtarları üretimde
    // öylece duruyordu (11 Ağustos: Gemini bırakıldı, anahtarı Vercel'de kaldı).
    for (const ortam of ORTAMLAR) {
      try {
        vercel(['env', 'rm', ad, ortam, '--yes'], { input: '' })
        console.log(`· ${ad} yayından silindi (${ortam})`)
      } catch {
        // Zaten yoktu.
      }
    }
    console.log(`· ${ad} tanımlı değil, atlandı (ilgili özellik kapalı kalır)`)
    continue
  }
  for (const ortam of ORTAMLAR) {
    try {
      vercel(['env', 'rm', ad, ortam, '--yes'], { input: '' })
    } catch {
      // Yoksa silinecek bir şey de yok.
    }
    vercel(['env', 'add', ad, ortam], { input: deger })
  }
  console.log(`✓ ${ad}`)
}

// 4. Fiyat listesi kopyası (yayında üst dizin yok, kopya şart)
execFileSync(process.execPath, ['scripts/fiyat-esitle.mjs'], { stdio: 'inherit' })

// 5. Üretime çıkış
console.log('\n· derleniyor ve yayınlanıyor...')
const cikti = vercel(['deploy', '--prod', '--yes'], {
  input: '',
  stdio: ['pipe', 'pipe', 'inherit'],
})
const adres = cikti.trim().split(/\s+/).pop()
console.log(`\n✓ yayında: ${adres}`)
console.log('Panele giriş: npm run kullanici:ekle -- <e-posta> <sifre>')
