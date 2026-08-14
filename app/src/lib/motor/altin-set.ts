// Altın set koşucusu: botun sınav kağıdı.
//
// ../../altin-set.json içindeki 18 gerçek konuşma seçili sağlayıcıya oynatılır.
// Konuşma tur tur ilerler: müşterinin gerçek mesajları sırayla verilir, işletme
// tarafını BOT doldurur. Fatih Bey'in o gün verdiği gerçek cevaplar rapora
// referans olarak yazılır, modele GÖSTERİLMEZ (yoksa kopya çekmiş olur).
//
// Çıktı: app/_altin-set/<saglayici>-<tarih>.md

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import {
  BAYRAK_BASLIKLARI,
  bayraklariBul,
  ilkTurdaFiyatSerbestMi,
  OZ_TEST_ORNEKLERI,
  type Bayrak,
} from './denetim'
import { fiyatBilgisiAl } from './fiyat'
import { saglayiciAl, yanitUret } from './index'
import type { Saglayici } from './saglayici'
import type { KonusmaMesaji, YapiliCikti } from './types'

export type AltinVakaHam = {
  kategori: string
  kaynak: string
  konusma: { kim: string; metin: string }[]
  gercek_cevaplar: string[]
}

export type TurSonucu = {
  sira: number
  musteriMetni: string
  botMesajlari: string[]
  yapili: YapiliCikti | null
  bayraklar: Bayrak[]
  hata: string | null
}

export type VakaSonucu = {
  kategori: string
  kaynak: string
  turlar: TurSonucu[]
  gercekCevaplar: string[]
}

export type KosuSonucu = {
  raporYolu: string
  vakalar: VakaSonucu[]
  toplamTur: number
  bayrakSayilari: Record<string, number>
  hataliTur: number
}

/** Ardışık müşteri mesajlarını tek tura toplar; işletme satırlarını atar. */
export function musteriTurlariniCikar(konusma: { kim: string; metin: string }[]): string[] {
  const turlar: string[] = []
  let biriken: string[] = []

  for (const satir of konusma) {
    if (satir.kim === 'musteri') {
      const metin = satir.metin.trim()
      if (metin !== '') biriken.push(metin)
    } else if (biriken.length > 0) {
      turlar.push(biriken.join('\n'))
      biriken = []
    }
  }
  if (biriken.length > 0) turlar.push(biriken.join('\n'))

  return turlar
}

function altinSetiOku(yol: string): AltinVakaHam[] {
  const ham = JSON.parse(readFileSync(yol, 'utf8')) as unknown
  if (!Array.isArray(ham)) throw new Error(`${yol}: dizi bekleniyordu`)
  return ham as AltinVakaHam[]
}

function altinSetYoluBul(verilen?: string): string {
  const adaylar = [
    verilen,
    process.env.ALTIN_SET_YOLU,
    path.join(process.cwd(), '..', 'altin-set.json'),
    path.join(process.cwd(), 'altin-set.json'),
  ].filter((y): y is string => typeof y === 'string' && y !== '')

  for (const aday of adaylar) {
    try {
      readFileSync(aday, 'utf8')
      return aday
    } catch {
      // sıradaki
    }
  }
  throw new Error(`altin-set.json bulunamadı. Denenen: ${adaylar.join(', ')}`)
}

function tarihDamgasi(an = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${an.getFullYear()}-${p(an.getMonth() + 1)}-${p(an.getDate())}-${p(an.getHours())}${p(an.getMinutes())}`
}

function alintila(metin: string): string {
  return metin
    .split('\n')
    .map((s) => `> ${s}`)
    .join('\n')
}

function yapiliOzet(y: YapiliCikti): string {
  return [
    `niyet: \`${y.niyet}\``,
    `arac: ${y.arac ?? '-'}`,
    `kapsam: ${y.kapsam ?? '-'}`,
    `fiyat_verilebilir_mi: ${y.fiyat_verilebilir_mi}`,
    `devir_gerekli_mi: ${y.devir_gerekli_mi}${y.devir_sebebi ? ` (${y.devir_sebebi})` : ''}`,
    `randevu_talebi: ${y.randevu_talebi ?? '-'}`,
    `gorsel_notu: ${y.gorsel_notu ?? '-'}`,
    `fiyat_gorseli: ${y.fiyat_gorseli ?? '-'}`,
    `guven: ${y.guven}`,
  ]
    .map((s) => `- ${s}`)
    .join('\n')
}

export type KosuSecenekleri = {
  saglayici?: Saglayici
  altinSetYolu?: string
  cikisKlasoru?: string
  /** Vaka sayısını sınırlamak için (deneme koşusu). */
  limit?: number
  gunluk?: (satir: string) => void
}

export async function altinSetiKostur(secenekler: KosuSecenekleri = {}): Promise<KosuSonucu> {
  const gunluk = secenekler.gunluk ?? (() => {})
  const saglayici = secenekler.saglayici ?? saglayiciAl()
  // Anahtar yoksa tek istek atmadan, net hatayla dur.
  saglayici.anahtarKontrolu()
  const fiyat = fiyatBilgisiAl()

  const setYolu = altinSetYoluBul(secenekler.altinSetYolu)
  const tumVakalar = altinSetiOku(setYolu)
  const vakalarHam =
    typeof secenekler.limit === 'number' ? tumVakalar.slice(0, secenekler.limit) : tumVakalar

  gunluk(`sağlayıcı: ${saglayici.ad} / model: ${saglayici.model}`)
  gunluk(`altın set: ${setYolu} (${vakalarHam.length} vaka)`)

  // Tam koşu 30'dan fazla model çağrısı demek. Anahtar ekip içinde paylaşıldığı
  // için bunu baştan söylüyoruz: kota dakikalık limitte (RPM) tükeniyor.
  const planlananTur = vakalarHam.reduce(
    (toplam, vaka) => toplam + musteriTurlariniCikar(vaka.konusma).length,
    0,
  )
  if (saglayici.ad !== 'sahte') {
    gunluk(
      `UYARI: bu koşu ${planlananTur} model çağrısı yapacak. Paylaşılan anahtarda ` +
        'kota yakmamak için deneme koşularında --limit=2 kullan.',
    )
  }
  gunluk(`fiyat kaynağı: ${fiyat.kaynakYolu} (${fiyat.izinliRakamlar.size} izinli rakam)`)
  if (fiyat.celiskiliKalemler.length > 0) {
    gunluk(
      `ÇELİŞKİ: Bölüm 2b ile 3c çelişiyor, şu kalemler onaylı tablodan düşürüldü: ` +
        `${fiyat.celiskiliKalemler.join(', ')} (karar İsa/Fatih Bey'de)`,
    )
  }

  const vakalar: VakaSonucu[] = []
  const bayrakSayilari: Record<string, number> = {}
  let toplamTur = 0
  let hataliTur = 0

  for (const [indeks, vaka] of vakalarHam.entries()) {
    const musteriTurlari = musteriTurlariniCikar(vaka.konusma)
    gunluk(`${indeks + 1}/${vakalarHam.length} ${vaka.kaynak} (${musteriTurlari.length} tur)`)

    const konusma: KonusmaMesaji[] = []
    const turlar: TurSonucu[] = []

    for (const [turIndeks, musteriMetni] of musteriTurlari.entries()) {
      konusma.push({ rol: 'musteri', metin: musteriMetni })
      toplamTur += 1

      // Ucretsiz katman kotasi (Gemini: dakikada 5 istek). MOTOR_BEKLEME_MS ile ayarlanir.
      const beklemeMs = Number(process.env.MOTOR_BEKLEME_MS ?? 13000)
      if (beklemeMs > 0 && toplamTur > 1) {
        await new Promise((r) => setTimeout(r, beklemeMs))
      }

      try {
        // Üretim yolu (bot.ts) yanitUret üzerinden gidiyor; zorunlu-parça
        // düzeltme turu orada devreye giriyor. Sınav gerçek davranışı ölçmeli.
        const yanit = await yanitUret({ konusma, simdi: new Date() }, saglayici)
        konusma.push({ rol: 'bot', metin: yanit.metin })

        const bayraklar = bayraklariBul(yanit.metin, {
          ilkCevapMi: turIndeks === 0,
          izinliRakamlar: fiyat.izinliRakamlar,
          teyitBekleyenIsler: fiyat.teyitBekleyenIsler,
          fiyatGorseliGonderildiMi: yanit.yapili.fiyat_gorseli !== null,
          fiyatVerilebilirMi: yanit.yapili.fiyat_verilebilir_mi,
          ilkTurdaFiyatSerbestMi: ilkTurdaFiyatSerbestMi(yanit.yapili),
          kalemFiyatlari: fiyat.kalemFiyatlari,
        })
        for (const bayrak of bayraklar) {
          bayrakSayilari[bayrak.tur] = (bayrakSayilari[bayrak.tur] ?? 0) + 1
        }

        turlar.push({
          sira: turIndeks + 1,
          musteriMetni,
          botMesajlari: yanit.yapili.mesajlar,
          yapili: yanit.yapili,
          bayraklar,
          hata: null,
        })
      } catch (hata) {
        hataliTur += 1
        const mesaj = hata instanceof Error ? hata.message : String(hata)
        gunluk(`  ! tur ${turIndeks + 1} hata: ${mesaj}`)
        turlar.push({
          sira: turIndeks + 1,
          musteriMetni,
          botMesajlari: [],
          yapili: null,
          bayraklar: [],
          hata: mesaj,
        })
        // Konuşma bozulmasın diye tur atlanır, sonrakine geçilir.
        konusma.pop()
      }
    }

    vakalar.push({
      kategori: vaka.kategori,
      kaynak: vaka.kaynak,
      turlar,
      gercekCevaplar: vaka.gercek_cevaplar,
    })
  }

  const cikisKlasoru = secenekler.cikisKlasoru ?? path.join(process.cwd(), '_altin-set')
  mkdirSync(cikisKlasoru, { recursive: true })
  const raporYolu = path.join(cikisKlasoru, `${saglayici.ad}-${tarihDamgasi()}.md`)

  writeFileSync(
    raporYolu,
    raporYaz({ saglayici, fiyat, setYolu, vakalar, toplamTur, bayrakSayilari, hataliTur }),
    'utf8',
  )

  return { raporYolu, vakalar, toplamTur, bayrakSayilari, hataliTur }
}

function raporYaz(girdi: {
  saglayici: Saglayici
  fiyat: ReturnType<typeof fiyatBilgisiAl>
  setYolu: string
  vakalar: VakaSonucu[]
  toplamTur: number
  bayrakSayilari: Record<string, number>
  hataliTur: number
}): string {
  const { saglayici, fiyat, setYolu, vakalar, toplamTur, bayrakSayilari, hataliTur } = girdi
  const satirlar: string[] = []

  const toplamBayrak = Object.values(bayrakSayilari).reduce((a, b) => a + b, 0)

  satirlar.push(`# Altın set koşusu: ${saglayici.ad}`)
  satirlar.push('')
  satirlar.push(`- Tarih: ${new Date().toLocaleString('tr-TR')}`)
  satirlar.push(`- Sağlayıcı / model: \`${saglayici.ad}\` / \`${saglayici.model}\``)
  satirlar.push(`- Altın set: \`${setYolu}\``)
  satirlar.push(
    `- Fiyat kaynağı: \`${fiyat.kaynakYolu}\` (${fiyat.izinliRakamlar.size} izinli rakam${
      fiyat.teyitsizDahil ? ', teyitsiz kalemler DAHİL' : ''
    })`,
  )
  if (fiyat.celiskiliKalemler.length > 0) {
    satirlar.push(
      `- ⚠ Fiyat çelişkisi (Bölüm 2b / 3c), onaylı tablodan düşürüldü: ` +
        `${fiyat.celiskiliKalemler.join(', ')}`,
    )
  }
  satirlar.push(`- Vaka: ${vakalar.length} · Tur: ${toplamTur} · Hatalı tur: ${hataliTur}`)
  satirlar.push(`- Kırmızı bayrak: **${toplamBayrak}**`)
  satirlar.push('')

  if (toplamBayrak > 0) {
    satirlar.push('## Kırmızı bayrak özeti')
    satirlar.push('')
    satirlar.push('| Kontrol | Adet |')
    satirlar.push('|---|---|')
    for (const [tur, adet] of Object.entries(bayrakSayilari)) {
      satirlar.push(`| ${BAYRAK_BASLIKLARI[tur as keyof typeof BAYRAK_BASLIKLARI] ?? tur} | ${adet} |`)
    }
    satirlar.push('')
    satirlar.push('Bayrağın geçtiği vakalar:')
    satirlar.push('')
    for (const vaka of vakalar) {
      for (const tur of vaka.turlar) {
        for (const bayrak of tur.bayraklar) {
          satirlar.push(
            `- **${vaka.kaynak}** tur ${tur.sira}: ${BAYRAK_BASLIKLARI[bayrak.tur]} — ${bayrak.aciklama}`,
          )
        }
      }
    }
    satirlar.push('')
  } else {
    satirlar.push('## Kırmızı bayrak özeti')
    satirlar.push('')
    satirlar.push('Otomatik kontrollerin hiçbiri ateşlemedi.')
    satirlar.push('')
  }

  satirlar.push('---')
  satirlar.push('')

  for (const [indeks, vaka] of vakalar.entries()) {
    satirlar.push(`## ${indeks + 1}. [${vaka.kategori}] ${vaka.kaynak}`)
    satirlar.push('')

    for (const tur of vaka.turlar) {
      satirlar.push(`### Tur ${tur.sira}`)
      satirlar.push('')
      satirlar.push('**MÜŞTERİ**')
      satirlar.push('')
      satirlar.push(alintila(tur.musteriMetni))
      satirlar.push('')

      if (tur.hata) {
        satirlar.push('**BOT** — hata')
        satirlar.push('')
        satirlar.push('```')
        satirlar.push(tur.hata)
        satirlar.push('```')
        satirlar.push('')
        continue
      }

      satirlar.push('**BOT**')
      satirlar.push('')
      satirlar.push(alintila(tur.botMesajlari.join('\n')))
      satirlar.push('')

      if (tur.bayraklar.length > 0) {
        satirlar.push('**Kırmızı bayrak**')
        satirlar.push('')
        for (const bayrak of tur.bayraklar) {
          satirlar.push(`- ${BAYRAK_BASLIKLARI[bayrak.tur]}: ${bayrak.aciklama}`)
        }
        satirlar.push('')
      }

      if (tur.yapili) {
        satirlar.push('<details><summary>Yapılandırılmış çıktı</summary>')
        satirlar.push('')
        satirlar.push(yapiliOzet(tur.yapili))
        satirlar.push('')
        satirlar.push('</details>')
        satirlar.push('')
      }
    }

    satirlar.push('**FATİH BEY\'İN GERÇEK CEVAPLARI** (aynı yazışmada, referans)')
    satirlar.push('')
    if (vaka.gercekCevaplar.length === 0) {
      satirlar.push('> (yok)')
    } else {
      satirlar.push(alintila(vaka.gercekCevaplar.join('\n---\n')))
    }
    satirlar.push('')
    satirlar.push('---')
    satirlar.push('')
  }

  // Denetimin kendi kontrolü: bozuk örnekler bayrak kaldırıyor mu.
  satirlar.push('## Denetimin kendi kontrolü')
  satirlar.push('')
  satirlar.push('Bilerek bozuk metinler, kontrollerin çalıştığını göstermek için:')
  satirlar.push('')
  satirlar.push('| Beklenen bayrak | Metin | Sonuç |')
  satirlar.push('|---|---|---|')
  for (const ornek of OZ_TEST_ORNEKLERI) {
    const bulunan = bayraklariBul(ornek.metin, {
      ilkCevapMi: ornek.ilkCevapMi,
      izinliRakamlar: fiyat.izinliRakamlar,
      teyitBekleyenIsler: fiyat.teyitBekleyenIsler,
      kalemFiyatlari: fiyat.kalemFiyatlari,
    })
    const yakalandi = bulunan.some((b) => b.tur === ornek.tur)
    satirlar.push(
      `| ${BAYRAK_BASLIKLARI[ornek.tur]} | ${ornek.metin} | ${yakalandi ? 'yakalandı' : 'KAÇIRILDI'} |`,
    )
  }
  satirlar.push('')

  return satirlar.join('\n')
}
