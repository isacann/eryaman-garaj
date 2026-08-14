// .secrets.env → app/.env.local üretir. .env* git-ignore'da, depoya girmez.
// Çalıştır: npm run env
import { writeFileSync, existsSync } from 'node:fs'
import { loadSecrets } from './_env.mjs'

const env = loadSecrets()
const target = new URL('../.env.local', import.meta.url)

// Yanıt motorunun değişkenleri opsiyoneldir: .secrets.env'de yoksa satır yazılmaz.
// Anahtar gelmeden motor "sahte" sağlayıcıyla çalışmaya devam eder.
const MOTOR_DEGISKENLERI = [
  ['MOTOR_SAGLAYICI', 'openai | gemini | gemini-lite | anthropic | sahte'],
  ['MOTOR_MODEL', 'model adını elle ezmek için, boş bırakılabilir'],
  ['OPENAI_API_KEY', 'openai sağlayıcısı için'],
  ['GEMINI_API_KEY', 'gemini ve gemini-lite sağlayıcıları için'],
  ['ANTHROPIC_API_KEY', 'anthropic sağlayıcısı için'],
  ['MOTOR_TEYITSIZ_FIYAT', 'evet dersen 3b tablosundaki teyitsiz fiyatlar da kullanılır'],
]

const motorSatirlari = []
for (const [ad, aciklama] of MOTOR_DEGISKENLERI) {
  if (env[ad]) motorSatirlari.push(`# ${aciklama}\n${ad}=${env[ad]}`)
}

const motorBloku =
  motorSatirlari.length > 0
    ? `\n# Yanıt motoru (sadece sunucu tarafı)\n${motorSatirlari.join('\n')}\n`
    : '\n# Yanıt motoru: .secrets.env içinde MOTOR_/GEMINI_/ANTHROPIC_ anahtarı yok.\n' +
      '# Anahtarsız denemek için: npm run altin-set -- --saglayici=sahte\n'

// Bildirim ve zamanlanmış işler. Hepsi opsiyonel: yoksa ilgili özellik sessizce
// kapalı kalır, uygulama yine çalışır.
const EK_DEGISKENLER = [
  ['TELEGRAM_BOT_TOKEN', 'Telegram bot jetonu (Operiqo kurar). Yoksa bildirim gitmez.'],
  ['TELEGRAM_OPERIQO_CHAT_ID', 'Sistem arızası bildirimlerinin gideceği Operiqo sohbeti.'],
  ['CRON_SECRET', '/api/cron rotasının paylaşılan sırrı. Yoksa üretimde rota kapalı.'],
  ['NEXT_PUBLIC_PANEL_ADRES', 'Bildirimlerdeki "Panelde aç" bağlantısının kökü.'],
  // WhatsApp — Evolution API (Railway). Yoksa WhatsApp kanalı çalışmaz.
  ['EVOLUTION_API_URL', 'Evolution sunucusunun adresi (Railway).'],
  ['EVOLUTION_API_KEY', 'Evolution AUTHENTICATION_API_KEY. Webhook doğrulaması da buna bakıyor.'],
  ['EVOLUTION_INSTANCE', 'Bağlı cihaz oturumunun adı.'],
  ['EVOLUTION_WEBHOOK_SIR', 'Webhook adresine ?sir= diye eklenen yedek doğrulama.'],
  // Instagram — Meta resmî API'si.
  ['META_WEBHOOK_VERIFY_TOKEN', 'Meta webhook kurulumundaki "Verify token".'],
  ['META_APP_SECRET', 'Meta uygulama sırrı (imza doğrulaması).'],
  ['META_INSTAGRAM_APP_SECRET', 'Instagram uygulamasının kendi sırrı.'],
  ['INSTAGRAM_APP_ID', 'Instagram uygulama kimliği.'],
  ['INSTAGRAM_TOKEN', 'Instagram erişim jetonu (60 gün, yenileme takibi kurulmadı).'],
]

const ekSatirlar = []
for (const [ad, aciklama] of EK_DEGISKENLER) {
  if (env[ad]) ekSatirlar.push(`# ${aciklama}\n${ad}=${env[ad]}`)
}

const ekBlok =
  ekSatirlar.length > 0
    ? `\n# Bildirim ve zamanlanmış işler\n${ekSatirlar.join('\n')}\n`
    : '\n# Bildirim/cron değişkeni tanımlı değil: Telegram bildirimi ve cron kapalı.\n'

const body = `# .secrets.env'den üretildi (npm run env). ELLE DÜZENLEME, DEPOYA KOYMA.
NEXT_PUBLIC_SUPABASE_URL=${env.SUPABASE_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${env.SUPABASE_ANON_KEY}

# Sadece sunucu tarafı (webhook, cron). Tarayıcıya ASLA gitmez.
SUPABASE_SERVICE_ROLE_KEY=${env.SUPABASE_SERVICE_ROLE_KEY}
${motorBloku}${ekBlok}`

if (existsSync(target)) console.log('  (mevcut .env.local üzerine yazılıyor)')
writeFileSync(target, body, 'utf8')
console.log('✓ .env.local yazıldı')
if (motorSatirlari.length === 0) {
  console.log('  not: yanıt motoru anahtarı bulunamadı, motor sadece "sahte" ile koşar.')
}
