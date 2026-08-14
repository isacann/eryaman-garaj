// 🆓 BAKİYE GEREKMEZ (sahte sağlayıcı) — parçalı mesajda TEK cevap sınavı.
//
// Koş: npm run parcali:dogrula
//
// NEDEN VAR — 14 Ağustos 2026, sahada yakalandı: müşteri arka arkaya iki mesaj
// yazınca ("Merhaba hocam" + "PPF fiyatınız nedir") bot iki ayrı tur açıyor ve
// müşteri iki kez selamlanıyordu. Gerçek konuşmadan:
//
//   18:30:30  bot  Merhabalar Tayyar Aydın bey, hoşgeldiniz.
//   18:30:36  bot  Merhabalar Tayyar Aydın bey, hoşgeldiniz.   ← ikinci tur
//
// Bu sınav aynı yarışı kurar: iki mesaj kısa aralıkla gelir, iki webhook turu
// paralel başlar. Beklenen davranış — ilk tur çekilir, ikinci tur ikisini
// birden görüp TEK cevap yazar.

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

function envYukle(): void {
  const yol = path.join(process.cwd(), '.env.local')
  if (!existsSync(yol)) return
  for (const satir of readFileSync(yol, 'utf8').split(/\r?\n/)) {
    const t = satir.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i > 0 && !process.env[t.slice(0, i).trim()]) {
      process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
    }
  }
}

async function main() {
  envYukle()
  // Model çağrısı yok: sahte sağlayıcı yeterli, sınanan şey tur sayısı.
  process.env.MOTOR_SAGLAYICI = 'sahte'
  // Gerçek 12 saniye beklemek sınavı yavaşlatır; yarış aynı kalır.
  process.env.MOTOR_YERLESME_MS = '2500'

  const { gelenleriIsle } = await import('../src/lib/gelen-tur')
  const { supabaseServis } = await import('../src/lib/supabase/sunucu')
  const db = supabaseServis()

  const kimlik = `parcali-sinav-${Date.now()}`
  const mesajYap = (metin: string, sira: number) => ({
    kanal: 'test' as const,
    kanalKimlik: kimlik,
    ad: 'Tayyar',
    metin,
    medyaUrl: null,
    hariciId: `${kimlik}-${sira}`,
    reklam: null,
    zaman: new Date().toISOString(),
    ham: {},
  })

  console.log('\nParçalı mesaj — tek cevap sınavı')
  console.log('─'.repeat(72))
  console.log('Müşteri iki mesajı 1 saniye arayla yazıyor, iki webhook turu paralel başlıyor.\n')

  // İki tur, gerçek webhook'taki gibi bağımsız ve eşzamanlı.
  const tur1 = gelenleriIsle('sinav', [mesajYap('Merhaba hocam', 1)])
  await new Promise((r) => setTimeout(r, 1000))
  const tur2 = gelenleriIsle('sinav', [mesajYap('PPF fiyatınız nedir', 2)])
  await Promise.all([tur1, tur2])

  // Konuşma kanal kimliğinden bulunur: "en son test konuşması" demek eski
  // sınavların artığını yakalayabiliyor.
  const { data: kisi } = await db
    .from('contacts')
    .select('id')
    .eq('kanal', 'test')
    .eq('kanal_kimlik', kimlik)
    .maybeSingle()

  const { data: konusma } = await db
    .from('conversations')
    .select('id, contact_id')
    .eq('contact_id', kisi?.id ?? '')
    .maybeSingle()

  const { data: mesajlar } = await db
    .from('messages')
    .select('gonderen, metin, meta, created_at')
    .eq('conversation_id', konusma?.id ?? '')
    .order('created_at', { ascending: true })

  for (const m of mesajlar ?? []) {
    console.log(`  ${m.gonderen.padEnd(8)} ${(m.metin ?? '').slice(0, 70).replace(/\n/g, ' / ')}`)
  }

  const musteri = (mesajlar ?? []).filter((m) => m.gonderen === 'musteri').length

  // ⚠ Ölçüt "kaç selamlama" DEĞİL, "kaç bot TURU". Bir tur birden çok baloncuk
  // gönderiyor ve sahte sağlayıcı her baloncukta selamlıyor; selamlama saymak
  // yanlış alarm veriyordu. bot.ts her turun YALNIZCA ilk mesajına yapılandırılmış
  // çıktıyı iliştiriyor, dolayısıyla `meta.yapili` olan bot mesajı sayısı = tur sayısı.
  const turlar = (mesajlar ?? []).filter(
    (m) => m.gonderen === 'bot' && (m.meta as { yapili?: unknown } | null)?.yapili,
  ).length

  const kontroller = [
    {
      ad: 'Her iki müşteri mesajı da aynı konuşmaya kaydedildi',
      gecti: musteri === 2,
      detay: `${musteri} müşteri mesajı`,
    },
    {
      ad: 'Bot TEK tur çalıştı (çift cevap yok)',
      gecti: turlar === 1,
      detay: `${turlar} tur — 2 ise sahadaki kusur geri gelmiş, 0 ise bot hiç cevaplamamış`,
    },
  ]

  console.log('')
  for (const k of kontroller) {
    console.log(`${k.gecti ? '✓' : '✗'} ${k.ad}`)
    console.log(`    ${k.detay}`)
  }

  // Temizlik: sınav verisi gerçek tablolarda kalmasın.
  if (konusma) {
    await db.from('conversations').delete().eq('id', konusma.id)
    await db.from('contacts').delete().eq('id', konusma.contact_id)
  }

  const gecen = kontroller.filter((k) => k.gecti).length
  console.log('─'.repeat(72))
  console.log(`\n${gecen}/${kontroller.length} kontrol geçti (sınav verisi temizlendi)\n`)
  if (gecen < kontroller.length) process.exit(1)
}

void main()
