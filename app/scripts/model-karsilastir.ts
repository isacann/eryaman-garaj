// GPT mi Claude mu? — tek komutla cevap.
//
// İki modeli AYNI vakalarla, AYNI tekrar sayısıyla koşturur ve yan yana koyar:
//   · Fatih Bey'in her şikâyeti için kaç koşuda kurala uyuldu
//   · tur başına gerçek jeton ve maliyet
//   · önbellek tuttu mu (Anthropic'te cache_read)
//
// Kullanım (bakiye gerekir — iki sağlayıcıda da):
//   npx tsx scripts/model-karsilastir.ts                  (3 tekrar)
//   npx tsx scripts/model-karsilastir.ts --tekrar=5
//   npx tsx scripts/model-karsilastir.ts --sadece=anthropic
//
// Maliyet uyarısı: 6 vaka × 3 tekrar × 2 model ≈ 36 tur.
// Tahmini: mini ~$0,31 · Sonnet ~$1,66 (önbelleksiz) — koşmadan önce göz at.

import { saglayiciAl, yanitUret } from '../src/lib/motor'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
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

const argv = process.argv.slice(2)
const tekrarBayrak = argv.find((a) => a.startsWith('--tekrar='))
const TEKRAR = tekrarBayrak ? Number(tekrarBayrak.slice(9)) : 3
const sadeceBayrak = argv.find((a) => a.startsWith('--sadece='))
const SADECE = sadeceBayrak ? sadeceBayrak.slice(9) : null

/** $/1M jeton — developers.openai.com + anthropic pricing, 12 Ağustos 2026. */
const TARIFE: Record<string, { girdi: number; onbellek: number; cikti: number }> = {
  'gpt-5.4-mini': { girdi: 0.75, onbellek: 0.075, cikti: 4.5 },
  'claude-sonnet-5': { girdi: 2.0, onbellek: 0.2, cikti: 10.0 },
}

const YARISMACILAR = [
  { ad: 'gpt-5.4-mini', saglayici: 'openai' },
  { ad: 'claude-sonnet-5', saglayici: 'anthropic' },
].filter((y) => !SADECE || y.saglayici === SADECE)

type Kontrol = { ad: string; gec: (metin: string, mesajlar: string[]) => boolean }

type Vaka = {
  ad: string
  sikayet: string
  konusma: KonusmaMesaji[]
  isim?: string
  kontroller: Kontrol[]
}

const SELAM = /(merhabalar|merhaba|hoşgeldin|hoş geldin|selam)/i

const VAKALAR: Vaka[] = [
  {
    ad: 'mat-kisiti',
    sikayet: '"yalnızca komple yapıyoruz demesine gerek yok"',
    isim: 'Enis',
    konusma: [{ rol: 'musteri', metin: 'T10F oltu mat ppf ve kromlar siyah kaplanacak' }],
    kontroller: [
      {
        ad: 'gereksiz kısıt cümlesi yok',
        gec: (m) =>
          !/(yalnızca|sadece)[^.\n]{0,20}komple[^.\n]{0,30}(yapıl|uygulan)/i.test(m),
      },
      { ad: 'ilk cevapta selam + isim', gec: (_m, ms) => SELAM.test(ms[0] ?? '') && /enis/i.test(ms[0] ?? '') },
    ],
  },
  {
    ad: 'randevu-telefon',
    sikayet: '"iletişim numarasını istesin" + aracı tekrar sorma',
    konusma: [
      { rol: 'musteri', metin: 'Bmw G20 komple ppf fiyatı nedir' },
      { rol: 'bot', metin: 'Komple PPF: XPEL Xtreme 100.000₺, Global PPF 75.000₺.' },
      { rol: 'musteri', metin: 'Peki yarın için boşlugunuz var mı' },
    ],
    kontroller: [
      { ad: 'telefon istedi', gec: (m) => /numara|telefon/i.test(m) },
      { ad: 'dönüş sözü verdi', gec: (m) => /dönüş|ulaşalım|döneriz/i.test(m) },
      {
        ad: 'aracı tekrar sormadı',
        gec: (m) => !/marka.{0,15}model|aracınız(ın|ı)?\s*(ne|hangi|da|de)\b|model\s*yılı/i.test(m),
      },
    ],
  },
  {
    ad: 'kompleye-kismi',
    sikayet: '"komple olana 4 parça sunuyor"',
    konusma: [
      { rol: 'musteri', metin: 'Bmw G20 komple ppf düşünüyorum' },
      { rol: 'bot', metin: 'Komple kaplamada XPEL Xtreme 100.000₺, Global PPF 75.000₺.' },
      { rol: 'musteri', metin: 'Global serisi için öneriniz nedir' },
    ],
    kontroller: [
      {
        ad: 'kısmi seçenek sunmadı',
        gec: (m) => !/(kaput|ön\s*3|ön\s*4)[^.\n]{0,70}(yönlendir|paylaş|sun|ilet)/i.test(m),
      },
    ],
  },
  {
    ad: 'ton-insan-gibi',
    sikayet: '"GPT\'de cidden karşısında insan var gibi"',
    isim: 'Furkan',
    konusma: [
      {
        rol: 'musteri',
        metin:
          'Aracım yarın bayiden çıkıyor komple ppf kapatmayı düşünüyorum fiyatlariniz ne durumda hangi ürünleri kullanıyorsunuz',
      },
    ],
    kontroller: [
      {
        ad: 'kuru kalıpla açmadı',
        gec: (_m, ms) =>
          !/^(tamamdır|tabi+|peki)[^.!?]{0,70}(yönlendiriyorum|paylaşıyorum)[.!]?$/i.test(
            (ms[0] ?? '').trim(),
          ),
      },
      {
        ad: 'duruma özel cümle kurdu',
        gec: (m) => /hayırlı olsun|ideal zaman|teslim alınır alınmaz|ilk kilometre/i.test(m),
      },
      { ad: 'ürünleri özellikleriyle yazdı', gec: (m) => /mikron|tpu|self[- ]?healing/i.test(m) },
      {
        ad: 'ucuz seriye üst seri özelliği yazmadı',
        gec: (_m, ms) => {
          let aktif: 'ucuz' | 'ust' | null = null
          for (const s of ms.flatMap((x) => x.split('\n'))) {
            if (/ultimate|fusion|stealth|mat\b/i.test(s)) aktif = 'ust'
            else if (/xtreme|exo\s*armor|global/i.test(s)) aktif = 'ucuz'
            if (aktif === 'ucuz' && /self[- ]?healing|%\s*100\s*tpu|hidrofobik/i.test(s)) return false
          }
          return true
        },
      },
    ],
  },
  {
    ad: 'kismi-mat-yapilmiyor',
    sikayet: '11 Ağustos: kısmi mat YAPILMIYOR, devretmeden net söyle',
    konusma: [{ rol: 'musteri', metin: 'Kaputa mat ppf yaptırmak istiyorum fiyatı nedir' }],
    kontroller: [
      {
        ad: 'yapılmadığını söyledi',
        gec: (m) =>
          /(sadece|yalnızca)[^.\n]{0,30}komple|kısmi[^.\n]{0,40}(yapmıyoruz|yapılmıyor|bulunmuyor)/i.test(
            m,
          ),
      },
      { ad: 'rakam uydurmadı', gec: (m) => !/45\.000|55\.000|65\.000/.test(m) },
    ],
  },
  {
    ad: 'on-2-cam-eklemesin',
    sikayet: '"5 cam demiş, ayrıca ön 2 cam fiyatı vermesine gerek yok"',
    isim: 'Halim',
    konusma: [
      { rol: 'musteri', metin: 'Cam Filmi Kampanyanız hakkında bilgi alabilirmiyim' },
      { rol: 'bot', metin: 'Merhabalar Halim bey, hoşgeldiniz. Aracınız ve kaç cam?' },
      { rol: 'musteri', metin: 'Ön hariç hepsi civic fc5 arka kelebeklerde var' },
    ],
    kontroller: [
      {
        ad: 'ön 2 camı ayrıca fiyatlamadı',
        gec: (_m, ms) => !ms.some((x) => /ön\s*2\s*cam/i.test(x) && /4[.,]500/.test(x)),
      },
      { ad: 'istenen kapsamın fiyatını verdi', gec: (m) => /11\.000|10\.000|7\.500/.test(m) },
    ],
  },
]

type Sonuc = {
  model: string
  gecen: number
  toplam: number
  girdiJeton: number
  ciktiJeton: number
  tur: number
  hata: number
  detay: Record<string, string>
}

async function modeliKostur(model: string, saglayiciAdi: string): Promise<Sonuc> {
  const saglayici = saglayiciAl(saglayiciAdi, model)
  const s: Sonuc = {
    model,
    gecen: 0,
    toplam: 0,
    girdiJeton: 0,
    ciktiJeton: 0,
    tur: 0,
    hata: 0,
    detay: {},
  }

  for (const vaka of VAKALAR) {
    const sayac = new Map<string, number>()
    for (const k of vaka.kontroller) sayac.set(k.ad, 0)

    for (let i = 0; i < TEKRAR; i += 1) {
      try {
        const y = await yanitUret(
          { konusma: vaka.konusma, kisiAdi: vaka.isim ?? null, simdi: new Date() },
          saglayici,
        )
        s.tur += 1
        s.girdiJeton += y.kullanim.girdiJeton
        s.ciktiJeton += y.kullanim.ciktiJeton
        const metin = y.yapili.mesajlar.join('\n')
        for (const k of vaka.kontroller) {
          if (k.gec(metin, y.yapili.mesajlar)) sayac.set(k.ad, (sayac.get(k.ad) ?? 0) + 1)
        }
      } catch (e) {
        s.hata += 1
        console.error(`   ⚠ ${model} / ${vaka.ad}: ${e instanceof Error ? e.message.slice(0, 90) : e}`)
      }
    }

    for (const k of vaka.kontroller) {
      const g = sayac.get(k.ad) ?? 0
      s.toplam += 1
      if (g === TEKRAR) s.gecen += 1
      s.detay[`${vaka.ad} · ${k.ad}`] = `${g}/${TEKRAR}`
    }
  }

  return s
}

async function main() {
  console.log(`\nMODEL KARŞILAŞTIRMASI — ${VAKALAR.length} vaka × ${TEKRAR} tekrar\n`)

  const sonuclar: Sonuc[] = []
  for (const y of YARISMACILAR) {
    console.log(`▶ ${y.ad} koşuyor...`)
    sonuclar.push(await modeliKostur(y.ad, y.saglayici))
  }

  console.log(`\n${'═'.repeat(78)}`)
  console.log('KURAL BAZINDA (her hücre: kaç koşuda kurala uyuldu)\n')

  const tumKontroller = Object.keys(sonuclar[0]?.detay ?? {})
  const enUzun = Math.max(...tumKontroller.map((k) => k.length), 10)
  console.log('kural'.padEnd(enUzun), sonuclar.map((s) => s.model.padStart(18)).join(''))
  for (const k of tumKontroller) {
    const hucreler = sonuclar.map((s) => {
      const v = s.detay[k] ?? '-'
      const tam = v === `${TEKRAR}/${TEKRAR}`
      return `${tam ? '✓' : '✗'} ${v}`.padStart(18)
    })
    console.log(k.padEnd(enUzun), hucreler.join(''))
  }

  console.log(`\n${'═'.repeat(78)}`)
  console.log('ÖZET\n')
  for (const s of sonuclar) {
    const t = TARIFE[s.model]
    const turBasiGirdi = s.tur ? Math.round(s.girdiJeton / s.tur) : 0
    const turBasiCikti = s.tur ? Math.round(s.ciktiJeton / s.tur) : 0
    const turMaliyet = t ? (turBasiGirdi * t.girdi + turBasiCikti * t.cikti) / 1_000_000 : 0
    const aylik = turMaliyet * 1400
    console.log(`${s.model}`)
    console.log(`  kural başarımı : ${s.gecen}/${s.toplam}${s.hata ? `  (${s.hata} hatalı tur)` : ''}`)
    console.log(`  tur başına     : ${turBasiGirdi} girdi + ${turBasiCikti} çıktı jeton`)
    console.log(
      `  aylık (1.400)  : $${aylik.toFixed(2)} ≈ ${Math.round(aylik * 47.7).toLocaleString('tr')}₺`,
    )
    console.log('')
  }

  const kazanan = [...sonuclar].sort((a, b) => b.gecen / b.toplam - a.gecen / a.toplam)[0]
  if (kazanan) {
    console.log(`KURAL BAŞARIMI EN YÜKSEK: ${kazanan.model} (${kazanan.gecen}/${kazanan.toplam})`)
    console.log('Maliyeti de tabloda — kararı ikisine birlikte bakarak ver.')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
