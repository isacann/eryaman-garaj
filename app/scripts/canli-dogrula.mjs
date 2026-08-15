// Canlı ortam kanıtı: "dağıtım başarılı" ile yetinmez, ÜÇ şeyi doğrular.
//
// 15 Ağustos dersi: bir günlük düzeltmenin tamamı yanlış hesaptaki projeye
// dağıtıldı. Her dağıtım "başarılı" dedi, sağlık kontrolü 200 döndü — ama
// WhatsApp webhook'u BAŞKA bir projeye bakıyordu ve müşteriler 8 saat eski
// sürümle konuştu. Bu script o körlüğü kapatır:
//
//   1. Evolution webhook'u HANGİ adrese mesaj gönderiyor → panel adresiyle
//      aynı mı?
//   2. O adresteki canlı kod HANGİ sürüm (KOD_SURUMU) → yerel git hash ile
//      aynı mı?
//   3. pg_cron işleri hangi adresi çağırıyor → aynı adres mi?
//
// Üçü de tutmadan "canlıya çıktı" DENMEZ.
//
// Çalıştır: node scripts/canli-dogrula.mjs
// (yayinla.mjs dağıtımın sonunda otomatik çağırır)

import { execFileSync } from 'node:child_process'
import { loadSecrets } from './_env.mjs'

const env = loadSecrets()
const PANEL = (env.NEXT_PUBLIC_PANEL_ADRES ?? '').replace(/\/+$/, '')

let hata = 0
const sonuc = (ok, mesaj) => {
  console.log(`${ok ? '✓' : '✗'} ${mesaj}`)
  if (!ok) hata += 1
}

// 1. Evolution webhook hedefi
try {
  const r = await fetch(`${env.EVOLUTION_API_URL}/webhook/find/${env.EVOLUTION_INSTANCE}`, {
    headers: { apikey: env.EVOLUTION_API_KEY },
  })
  const j = await r.json()
  const hedef = String(j.url ?? '')
  sonuc(
    hedef.startsWith(`${PANEL}/api/webhooks/whatsapp`),
    `webhook hedefi: ${hedef.split('?')[0] || '(boş)'} ${
      hedef.startsWith(`${PANEL}/`) ? '' : `— BEKLENEN: ${PANEL}/api/webhooks/whatsapp`
    }`,
  )
  sonuc(j.enabled === true, `webhook etkin: ${j.enabled}`)
} catch (e) {
  sonuc(false, `Evolution webhook okunamadı: ${e.message}`)
}

// 2. Canlı kod sürümü
let yerelHash = ''
try {
  yerelHash = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
    encoding: 'utf8',
  }).trim()
} catch {
  /* git yoksa sürüm karşılaştırması atlanır */
}

try {
  const r = await fetch(`${PANEL}/api/webhooks/whatsapp`)
  const j = await r.json()
  const canli = String(j.surum ?? 'bilinmiyor')
  if (yerelHash) {
    sonuc(
      canli === yerelHash,
      `canlı kod sürümü: ${canli} ${canli === yerelHash ? '(yerel ile aynı)' : `— YEREL: ${yerelHash}. Canlıda ESKİ kod koşuyor!`}`,
    )
  } else {
    sonuc(canli !== 'bilinmiyor', `canlı kod sürümü: ${canli}`)
  }
} catch (e) {
  sonuc(false, `panel sağlık kontrolü başarısız: ${e.message}`)
}

// 3. pg_cron hedefi
try {
  const r = await fetch(`https://api.supabase.com/v1/projects/${env.SUPABASE_REF}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SUPABASE_MGMT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: "select command from cron.job where jobname = 'eryaman-zamanlanmis-isler'",
    }),
  })
  const j = await r.json()
  const komut = String(j?.[0]?.command ?? '')
  sonuc(
    komut.includes(`${PANEL}/api/cron`),
    `pg_cron hedefi ${komut.includes(PANEL) ? 'doğru' : `YANLIŞ — npm run cron:kur çalıştır (beklenen: ${PANEL}/api/cron)`}`,
  )
} catch (e) {
  sonuc(false, `pg_cron okunamadı: ${e.message}`)
}

console.log('')
if (hata > 0) {
  console.error(`⛔ ${hata} kontrol DÜŞTÜ — canlı ortam bu koda bakmıyor olabilir.`)
  process.exit(1)
}
console.log('✓ Canlı ortam kanıtlı: webhook + sürüm + cron aynı yere bakıyor.')
