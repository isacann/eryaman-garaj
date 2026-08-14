// Aylık model maliyetini gerçek jeton ölçümüyle hesaplar.
//
// Neden gerekli: maliyet tahmini "herhalde şu kadardır" ile yapılamaz. Sistem
// promptu fiyat listesini içerdiği için büyük, ve her turda konuşma geçmişiyle
// birlikte yeniden gidiyor. Gerçek rakam ancak gerçek çağrı ölçülerek çıkar.
//
// Kullanım:
//   npx tsx scripts/maliyet-olc.ts
//   npx tsx scripts/maliyet-olc.ts --model=gpt-5.4-mini
//
// Senaryolar arşivden alınmış gerçek sohbet kalıplarıdır (bkz. altin-set.json).

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { saglayiciAl, yanitUret } from '../src/lib/motor'
import type { KonusmaMesaji } from '../src/lib/motor/types'

function envYukle(): void {
  const yol = path.join(process.cwd(), '.env.local')
  if (!existsSync(yol)) return
  for (const satir of readFileSync(yol, 'utf8').split(/\r?\n/)) {
    const temiz = satir.trim()
    if (!temiz || temiz.startsWith('#')) continue
    const i = temiz.indexOf('=')
    if (i === -1) continue
    const ad = temiz.slice(0, i).trim()
    if (!process.env[ad]) process.env[ad] = temiz.slice(i + 1).trim()
  }
}
envYukle()

/** $/1M jeton. Kaynak: developers.openai.com/api/docs/pricing (11 Ağustos 2026). */
const FIYATLAR: Record<string, { girdi: number; onbellek: number; cikti: number }> = {
  'gpt-5.6-terra': { girdi: 2.0, onbellek: 0.2, cikti: 12.0 },
  'gpt-5.6-sol': { girdi: 5.0, onbellek: 0.5, cikti: 30.0 },
  'gpt-5.6-luna': { girdi: 0.2, onbellek: 0.02, cikti: 1.2 },
  'gpt-5.5': { girdi: 5.0, onbellek: 0.5, cikti: 30.0 },
  'gpt-5.4': { girdi: 2.5, onbellek: 0.25, cikti: 15.0 },
  'gpt-5.4-mini': { girdi: 0.75, onbellek: 0.075, cikti: 4.5 },
  'gpt-5.4-nano': { girdi: 0.15, onbellek: 0.015, cikti: 0.9 },
  // Anthropic. Sonnet 5 liste fiyatı $3/$15; 31 Ağustos 2026'ya kadar tanıtım
  // fiyatı $2/$10 geçerli — aşağıdaki rakam tanıtım fiyatıdır, 1 Eylül'de
  // liste fiyatına dönecek (aylık maliyet ~%50 artar).
  'claude-sonnet-5': { girdi: 2.0, onbellek: 0.2, cikti: 10.0 },
  'claude-opus-4-8': { girdi: 5.0, onbellek: 0.5, cikti: 25.0 },
  'claude-haiku-4-5': { girdi: 1.0, onbellek: 0.1, cikti: 5.0 },
}

/** Arşivdeki gerçek sohbet kalıpları: kısa soru, fiyat sorgusu, uzun pazarlık. */
const SENARYOLAR: { ad: string; kisi?: string; mesajlar: string[] }[] = [
  {
    ad: 'kısa soru (tek tur)',
    mesajlar: ['Merhaba, açık mısınız?'],
  },
  {
    ad: 'cam filmi fiyat (3 tur)',
    kisi: 'İbrahim',
    mesajlar: ['Cam filmi fiyatı nedir', 'Passat 2020', 'Ön cam hariç'],
  },
  {
    ad: 'PPF fiyat + itiraz (5 tur)',
    kisi: 'Kerim',
    mesajlar: [
      'Merhabalar ppf kaplama yaptırmak istiyorum',
      'Bmw 320i 2022',
      'Komple düşünüyorum',
      'Biraz pahalı geldi açıkçası',
      'İndirim yapabilir misiniz',
    ],
  },
  {
    ad: 'randevu kapanışı (6 tur)',
    kisi: 'Tuğçe',
    mesajlar: [
      'Selam',
      'Aracıma seramik kaplama yaptırmak istiyorum',
      'Togg T10X',
      'Fiyat ne kadar olur',
      'Tamam uygun, ne zaman gelebilirim',
      'Cumartesi öğleden sonra olur mu',
    ],
  },
]

/** Arşiv ölçüsü: 781 gerçek yazışmada 2.644 müşteri mesajı. */
const TUR_BASINA_ORTALAMA_KAYNAK = '2.644 müşteri mesajı / 781 gerçek sohbet'

async function main() {
  const modelBayragi = process.argv.find((a) => a.startsWith('--model='))
  const modelEzme = modelBayragi ? modelBayragi.slice('--model='.length) : undefined

  const saglayici = saglayiciAl(undefined, modelEzme)
  saglayici.anahtarKontrolu()

  const model = saglayici.model
  const tarife = FIYATLAR[model]
  if (!tarife) {
    console.error(`"${model}" için tarife tanımlı değil. FIYATLAR tablosuna ekle.`)
    process.exit(1)
  }

  console.log(`Model: ${model}`)
  console.log(
    `Tarife ($/1M): girdi ${tarife.girdi} · önbellekli girdi ${tarife.onbellek} · çıktı ${tarife.cikti}\n`,
  )

  let toplamGirdi = 0
  let toplamCikti = 0
  let toplamOkuma = 0
  let toplamYazma = 0
  let toplamTur = 0

  for (const senaryo of SENARYOLAR) {
    const konusma: KonusmaMesaji[] = []
    let sGirdi = 0
    let sCikti = 0
    let sOkuma = 0
    let sYazma = 0

    for (const metin of senaryo.mesajlar) {
      konusma.push({ rol: 'musteri', metin })
      // ⚠ Üretim yolu: yanitUret düzeltme turunu da koşar. Doğrudan
      // saglayici.yanitla çağırmak maliyeti olduğundan AZ gösterirdi.
      const yanit = await yanitUret(
        { konusma, kisiAdi: senaryo.kisi, simdi: new Date() },
        saglayici,
      )
      konusma.push({ rol: 'bot', metin: yanit.metin })
      sGirdi += yanit.kullanim.girdiJeton
      sCikti += yanit.kullanim.ciktiJeton
      sOkuma += yanit.kullanim.onbellekOkuma ?? 0
      sYazma += yanit.kullanim.onbellekYazma ?? 0
    }

    const tur = senaryo.mesajlar.length
    toplamGirdi += sGirdi
    toplamCikti += sCikti
    toplamOkuma += sOkuma
    toplamYazma += sYazma
    toplamTur += tur

    console.log(
      `${senaryo.ad.padEnd(26)} ${String(tur).padStart(2)} tur · ` +
        `girdi ${String(sGirdi).padStart(6)} · çıktı ${String(sCikti).padStart(5)} · ` +
        `önbellekten ${String(sOkuma).padStart(6)}`,
    )
  }

  // ⚠ Sağlayıcılar önbellekli jetonu farklı sayıyor:
  //   Anthropic: input_tokens önbelleği İÇERMEZ, ayrı alanlarda gelir.
  //   OpenAI:    prompt_tokens önbelleği İÇERİR, düşmek gerekir.
  const openaiMi = saglayici.ad === 'openai'
  const tamGirdi = openaiMi ? toplamGirdi : toplamGirdi + toplamOkuma + toplamYazma
  const tamFiyatliGirdi = openaiMi ? toplamGirdi - toplamOkuma : toplamGirdi

  const turGirdi = tamGirdi / toplamTur
  const turCikti = toplamCikti / toplamTur
  const hitOrani = tamGirdi ? toplamOkuma / tamGirdi : 0

  // Gerçek maliyet: ölçülen önbellek dağılımıyla.
  // Anthropic 1 saatlik TTL'de önbelleğe YAZMA 2× ücretli, o da sayılıyor.
  const yazmaCarpani = openaiMi ? 0 : 2
  const gercekToplam =
    (tamFiyatliGirdi * tarife.girdi +
      toplamOkuma * tarife.onbellek +
      toplamYazma * tarife.girdi * yazmaCarpani +
      toplamCikti * tarife.cikti) /
    1_000_000
  const turMaliyetGercek = gercekToplam / toplamTur

  const turMaliyet = (turGirdi * tarife.girdi + turCikti * tarife.cikti) / 1_000_000
  const turMaliyetOnbellek =
    (turGirdi * tarife.onbellek + turCikti * tarife.cikti) / 1_000_000

  console.log(`\nÖlçüm: ${toplamTur} tur · ${TUR_BASINA_ORTALAMA_KAYNAK}`)
  console.log(
    `Tur başına ortalama: girdi ${Math.round(turGirdi)} jeton · çıktı ${Math.round(turCikti)} jeton`,
  )
  console.log(
    `Önbellek: okunan ${toplamOkuma} · yazılan ${toplamYazma} jeton · ` +
      `HİT ORANI %${(hitOrani * 100).toFixed(1)}`,
  )
  console.log(
    `Tur başına maliyet: $${turMaliyetGercek.toFixed(5)} (ÖLÇÜLEN) · ` +
      `$${turMaliyet.toFixed(5)} (önbelleksiz olsaydı) · ` +
      `$${turMaliyetOnbellek.toFixed(5)} (tam önbellekli)`,
  )

  // Aylık: arşivden ölçülen müşteri mesajı hacmi.
  const HACIMLER = [
    { ad: 'Temmuz 2026 (WhatsApp ölçülen)', adet: 893 },
    { ad: 'Ağustos trendi (WhatsApp)', adet: 1100 },
    { ad: '+ Instagram dahil (tahmini)', adet: 1400 },
    { ad: 'iki katına çıkarsa', adet: 2800 },
  ]

  const KUR = 47.7 // ₺/$ — 11 Ağustos 2026
  console.log('\nAylık maliyet (ÖLÇÜLEN önbellek dağılımıyla):')
  for (const h of HACIMLER) {
    const usd = h.adet * turMaliyetGercek
    console.log(
      `  ${h.ad.padEnd(32)} ${String(h.adet).padStart(5)} tur/ay · ` +
        `$${usd.toFixed(2)} ≈ ${Math.round(usd * KUR).toLocaleString('tr-TR')}₺ ` +
        `(önbelleksiz olsaydı $${(h.adet * turMaliyet).toFixed(2)})`,
    )
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
