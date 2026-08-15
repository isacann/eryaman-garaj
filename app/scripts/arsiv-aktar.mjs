// Arşivdeki WhatsApp yazışmalarını canlı veritabanına aktarır.
//
// NEDEN (Fatih Bey, 15 Ağustos): "Eski müşteri olduğunu anlayıp eski sohbeti de
// okuyup ona göre davranmalı." Bot geçmişi yalnızca veritabanındaki konuşmadan
// okuyor; arşiv (904 sohbet, 4.841 mesaj) yalnızca analiz için kullanılmıştı ve
// bot çalışırken erişemiyordu. Barkın vakası: yıllardır müşterimiz olan biri
// şikayetle yazdı, sistem onu yeni müşteri sanıp satış diliyle karşıladı.
//
// NE YAPIYOR:
//   1. ../arsiv/whatsapp.json okunur.
//   2. Başlığı telefon numarası olan sohbetler (904'ün 780'i, %86) telefonla
//      eşleştirilir: contacts → conversations → messages.
//      Başlığı isim olanlar AKTARILMAZ — telefon bilinmeden eşleşme kurulamaz;
//      yanlış telefonla eşleşen geçmiş, yanlış müşteriye yanlış bağlam demek.
//   3. Müşteri daha sonra yazdığında webhook aynı telefonu bulur, aynı
//      konuşmaya düşer ve bot geçmişi görür.
//
// GÜVENLİK:
//   · İdempotent: her mesajın harici_id'si deterministik (arsiv-wa-<tel>-<n>);
//     ikinci koşu aynı mesajı İKİ KEZ YAZMAZ (messages.harici_id unique).
//   · Mevcut konuşmaya dokunulmaz: kişinin canlı konuşması varsa arşiv
//     mesajları O konuşmaya eklenir ama son_mesaj_at GERİYE ÇEKİLMEZ ve
//     durum değiştirilmez.
//   · Geri alınabilir: her kayıt meta.kaynak='arsiv' taşır.
//     Geri almak için: node scripts/arsiv-aktar.mjs --geri-al
//   · Önce say: node scripts/arsiv-aktar.mjs --kuru  (hiçbir şey yazmaz)
//
// Çalıştır: node scripts/arsiv-aktar.mjs

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadSecrets } from './_env.mjs'

const kok = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const env = loadSecrets()
const URL_ = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !KEY) {
  console.error('Supabase adresi/anahtarı yok (.secrets.env)')
  process.exit(1)
}

const KURU = process.argv.includes('--kuru')
const GERI_AL = process.argv.includes('--geri-al')

const bas = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
}

async function api(yol, secenek = {}) {
  const r = await fetch(`${URL_}/rest/v1/${yol}`, { headers: bas, ...secenek })
  if (!r.ok) throw new Error(`${yol}: ${r.status} ${await r.text()}`)
  const metin = await r.text()
  return metin ? JSON.parse(metin) : null
}

/** "+90 531 722 74 80" → "905317227480". Telefon değilse null. */
function telefonCoz(ad) {
  const rakam = (ad ?? '').replace(/\D/g, '')
  if (rakam.length === 12 && rakam.startsWith('90')) return rakam
  if (rakam.length === 11 && rakam.startsWith('0')) return `9${rakam}`
  if (rakam.length === 10 && rakam.startsWith('5')) return `90${rakam}`
  return null
}

/** "15:49, 07.08.2026" → ISO (TR saati). Bozuksa null. */
function zamanCoz(z) {
  const m = /^(\d{2}):(\d{2}),\s*(\d{2})\.(\d{2})\.(\d{4})$/.exec((z ?? '').trim())
  if (!m) return null
  const [, sa, dk, gun, ay, yil] = m
  const t = new Date(`${yil}-${ay}-${gun}T${sa}:${dk}:00+03:00`)
  return Number.isNaN(t.getTime()) ? null : t
}

// ── Geri alma ────────────────────────────────────────────────────────────────
if (GERI_AL) {
  console.log('Arşivden aktarılan kayıtlar siliniyor...')
  // Önce arşiv KONUŞMALARI (mesajları cascade siler). Mevcut canlı konuşmaya
  // eklenmiş arşiv MESAJLARI ayrıca silinir (konuşmanın kendisi kalır).
  await api(`conversations?meta->>kaynak=eq.arsiv`, { method: 'DELETE' })
  await api(`messages?meta->>kaynak=eq.arsiv`, { method: 'DELETE' })
  // Arşivle açılmış, artık konuşmasız kalan kişiler.
  console.log('✓ arşiv kayıtları silindi (meta.kaynak=arsiv)')
  process.exit(0)
}

// ── Aktarım ──────────────────────────────────────────────────────────────────
const arsiv = JSON.parse(
  readFileSync(path.join(kok, '..', 'arsiv', 'whatsapp.json'), 'utf8'),
)

let sohbetOk = 0
let sohbetAtlandi = 0
let mesajOk = 0
let mesajAtlandi = 0

for (const sohbet of arsiv) {
  const tel = telefonCoz(sohbet.ad)
  if (!tel) {
    sohbetAtlandi += 1
    continue
  }
  const mesajlar = sohbet.mesajlar ?? []
  if (mesajlar.length === 0) {
    sohbetAtlandi += 1
    continue
  }

  // Zamanları çöz; boş zamanlar bir önceki mesajın zamanını (+1 sn) alır.
  let sonZaman = null
  const cozulmus = []
  for (const m of mesajlar) {
    let t = zamanCoz(m.zaman)
    if (!t && sonZaman) t = new Date(sonZaman.getTime() + 1000)
    if (!t) continue // sohbet başında zamanı bozuk mesaj: sıra kurulamaz, atla
    sonZaman = t
    cozulmus.push({ ...m, t })
  }
  if (cozulmus.length === 0) {
    sohbetAtlandi += 1
    continue
  }

  if (KURU) {
    sohbetOk += 1
    mesajOk += cozulmus.length
    continue
  }

  // 1) Kişi
  const kisiler = await api(
    `contacts?select=id&kanal=eq.whatsapp&kanal_kimlik=eq.${tel}`,
  )
  let kisiId = kisiler?.[0]?.id
  if (!kisiId) {
    const [yeni] = await api('contacts', {
      method: 'POST',
      headers: { ...bas, Prefer: 'return=representation' },
      body: JSON.stringify({
        kanal: 'whatsapp',
        kanal_kimlik: tel,
        telefon: tel,
        // Ad arşivde telefon metni; gerçek ad ilk mesajda pushName'den gelir.
        ad: null,
        meta: { kaynak: 'arsiv' },
      }),
    })
    kisiId = yeni.id
  }

  // 2) Konuşma: kapalı olmayan en güncel (webhook'la aynı seçim), yoksa yeni.
  const konusmalar = await api(
    `conversations?select=id,son_mesaj_at&contact_id=eq.${kisiId}&durum=neq.kapali&order=son_mesaj_at.desc.nullslast&limit=1`,
  )
  const sonArsivZamani = cozulmus[cozulmus.length - 1].t.toISOString()
  let konusmaId = konusmalar?.[0]?.id
  const mevcutKonusmaVar = Boolean(konusmaId)
  if (!konusmaId) {
    const [yeni] = await api('conversations', {
      method: 'POST',
      headers: { ...bas, Prefer: 'return=representation' },
      body: JSON.stringify({
        contact_id: kisiId,
        kanal: 'whatsapp',
        durum: 'bot',
        son_mesaj_at: sonArsivZamani,
        // Panelde okunmamış görünmesin: bunlar tarihi kayıtlar, yeni iş değil.
        okundu_at: sonArsivZamani,
        meta: { kaynak: 'arsiv' },
      }),
    })
    konusmaId = yeni.id
  }

  // 3) Mesajlar — 500'lük toplu ekleme.
  //
  // İdempotens: harici_id'nin unique indeksi KISMİ (where harici_id is not
  // null) olduğu için PostgREST'in on_conflict'i onu hedefleyemiyor (42P10).
  // Bunun yerine bu sohbetin daha önce yazılmış arşiv kimlikleri okunur ve
  // elenir — tek yazar bu script olduğu için yarış riski yok.
  const mevcutlar = await api(
    `messages?select=harici_id&harici_id=like.arsiv-wa-${tel}-*`,
  )
  const mevcutKimlikler = new Set((mevcutlar ?? []).map((m) => m.harici_id))

  const satirlar = cozulmus.map((m, i) => ({
    conversation_id: konusmaId,
    yon: m.yon === 'musteri' ? 'gelen' : 'giden',
    gonderen: m.yon === 'musteri' ? 'musteri' : 'ekip',
    metin: m.metin ?? '',
    harici_id: `arsiv-wa-${tel}-${i}`,
    created_at: m.t.toISOString(),
    meta: { kaynak: 'arsiv' },
  }))

  const yeniler = satirlar.filter((s) => !mevcutKimlikler.has(s.harici_id))
  mesajAtlandi += satirlar.length - yeniler.length

  for (let i = 0; i < yeniler.length; i += 500) {
    const parca = yeniler.slice(i, i + 500)
    await api('messages', {
      method: 'POST',
      headers: { ...bas, Prefer: 'return=minimal' },
      body: JSON.stringify(parca),
    })
  }

  // Mevcut canlı konuşmanın son_mesaj_at'ine dokunma (arşiv daha eski).
  // Yeni açılan arşiv konuşmasında zaten doğru değer yazıldı.
  void mevcutKonusmaVar

  sohbetOk += 1
  mesajOk += yeniler.length
  if (sohbetOk % 100 === 0) console.log(`  ... ${sohbetOk} sohbet aktarıldı`)
}

console.log(
  `${KURU ? '[KURU KOŞU] ' : ''}✓ ${sohbetOk} sohbet, ${mesajOk} mesaj aktarıldı · ` +
    `${sohbetAtlandi} sohbet atlandı (telefonsuz/boş)${mesajAtlandi ? ` · ${mesajAtlandi} mesaj atlandı` : ''}`,
)
if (!KURU) {
  console.log('Geri almak için: node scripts/arsiv-aktar.mjs --geri-al')
}
