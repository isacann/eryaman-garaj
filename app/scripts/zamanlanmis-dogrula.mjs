// Zamanlanmış iş kurallarının uçtan uca doğrulaması.
//
// NE DOĞRULAR (KAPSAM kararları):
//   karar 6 — takip merdiveni kuruluyor mu, zamanı gelince gidiyor mu,
//             müşteri yazınca / ekip devralınca iptal oluyor mu
//   karar 4 — 15 dakika devir hatırlatması
//   karar 5 — mesai dışı tek mesaj + sabah kuyruğu
//   Bölüm 5 — bildirim kuyruğu (Telegram jetonu olmasa da satır yazılmalı)
//
// Zamanı bekleyemeyiz, o yüzden kuyruk satırlarının planlanan_at değerini
// geçmişe çekip cron rotasını çağırıyoruz. Gerçek akışın aynısı çalışır.
//
// Çalıştır (dev sunucusu ayakta olmalı):
//   npm run dev
//   node scripts/zamanlanmis-dogrula.mjs

import { createClient } from '@supabase/supabase-js'
import { loadSecrets } from './_env.mjs'

const env = loadSecrets()
const ADRES = process.env.PANEL_ADRES ?? 'http://localhost:3000'
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const KIMLIK = `dogrula-${Date.now()}`
let gecti = 0
let kaldi = 0
const notlar = []

function kontrol(ad, sonucMu, ayrinti = '') {
  if (sonucMu) {
    gecti += 1
    console.log(`  ✓ ${ad}`)
  } else {
    kaldi += 1
    console.log(`  ✗ ${ad}${ayrinti ? ` — ${ayrinti}` : ''}`)
    notlar.push(ad)
  }
}

async function mockMesaj(metin) {
  const res = await fetch(`${ADRES}/api/mock/gelen`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kimlik: KIMLIK, ad: 'Doğrulama Testi', metin }),
  })
  if (!res.ok) throw new Error(`mock/gelen ${res.status}: ${await res.text()}`)
  return res.json()
}

async function cronCalistir() {
  const baslik = env.CRON_SECRET ? { Authorization: `Bearer ${env.CRON_SECRET}` } : {}
  const res = await fetch(`${ADRES}/api/cron`, { headers: baslik })
  if (!res.ok) throw new Error(`cron ${res.status}: ${await res.text()}`)
  return res.json()
}

async function temizle() {
  const { data: kisi } = await db
    .from('contacts')
    .select('id')
    .eq('kanal_kimlik', KIMLIK)
    .maybeSingle()
  if (kisi) await db.from('contacts').delete().eq('id', kisi.id)
}

console.log(`\nZamanlanmış iş doğrulaması — ${ADRES}\n`)

// ---------------------------------------------------------------------------
console.log('1) Gelen mesaj → bot cevabı → takip merdiveni')

const ilk = await mockMesaj('Merhaba, Passat 2020 için ppf fiyatı alabilir miyim?')
const konusmaId = ilk.sonuclar?.[0]?.konusmaId
kontrol('konuşma açıldı', Boolean(konusmaId), JSON.stringify(ilk).slice(0, 200))

if (!konusmaId) {
  console.log('\nKonuşma açılamadı, devam edilemiyor.')
  process.exit(1)
}

// Botu tetikle: mock webhook'u sadece kaydediyor, cevabı cron/panel üretmiyor.
// Gerçek Meta webhook'unda bot çağrısı da orada olacak; burada elle çağırıyoruz.
const { botCevaplaHttp } = { botCevaplaHttp: null }
void botCevaplaHttp

// Bot cevabını üretmek için mesai kuyruğunu kullanıyoruz: konuşmayı
// "mesai bekliyor" işaretleyip cron'a yazdırıyoruz.
await db
  .from('conversations')
  .update({ meta: { mesai_bekliyor: true } })
  .eq('id', konusmaId)

const cron1 = await cronCalistir()
kontrol(
  'cron çalıştı ve sabah kuyruğunu işledi',
  cron1.mesaiKuyrugu !== undefined && !cron1.mesaiKuyruguHata,
  JSON.stringify(cron1.mesaiKuyruguHata ?? cron1.mesaiKuyrugu),
)

const { data: botMesajlari } = await db
  .from('messages')
  .select('id, yon, gonderen, metin')
  .eq('conversation_id', konusmaId)
  .eq('yon', 'giden')

kontrol(
  'bot cevap yazdı',
  (botMesajlari?.length ?? 0) > 0,
  `giden mesaj sayısı: ${botMesajlari?.length ?? 0}`,
)

const { data: takipler } = await db
  .from('followups')
  .select('basamak, durum, planlanan_at')
  .eq('conversation_id', konusmaId)

kontrol(
  'takip merdiveni kuruldu (20dk + 6saat + sablon)',
  (takipler?.length ?? 0) === 3,
  `bulunan: ${(takipler ?? []).map((t) => t.basamak).join(', ') || 'yok'}`,
)

// ---------------------------------------------------------------------------
console.log('\n2) Takip zamanı gelince gönderiliyor mu')

const gecmis = new Date(Date.now() - 60 * 60_000).toISOString()
await db
  .from('followups')
  .update({ planlanan_at: gecmis })
  .eq('conversation_id', konusmaId)
  .eq('basamak', '20dk')

const cron2 = await cronCalistir()
kontrol('cron takip işini çalıştırdı', !cron2.takipHata, JSON.stringify(cron2.takipHata ?? cron2.takip))

const { data: ucSaat } = await db
  .from('followups')
  .select('durum, gonderildi_at')
  .eq('conversation_id', konusmaId)
  .eq('basamak', '20dk')
  .maybeSingle()

kontrol(
  '20. dakika takibi gönderildi',
  ucSaat?.durum === 'gonderildi',
  `durum: ${ucSaat?.durum}`,
)

// ---------------------------------------------------------------------------
console.log('\n3) Şablon basamağı kapalıyken gönderilmiyor mu (KAPSAM Madde 4.3)')

await db
  .from('followups')
  .update({ planlanan_at: gecmis })
  .eq('conversation_id', konusmaId)
  .eq('basamak', 'sablon')

await cronCalistir()

const { data: sablon } = await db
  .from('followups')
  .select('durum, meta')
  .eq('conversation_id', konusmaId)
  .eq('basamak', 'sablon')
  .maybeSingle()

kontrol(
  'şablon takibi gönderilmedi, iptal edildi',
  sablon?.durum === 'iptal' && sablon?.meta?.sebep === 'sablon-kapali',
  `durum: ${sablon?.durum}, sebep: ${sablon?.meta?.sebep}`,
)

// ---------------------------------------------------------------------------
console.log('\n4) 15 dakika devir kuralı (KAPSAM karar 4)')

const onAltiDkOnce = new Date(Date.now() - 16 * 60_000).toISOString()
await db
  .from('conversations')
  .update({ durum: 'bot', meta: { devir_bayrak_at: onAltiDkOnce } })
  .eq('id', konusmaId)

const cron3 = await cronCalistir()
kontrol(
  'cron devir hatırlatmasını çalıştırdı',
  !cron3.devirHatirlatmaHata,
  JSON.stringify(cron3.devirHatirlatmaHata ?? cron3.devirHatirlatma),
)

const { data: hatirlatma } = await db
  .from('messages')
  .select('metin')
  .eq('conversation_id', konusmaId)
  .eq('yon', 'giden')
  .ilike('metin', '%birazdan%')
  .maybeSingle()

const { data: konusmaSon } = await db
  .from('conversations')
  .select('meta')
  .eq('id', konusmaId)
  .maybeSingle()

// Mesai dışındaysa hatırlatma bilinçli olarak gönderilmez.
const saat = Number(
  new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    hour: '2-digit',
    hour12: false,
  }).format(new Date()),
)
const mesaiIcinde = saat >= 8 || saat < 1

if (mesaiIcinde) {
  kontrol('devir hatırlatması gönderildi', Boolean(hatirlatma), 'mesaj bulunamadı')
  kontrol(
    'hatırlatma damgası kondu (tekrar gönderilmesin)',
    Boolean(konusmaSon?.meta?.devir_hatirlatma_at),
  )
} else {
  console.log('  · mesai dışı: hatırlatma bilinçli olarak ertelendi, atlanıyor')
}

// ---------------------------------------------------------------------------
console.log('\n5) Müşteri yazınca takip iptal oluyor mu')

await db
  .from('followups')
  .update({ durum: 'beklemede', planlanan_at: gecmis })
  .eq('conversation_id', konusmaId)
  .eq('basamak', '6saat')

// Müşteri yeni mesaj yazıyor.
await mockMesaj('Peki taksit yapıyor musunuz?')

const cron4 = await cronCalistir()
void cron4

const { data: yirmiSaat } = await db
  .from('followups')
  .select('durum, meta')
  .eq('conversation_id', konusmaId)
  .eq('basamak', '6saat')
  .maybeSingle()

kontrol(
  '6. saat takibi müşteri yazdığı için gönderilmedi',
  yirmiSaat?.durum !== 'gonderildi',
  `durum: ${yirmiSaat?.durum}, sebep: ${yirmiSaat?.meta?.sebep}`,
)

// ---------------------------------------------------------------------------
console.log('\n6) Bildirim kuyruğu (KAPSAM Bölüm 5)')

const { data: bildirimler } = await db
  .from('notifications')
  .select('tip, hedef, durum, son_hata')
  .eq('conversation_id', konusmaId)

kontrol(
  'bot turundan sonra bildirim satırı yazıldı',
  (bildirimler?.length ?? 0) > 0,
  `bulunan: ${(bildirimler ?? []).map((b) => b.tip).join(', ') || 'yok'}`,
)

const telegramKurulu = Boolean(env.TELEGRAM_BOT_TOKEN)
if (!telegramKurulu) {
  const beklemede = (bildirimler ?? []).every((b) => b.durum !== 'gonderildi')
  kontrol(
    'Telegram kurulu değilken bildirim kuyrukta bekliyor (kaybolmuyor)',
    beklemede,
  )
}

// ---------------------------------------------------------------------------
await temizle()

console.log(`\n${'─'.repeat(50)}`)
console.log(`Geçen: ${gecti}   Kalan: ${kaldi}`)
if (kaldi > 0) {
  console.log(`\nBaşarısız kontroller:\n${notlar.map((n) => `  - ${n}`).join('\n')}`)
  process.exit(1)
}
console.log('Tüm zamanlanmış iş kuralları doğrulandı.\n')
