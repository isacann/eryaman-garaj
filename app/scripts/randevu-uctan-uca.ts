// 💰 MODEL ÇAĞIRIR (~$0,05) — randevu akışının GERÇEK yoldan sınavı.
//
// Koş: npx tsx scripts/randevu-uctan-uca.ts
//
// NEDEN AYRI: `sohbet.ts` yalnızca motoru çağırıyor, veritabanına yazmıyor.
// Randevunun asıl işi motordan SONRA oluyor — `botCevapla` kaydı açıyor,
// hatırlatmayı kuyruğa koyuyor. CLAUDE.md'deki ders bu: "yeni bir motor kuralı
// eklerken kontrol et, sınav gerçek yoldan mı geçiyor?" Buradaki akış üretimde
// webhook'un izlediği yolun aynısı.
//
// Test kanalı kullanılır ('test'): dışarı mesaj GİTMEZ, kayıtlar gerçek tablolara
// yazılır ve sonunda temizlenir.

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

const SENARYO = [
  'merhaba komple ppf fiyatı nedir',
  'xtreme olsun, aracımı ne zaman getirebilirim',
  'yarın saat 15te getireyim',
]

async function main() {
  envYukle()

  const { supabaseServis } = await import('../src/lib/supabase/sunucu')
  const { gelenMesajiKaydet } = await import('../src/lib/mesajlar')
  const { botCevapla } = await import('../src/lib/bot')

  const db = supabaseServis()
  const kimlik = `randevu-sinav-${Date.now()}`
  let konusmaId = ''

  console.log('\nRandevu akışı — uçtan uca (gerçek yol: gelenMesajiKaydet → botCevapla)\n')
  console.log('─'.repeat(72))

  for (const [i, metin] of SENARYO.entries()) {
    const sonuc = await gelenMesajiKaydet({
      kanal: 'test',
      kanalKimlik: kimlik,
      ad: 'Mustafa',
      metin,
      medyaUrl: null,
      hariciId: `${kimlik}-${i}`,
      reklam: null,
      zaman: new Date().toISOString(),
      ham: {},
    })
    konusmaId = sonuc.konusmaId

    console.log(`\n[MÜŞTERİ] ${metin}`)
    const cevap = await botCevapla(konusmaId)
    if (!cevap.tamam) {
      console.log(`  ✗ bot cevaplamadı: ${cevap.sebep} ${cevap.mesaj ?? ''}`)
      continue
    }
    for (const m of cevap.yapili?.mesajlar ?? []) console.log(`[BOT] ${m}`)
    const y = cevap.yapili
    if (y?.randevu_talebi || y?.randevu_zaman) {
      console.log(
        `      📅 talep="${y?.randevu_talebi ?? '-'}" zaman=${y?.randevu_zaman ?? 'BOŞ'}`,
      )
    }
  }

  // ---- Sonuç: kayıt ve hatırlatma gerçekten oluştu mu ----
  console.log('\n' + '─'.repeat(72))
  console.log('\nVeritabanı durumu\n')

  const { data: randevu } = await db
    .from('appointment_requests')
    .select('istenen_zaman_metin, randevu_at, durum, hizmet')
    .eq('conversation_id', konusmaId)
    .maybeSingle()

  const { data: hatirlatma } = await db
    .from('followups')
    .select('basamak, planlanan_at, durum')
    .eq('conversation_id', konusmaId)
    .eq('basamak', 'randevu-hatirlatma')
    .maybeSingle()

  const kontroller: { ad: string; gecti: boolean; detay: string }[] = [
    {
      ad: 'Randevu kaydı açıldı',
      gecti: Boolean(randevu),
      detay: randevu ? `hizmet: ${randevu.hizmet ?? '-'}` : 'kayıt yok',
    },
    {
      ad: 'Ekip onayı beklenmiyor (durum=onaylandi)',
      gecti: randevu?.durum === 'onaylandi',
      detay: `durum: ${randevu?.durum ?? '-'}`,
    },
    {
      ad: 'Kesin zaman çözümlendi',
      gecti: Boolean(randevu?.randevu_at),
      detay: randevu?.randevu_at
        ? new Intl.DateTimeFormat('tr-TR', {
            timeZone: 'Europe/Istanbul',
            dateStyle: 'full',
            timeStyle: 'short',
          }).format(new Date(randevu.randevu_at))
        : 'randevu_at BOŞ — hatırlatma kurulamaz',
    },
    {
      ad: 'Hatırlatma kuyruğa girdi',
      gecti: hatirlatma?.durum === 'beklemede',
      detay: hatirlatma
        ? `${hatirlatma.durum} · ${new Intl.DateTimeFormat('tr-TR', {
            timeZone: 'Europe/Istanbul',
            dateStyle: 'full',
            timeStyle: 'short',
          }).format(new Date(hatirlatma.planlanan_at))}`
        : 'kuyrukta satır yok',
    },
  ]

  for (const k of kontroller) {
    console.log(`${k.gecti ? '✓' : '✗'} ${k.ad}`)
    console.log(`    ${k.detay}`)
  }

  // Hatırlatma randevudan ÖNCE ve anlamlı bir mesafede olmalı.
  //
  // Sabit "24 saat" beklenmiyor: kademeli seçim (bkz. lib/randevu.ts) randevuya
  // 24 saatten az kaldığında sabaha, o da geçmişse 2 saat öncesine kayıyor.
  // Sahadaki en sık senaryo ("bugün yazıp yarın getireyim") tam bu durumda.
  if (randevu?.randevu_at && hatirlatma) {
    const fark =
      (new Date(randevu.randevu_at).getTime() - new Date(hatirlatma.planlanan_at).getTime()) /
      3_600_000
    const dogru = fark >= 2 && fark <= 25
    kontroller.push({
      ad: 'Hatırlatma randevudan önce ve makul aralıkta',
      gecti: dogru,
      detay: `${fark.toFixed(1)} saat önce`,
    })
    console.log(`${dogru ? '✓' : '✗'} Hatırlatma randevudan önce ve makul aralıkta`)
    console.log(`    ${fark.toFixed(1)} saat önce`)
  }

  // Temizlik: sınav verisi gerçek tablolarda kalmasın.
  const { data: konusma } = await db
    .from('conversations')
    .select('contact_id')
    .eq('id', konusmaId)
    .maybeSingle()
  await db.from('conversations').delete().eq('id', konusmaId)
  if (konusma) await db.from('contacts').delete().eq('id', konusma.contact_id)

  const gecen = kontroller.filter((k) => k.gecti).length
  console.log('\n' + '─'.repeat(72))
  console.log(`\n${gecen}/${kontroller.length} kontrol geçti (sınav verisi temizlendi)\n`)
  if (gecen < kontroller.length) process.exit(1)
}

void main()
