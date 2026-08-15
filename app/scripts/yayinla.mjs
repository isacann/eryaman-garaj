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

/**
 * ⚠ VERCEL_TOKEN (.secrets.env): tanımlıysa her komuta --token eklenir.
 *
 * Bu, "doğru hesaba dağıtım" sorununun kalıcı çözümü (15 Ağustos dersi):
 * CLI oturumu geliştiricinin kişisel hesabında olabilir; token ise Fatih
 * Bey'in hesabından alınır ve dağıtım HEP onun hesabına gider — makinedeki
 * oturumdan bağımsız. Token: Vercel → Settings → Tokens.
 */
const VERCEL_TOKEN = (env.VERCEL_TOKEN ?? '').trim()

function vercel(argumanlar, secenekler = {}) {
  const tam = VERCEL_TOKEN ? [...argumanlar, '--token', VERCEL_TOKEN] : argumanlar
  return execFileSync('vercel', tam, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    ...secenekler,
  })
}

/**
 * Bir ortam değişkenini yayına yazar.
 *
 * ⚠ 15 Ağustos 2026: `env rm` sessizce başarısız olabiliyor (CLI 58.9, hata
 * "branch_not_found ... on branch undefined") ve arkasından gelen `env add`
 * "already exists" diyerek betiği KOMPLE düşürüyordu — yani sadece bir
 * değişken güncellenemediği için dağıtım hiç yapılamıyordu. Oysa env'ler zaten
 * doğruyken tek istenen şey dağıtımdı.
 *
 * Artık yazma hatası dağıtımı durdurmuyor: değişken atlanıyor, adı biriktirilip
 * SONDA topluca uyarı olarak basılıyor. Yazılamayan değişkenin yayındaki ESKİ
 * değeri kalır — bu yüzden uyarı sessiz değil, listeli ve açık.
 */
const yazilamayanlar = []

function envYaz(ad, deger) {
  for (const ortam of ORTAMLAR) {
    try {
      vercel(['env', 'rm', ad, ortam, '--yes'], { input: '' })
    } catch {
      // Yoksa silinecek bir şey de yok.
    }
    try {
      vercel(['env', 'add', ad, ortam], { input: deger })
    } catch (e) {
      const mesaj = String(e?.stdout ?? e?.message ?? e)
      const zatenVar = /already exists/i.test(mesaj)
      yazilamayanlar.push(`${ad} (${ortam})${zatenVar ? ' — yayındaki eski değer duruyor' : ''}`)
      return false
    }
  }
  return true
}

// 1. Oturum
//
// ⚠ `vercel whoami` takım kapsamındaki oturumlarda "Not authorized" dönebiliyor
// (CLI 58.x, 14 Ağustos 2026'da yaşandı) — oturum sağlam olduğu hâlde. Bu yüzden
// whoami tek başına kanıt sayılmıyor; başarısızsa `teams ls` ile ikinci kez
// bakılıyor. Eskiden burada exit(1) vardı ve geçerli oturumla dağıtım yapılamıyordu.
let kim
try {
  kim = vercel(['whoami'], { input: '', timeout: 20000 }).trim()
} catch {
  try {
    vercel(['teams', 'ls'], { input: '', timeout: 20000 })
    kim = '(whoami cevap vermedi, takım listesi çalışıyor — oturum geçerli)'
  } catch {
    console.error(
      'Vercel CLI oturumu yok.\n' +
        'Bir kez şunu çalıştır: vercel login\n' +
        '(tarayıcıda doğrulama ister, sonra bu betik tek başına çalışır)',
    )
    process.exit(1)
  }
}
console.log(`✓ Vercel oturumu: ${kim}`)

// 1b. HESAP KİLİDİ (15 Ağustos 2026 — pahalı ders)
//
// ⛔ Bu proje YALNIZCA Fatih Bey'in hesaplarına kurulur. Sözleşme Madde 6:
// Vercel / Supabase / Railway / Anthropic hesapları onun adına, faturalar onun
// kartına. Geliştiricinin (İsa / Operiqo) hesabına dağıtım YASAK.
//
// Neden kilit gerekti: 15 Ağustos'ta bir günlük düzeltmenin tamamı yanlış
// hesaptaki bir projeye dağıtıldı. Her dağıtım "başarılı" dedi, alias doğruydu,
// sağlık kontrolü 200 döndü — ama WhatsApp webhook'u Fatih Bey'in projesine
// bakıyordu ve müşteriler bütün gün 14 Ağustos sürümüyle konuştu. Sekiz saat
// boyunca kimse fark etmedi çünkü "dağıtım başarılı" ile "canlı kod güncellendi"
// aynı şey sanıldı.
//
// Kilit, `.secrets.env` içindeki VERCEL_HESAP değeriyle oturumu karşılaştırır.
// Uyuşmazsa dağıtım YAPILMAZ. Değer tanımlı değilse yalnızca uyarır — eski
// kurulumları kırmamak için.
const beklenenHesap = (env.VERCEL_HESAP ?? '').trim()
if (beklenenHesap) {
  const kucuk = kim.toLowerCase()
  if (!kucuk.includes(beklenenHesap.toLowerCase())) {
    console.error(
      `\n⛔ YANLIŞ VERCEL HESABI — dağıtım durduruldu.\n` +
        `   Beklenen : ${beklenenHesap}\n` +
        `   Oturum   : ${kim}\n\n` +
        `   Bu proje yalnızca Fatih Bey'in hesabına dağıtılır (Sözleşme Madde 6).\n` +
        `   Doğru hesaba geçmek için: vercel login\n` +
        `   ya da onun hesabından alınmış bir belirteçle: vercel --token <TOKEN>\n`,
    )
    process.exit(1)
  }
  console.log(`✓ Hesap doğrulandı: ${beklenenHesap}`)
} else {
  console.warn(
    '! .secrets.env içinde VERCEL_HESAP tanımlı değil — hesap kilidi çalışmıyor.\n' +
      '  Yanlış hesaba dağıtım riskine karşı bu değeri tanımla.',
  )
}

// 2. Proje bağlama
console.log(`· proje bağlanıyor: ${PROJE}`)
vercel(['link', '--yes', '--project', PROJE], { input: '', stdio: ['pipe', 'inherit', 'inherit'] })

// 3. Ortam değişkenleri
//
// ⚠ NEXT_PUBLIC_PANEL_ADRES tavuk-yumurta sorunudur: adres ancak İLK dağıtımdan
// sonra belli oluyor, ama betik onu dağıtımdan önce istiyordu ve exit(1) ile
// duruyordu. Yeni kurulumda bu, ilk dağıtımı imkânsız kılıyor. Artık yalnızca
// bu değişken eksikse uyarı verilip devam ediliyor; adres öğrenilince
// .secrets.env'e yazılır ve betik TEKRAR çalıştırılır.
const ILK_DAGITIMDA_OLMAYABILIR = new Set(['NEXT_PUBLIC_PANEL_ADRES'])

for (const [ad, deger] of Object.entries(DEGISKENLER)) {
  if (!deger) {
    if (ILK_DAGITIMDA_OLMAYABILIR.has(ad)) {
      console.warn(
        `! ${ad} henüz yok — ilk dağıtım için normal.\n` +
          '  Dağıtım bitince adresi ../.secrets.env dosyasına yaz ve bu betiği TEKRAR çalıştır.\n' +
          '  Yazılmazsa: bildirimlerdeki "Panelde aç" bağlantısı ve fiyat görselleri çalışmaz.',
      )
      continue
    }
    console.error(`✗ ${ad} boş. ../.secrets.env dosyasına ekle.`)
    process.exit(1)
  }
  if (envYaz(ad, deger)) console.log(`✓ ${ad}`)
  else console.warn(`! ${ad} yazılamadı, dağıtım sürüyor`)
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
  if (envYaz(ad, deger)) console.log(`✓ ${ad}`)
  else console.warn(`! ${ad} yazılamadı, dağıtım sürüyor`)
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

if (yazilamayanlar.length > 0) {
  console.warn(
    [
      '',
      `! Şu ortam değişkenleri GÜNCELLENEMEDİ (${yazilamayanlar.length}):`,
      ...yazilamayanlar.map((y) => `    - ${y}`),
      '  Dağıtım yapıldı ama bu değişkenlerin yayındaki eski değeri duruyor.',
      '  Değer DEĞİŞTİYSE Vercel panelinden elle güncelle: Settings → Environment Variables.',
    ].join('\n'),
  )
}
