// Bir turun MÜŞTERİYE GÖRÜNEN gecikmesini ölçer.
//
// Fatih Bey, 13 Ağustos: "bot yazıyor şeklinde kalıyor, 2 dakika boyunca".
// Gecikme tahmin edilemez, ölçülür: tek çağrı mı uzun sürüyor yoksa düzeltme
// turu mu ikiye katlıyor, ayrı ayrı görünsün diye her aşama damgalanıyor.
//
// Çalıştır: npx tsx scripts/gecikme-olc.ts

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { saglayiciAl, yanitUret } from '../src/lib/motor'
import type { KonusmaMesaji } from '../src/lib/motor/types'

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
envYukle()

/** Fatih Bey'in 13 Ağustos ekranındaki konuşma, birebir. */
const SENARYOLAR: { ad: string; kisi: string; konusma: KonusmaMesaji[] }[] = [
  {
    ad: 'cam filmi → araç (Fatih Bey ekranı)',
    kisi: 'Şükrü',
    konusma: [
      { rol: 'musteri', metin: 'Cam Filmi Kampanyanız hakkında bilgi alabilirmiyim.' },
      {
        rol: 'bot',
        metin:
          'Merhabalar Şükrü bey, hoşgeldiniz.\n' +
          'Cam filmi uygulamamızda XPEL ve Global serilerimiz mevcut.\n' +
          'Aracınızda hangi camları düşünüyorsunuz, ön cam hariç 5 cam komple mi yoksa ön cam dahil tüm camlar mı?',
      },
      { rol: 'musteri', metin: 'Fluence 2011' },
    ],
  },
  {
    ad: 'kısa soru (fiyat yok)',
    kisi: 'Ali',
    konusma: [{ rol: 'musteri', metin: 'Merhaba, bugün açık mısınız?' }],
  },
]

async function main() {
  const saglayici = saglayiciAl()
  saglayici.anahtarKontrolu()
  console.log(`model: ${saglayici.ad} / ${saglayici.model}\n`)

  for (const s of SENARYOLAR) {
    const t0 = Date.now()
    const yanit = await yanitUret({ konusma: s.konusma, kisiAdi: s.kisi }, saglayici)
    const sn = (Date.now() - t0) / 1000

    const isaret = sn > 20 ? '🔴' : sn > 10 ? '🟡' : '✅'
    console.log(`${isaret} ${s.ad}`)
    console.log(
      `   ${sn.toFixed(1)} sn · çıktı ${yanit.kullanim.ciktiJeton} jeton · ` +
        `girdi ${yanit.kullanim.girdiJeton} · önbellekten ${yanit.kullanim.onbellekOkuma ?? 0}`,
    )
    console.log(
      `   ${yanit.yapili.mesajlar.length} baloncuk · ` +
        `fiyat_listesi=${yanit.yapili.fiyat_listesi ?? 'yok'}`,
    )
    console.log(`   ── müşteriye giden ──\n${yanit.yapili.mesajlar.join('\n---\n')}\n`)
  }

  console.log('Ölçüt: müşteri 10 sn üstünü fark eder, 20 sn üstünde bırakır.')
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
