// Yapılandırılmış çıktının şeması, tek yerden.
//
// Şema JSON Schema olarak yazılır (Anthropic bunu doğrudan alır), Gemini'nin
// beklediği OpenAPI alt kümesine `geminiSemasi()` ile çevrilir. İki sağlayıcı
// aynı sözleşmeyi görsün diye tek kaynak.
//
// NOT: Şemada null kullanılmaz. "Yok" durumu boş metin ("") ya da 'yok' enum
// değeridir; TypeScript tarafına dönerken `ciktiyiCoz` bunları null'a çevirir.
// Sebep: iki sağlayıcının nullable ifade biçimi farklı, boş metin ikisinde de
// aynı çalışıyor.

import { LISTE_ANAHTARLARI, type ListeAnahtari } from './fiyat'
import type { DevirSebebi, FiyatGorselAnahtari, Niyet, YapiliCikti } from './types'

/** Botun gönderebileceği fiyat listesi görselleri. "yok" bilinçli olarak dışarıda. */
export const FIYAT_GORSEL_ANAHTARLARI: FiyatGorselAnahtari[] = ['ppf', 'cam-filmi', 'mikron']

export const NIYETLER: Niyet[] = [
  'selam',
  'fiyat-genel',
  'fiyat-net',
  'hizmet-bilgi',
  'randevu',
  'adres',
  'sure',
  'odeme',
  'pazarlik',
  'sikayet',
  'insan-istiyor',
  'takip',
  'diger',
]

export const DEVIR_SEBEPLERI: DevirSebebi[] = [
  'pazarlik-indirim',
  'liste-disi-is',
  'coklu-arac',
  'sikayet',
  'insan-istedi',
  'emin-degil',
]

export type JsonSema = {
  type: string
  description?: string
  properties?: Record<string, JsonSema>
  required?: string[]
  additionalProperties?: boolean
  items?: JsonSema
  enum?: string[]
}

export const YANIT_SEMASI: JsonSema = {
  type: 'object',
  properties: {
    mesajlar: {
      type: 'array',
      description:
        'Müşteriye gidecek mesajlar. En az bir tane. Her biri kısa, tek fikirli. Ayrı baloncuk gibi düşün.',
      items: { type: 'string' },
    },
    niyet: {
      type: 'string',
      description: 'Müşterinin son mesajındaki niyet.',
      enum: NIYETLER,
    },
    arac: {
      type: 'string',
      description: 'Konuşmadan anlaşılan araç marka/model/yıl. Anlaşılmadıysa boş metin.',
    },
    kapsam: {
      type: 'string',
      description:
        'Konuşmadan anlaşılan iş kapsamı, ör. "ön 3 parça PPF" ya da "5 cam komple film". Anlaşılmadıysa boş metin.',
    },
    fiyat_verilebilir_mi: {
      type: 'boolean',
      description:
        'Araç ve kapsam netleşti VE rakam fiyat listesinde var ise true. Aksi halde false.',
    },
    devir_gerekli_mi: {
      type: 'boolean',
      description: 'Ekibin devralması gerekiyorsa true.',
    },
    devir_sebebi: {
      type: 'string',
      description: 'Devir gerekmiyorsa "yok".',
      enum: [...DEVIR_SEBEPLERI, 'yok'],
    },
    randevu_talebi: {
      type: 'string',
      description:
        'SADECE müşteri somut bir gün ya da saat söylediyse doldur, kendi kelimeleriyle: ' +
        '"cumartesi öğleden sonra", "yarın 14:00", "20 Ağustos sabah". ' +
        'Müşterinin yalnızca randevu İSTEMESİ yetmez ("randevu alabilir miyim", "ne zaman ' +
        'müsaitsiniz", "gelmek istiyorum") — gün/saat yoksa boş metin. Selamlama, fiyat sorusu ' +
        've genel merak bu alanı ASLA doldurmaz. Şüphedeysen boş bırak: müşteri gününü ' +
        'söylediğinde bir sonraki turda yazarsın.',
    },
    randevu_zaman: {
      type: 'string',
      description:
        'randevu_talebi doluysa onun KESİN karşılığı: "YYYY-AA-GGTSS:DD" (Türkiye saati). ' +
        'Bugünün tarihi promptun sonunda yazılı, göreli ifadeleri ona göre çevir ' +
        '("yarın 14:00", "cumartesi sabah" → o günün tarihi). Saat söylenmediyse ' +
        'çalışma saatleri içinde makul bir saat yaz (sabah→10:00, öğleden sonra→14:00, akşam→18:00). ' +
        'Gün belirsizse ("haftaya", "birkaç güne") boş metin bırak — uydurma.',
    },
    gorsel_notu: {
      type: 'string',
      description:
        'Fotoğraf geldiyse araca dair gözlem (renk, model, görünen durum). Fiyat ya da rakam YAZMA. Fotoğraf yoksa boş metin.',
    },
    fiyat_gorseli: {
      type: 'string',
      description:
        'Müşteriye fiyat listesi görseli gönderilecekse hangisi. Görsel de rakam demektir: ' +
        'fiyat_verilebilir_mi false ise MUTLAKA "yok" olmalı. Sohbeti görselle açma. ' +
        'ppf = PPF fiyat listesi, cam-filmi = cam filmi listesi, mikron = kalınlık/garanti tablosu.',
      enum: ['yok', 'ppf', 'cam-filmi', 'mikron'],
    },
    fiyat_listesi: {
      type: 'string',
      description:
        'Müşteriye fiyat SEÇENEKLERİ listesi gidecekse hangisi. Listeyi SEN YAZMA — bu alanı ' +
        'doldur, sistem onaylı listeyi tam ve doğru biçimde ekler. Böylece cevap saniyeler ' +
        'içinde gider ve rakam hatası olmaz. ' +
        'komple-ppf = komple PPF serileri, komple-mat = mat PPF, on-4-ppf / on-3-ppf / ' +
        'kaput-ppf = kısmi PPF, cam-filmi = 5 cam komple. ' +
        'Kapsam belli değilse ya da tek bir kalem soruluyorsa "yok".',
      enum: ['yok', 'komple-ppf', 'komple-mat', 'on-4-ppf', 'on-3-ppf', 'kaput-ppf', 'cam-filmi'],
    },
    guven: {
      type: 'number',
      description: '0 ile 1 arası. Emin değilsen 0.5 altına in ve devir bayrağını kaldır.',
    },
  },
  required: [
    'mesajlar',
    'niyet',
    'arac',
    'kapsam',
    'fiyat_verilebilir_mi',
    'devir_gerekli_mi',
    'devir_sebebi',
    'randevu_talebi',
    'randevu_zaman',
    'gorsel_notu',
    'fiyat_gorseli',
    'fiyat_listesi',
    'guven',
  ],
  additionalProperties: false,
}

/**
 * JSON Schema'yı Gemini'nin responseSchema biçimine çevirir.
 * Farklar: tip adları büyük harf, additionalProperties yok.
 */
export function geminiSemasi(sema: JsonSema): Record<string, unknown> {
  const cikti: Record<string, unknown> = { type: sema.type.toUpperCase() }
  if (sema.description) cikti.description = sema.description
  if (sema.enum) cikti.enum = sema.enum
  if (sema.items) cikti.items = geminiSemasi(sema.items)
  if (sema.properties) {
    const ozellikler: Record<string, unknown> = {}
    for (const [ad, alt] of Object.entries(sema.properties)) {
      ozellikler[ad] = geminiSemasi(alt)
    }
    cikti.properties = ozellikler
    // Alan sırasını sabitlemek çıktının kararlılığını artırıyor.
    cikti.propertyOrdering = Object.keys(sema.properties)
  }
  if (sema.required) cikti.required = sema.required
  return cikti
}

function metin(deger: unknown): string {
  return typeof deger === 'string' ? deger.trim() : ''
}

function bosaNull(deger: unknown): string | null {
  const m = metin(deger)
  return m === '' ? null : m
}

/**
 * Modelin yazdığı randevu zamanını ISO'ya çevirir — ya da reddeder.
 *
 * ⚠ KOD KİLİDİ. Bu alanın üzerine hatırlatma zamanlanıyor ve müşteriye mesaj
 * gidiyor; model burada uydurursa yanlış güne "yarın aracınızı getirecektiniz"
 * yazılır. O yüzden üç şey doğrulanır ve şüphede null dönülür:
 *
 *   1. Biçim tutuyor mu (YYYY-AA-GGTSS:DD)
 *   2. Geçmişte mi — geçmiş randevuya hatırlatma kurulamaz
 *   3. Makul aralıkta mı — 6 aydan uzağı müşterinin dediği değil, modelin
 *      yıl/ay karıştırmasıdır (ör. 2027 yazması)
 *
 * Saat dilimi: Türkiye sabit UTC+3, yaz saati uygulaması yok. Model yerel saat
 * yazıyor, burada +03:00 varsayılarak mutlak ana çevriliyor.
 */
export function randevuZamaniCoz(deger: unknown, simdi: Date = new Date()): string | null {
  const ham = metin(deger)
  if (ham === '') return null

  const kalip = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(ham)
  if (!kalip) return null

  const [, yil, ay, gun, saat, dakika] = kalip
  const an = new Date(`${yil}-${ay}-${gun}T${saat}:${dakika}:00+03:00`)
  if (Number.isNaN(an.getTime())) return null

  // Gün/ay taşması sessizce kaymış olabilir (ör. 2026-02-31 → 3 Mart).
  // Böyle bir tarih müşterinin söylediği gün değildir.
  if (an.toISOString().slice(8, 10) !== gun && an.getUTCDate() !== Number(gun)) return null

  const fark = an.getTime() - simdi.getTime()
  if (fark <= 0) return null // geçmiş ya da şu an
  if (fark > 183 * 24 * 60 * 60_000) return null // ~6 aydan uzak

  return an.toISOString()
}

/**
 * Randevu talebi metni GERÇEKTEN bir gün/saat işaret ediyor mu.
 *
 * ⚠ KOD KİLİDİ. 15 Ağustos (Fatih Bey): "En ufak merhaba mesajına bile randevu
 * alıyor" — müşteri sadece "merhaba" yazdığında Telegram'a randevu bildirimi
 * düşüyor, panele randevu satırı açılıyordu. Model bu alanı niyet sezdiği anda
 * dolduruyor ("randevu almak istiyor", "görüşmek istiyor", hatta selamlamayı
 * kopyalayıp), oysa alanın sözleşmesi "müşterinin söylediği gün/saat".
 *
 * Prompt tek başına yetmez (bu ders üç kez tekrarlandı), o yüzden kilit burada:
 * metinde somut bir zaman işareti yoksa randevu talebi YOK sayılır. Bot yine
 * randevu konuşmaya devam eder — sadece panele kayıt ve Telegram bildirimi
 * müşteri gerçek bir gün söyleyene kadar beklemez.
 *
 * Yanlış alarmın maliyeti asimetrik: kaçan gerçek randevu bir sonraki turda
 * müşteri gün söyleyince yakalanır, ama her "merhaba"ya bildirim gitmesi
 * bildirimin tamamını değersizleştirir.
 */
export function randevuTalebiGecerliMi(ham: string): boolean {
  const m = ham.toLocaleLowerCase('tr-TR')

  // Modelin "alan boş" demek için kullandığı kalıplar.
  if (/^(yok|bilinmiyor|belirtilmedi|belirsiz|-|yok\.)$/.test(m.trim())) return false

  const isaretler: RegExp[] = [
    // Hafta günleri (ekleriyle: "cumartesiye", "salı günü")
    /\b(pazartesi|salı|sali|çarşamba|carsamba|perşembe|persembe|cuma|cumartesi|pazar)/,
    // Göreli gün ifadeleri
    /\b(bugün|bugun|yarın|yarin|öbür gün|obur gun|ertesi gün|hafta ?sonu|haftaya|önümüzdeki|onumuzdeki|gelecek hafta|bu akşam|bu aksam)/,
    // Günün bölümleri
    /\b(sabah|öğlen|oglen|öğleden sonra|ogleden sonra|akşam|aksam|gece|öğle|ogle)/,
    // Saat: "14:00", "14.30", "saat 3", "3'te", "10 gibi"
    /\b\d{1,2}[:.]\d{2}\b/,
    /\bsaat\s*\d{1,2}\b/,
    /\b\d{1,2}\s*('|’)?(te|ta|de|da)\b/,
    /\b\d{1,2}\s*gibi\b/,
    // Tarih: "20.08", "20/08", "20 ağustos"
    /\b\d{1,2}[./]\d{1,2}\b/,
    /\b\d{1,2}\s*(ocak|şubat|subat|mart|nisan|mayıs|mayis|haziran|temmuz|ağustos|agustos|eylül|eylul|ekim|kasım|kasim|aralık|aralik)/,
  ]

  return isaretler.some((k) => k.test(m))
}

/**
 * Sağlayıcıdan gelen ham nesneyi doğrular ve TypeScript tipine çevirir.
 * Şema zorlandığı için burada onarım değil, doğrulama yapılır: bozuksa patlar.
 */
export function ciktiyiCoz(ham: unknown): YapiliCikti {
  if (typeof ham !== 'object' || ham === null) {
    throw new Error('yapılandırılmış çıktı nesne değil')
  }
  const n = ham as Record<string, unknown>

  const mesajlar = Array.isArray(n.mesajlar)
    ? n.mesajlar.map(metin).filter((m) => m !== '')
    : []
  if (mesajlar.length === 0) throw new Error('mesajlar boş geldi')

  const niyetHam = metin(n.niyet) as Niyet
  const niyet = NIYETLER.includes(niyetHam) ? niyetHam : 'diger'

  const sebepHam = metin(n.devir_sebebi) as DevirSebebi
  const devirSebebi = DEVIR_SEBEPLERI.includes(sebepHam) ? sebepHam : null

  const guvenHam = typeof n.guven === 'number' ? n.guven : Number(n.guven)
  const guven = Number.isFinite(guvenHam) ? Math.min(1, Math.max(0, guvenHam)) : 0.5

  const gorselHam = metin(n.fiyat_gorseli) as FiyatGorselAnahtari
  const gecerliGorsel = FIYAT_GORSEL_ANAHTARLARI.includes(gorselHam) ? gorselHam : null

  // Görsel de rakam demektir. Fiyat verilemeyen bir turda görsel gönderilirse
  // "fiyatla açma yasağı" sessizce delinir; model ne derse desin burada kesilir.
  const fiyatVerilebilir = n.fiyat_verilebilir_mi === true
  const fiyatGorseli = fiyatVerilebilir ? gecerliGorsel : null

  // Hazır fiyat listesi de rakamdır: fiyat verilemeyen turda gönderilmez.
  // (Aynı gerekçe fiyat_gorseli için de geçerli — kilit oradan kopyalandı.)
  const listeHam = metin(n.fiyat_listesi)
  const fiyatListesi =
    fiyatVerilebilir && LISTE_ANAHTARLARI.includes(listeHam as ListeAnahtari)
      ? (listeHam as ListeAnahtari)
      : null

  // Randevu talebi ancak somut bir gün/saat işaret ediyorsa kayda değer.
  // Gerekçe: randevuTalebiGecerliMi'nin başında ("merhaba"ya randevu açılması).
  const randevuHam = bosaNull(n.randevu_talebi)
  const randevuTalebi = randevuHam && randevuTalebiGecerliMi(randevuHam) ? randevuHam : null

  return {
    mesajlar,
    niyet,
    arac: bosaNull(n.arac),
    kapsam: bosaNull(n.kapsam),
    fiyat_verilebilir_mi: fiyatVerilebilir,
    devir_gerekli_mi: n.devir_gerekli_mi === true,
    devir_sebebi: n.devir_gerekli_mi === true ? devirSebebi : null,
    randevu_talebi: randevuTalebi,
    // Zaman ancak talep varsa anlamlı: talep yokken gelen tarih modelin
    // kendi kendine kurduğu bir randevudur, kaydedilmez.
    randevu_zaman: randevuTalebi ? randevuZamaniCoz(n.randevu_zaman) : null,
    gorsel_notu: bosaNull(n.gorsel_notu),
    fiyat_gorseli: fiyatGorseli,
    fiyat_listesi: fiyatListesi,
    guven,
  }
}
