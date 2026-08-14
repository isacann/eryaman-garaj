import type { ListeAnahtari } from './fiyat'

// Yanıt motorunun ortak tipleri.
//
// Motor model bağımsızdır: burada tanımlı tipler hangi sağlayıcı seçilirse seçilsin
// aynı kalır. Sağlayıcıya özgü hiçbir alan bu dosyaya girmez.

/** Müşterinin o mesajdaki niyeti. Panelde etiket, takip kararlarında girdi olur. */
export type Niyet =
  | 'selam'
  | 'fiyat-genel' // "fiyatlarınız nedir" tipi, kapsam yok
  | 'fiyat-net' // araç ve kapsam belli, net fiyat sorusu
  | 'hizmet-bilgi' // "ppf nedir", "ne kadar dayanır"
  | 'randevu'
  | 'adres'
  | 'sure'
  | 'odeme' // taksit, kart
  | 'pazarlik' // indirim talebi
  | 'sikayet'
  | 'insan-istiyor'
  | 'takip' // "cevap vermediniz", "hocam?"
  | 'diger'

/** Ekibe devir gerekiyorsa sebebi. KAPSAM Bölüm 8, madde 5. */
export type DevirSebebi =
  | 'pazarlik-indirim'
  | 'liste-disi-is'
  | 'coklu-arac'
  | 'sikayet'
  | 'insan-istedi'
  | 'emin-degil'

/** Fiyat listesi görselleri (bkz. src/lib/fiyat-gorselleri.ts). */
export type FiyatGorselAnahtari = 'ppf' | 'cam-filmi' | 'mikron'

export type KonusmaRolu = 'musteri' | 'bot'

export type KonusmaMesaji = {
  rol: KonusmaRolu
  metin: string
}

/** Müşterinin gönderdiği araç fotoğrafı. Sağlayıcıya base64 olarak gider. */
export type Gorsel = {
  mimeTur: string
  /** Saf base64, "data:" öneki olmadan. */
  base64: string
}

/**
 * Modelin yapılandırılmış çıktısı.
 *
 * Ham metinden regex ile ayıklanmaz: her sağlayıcı kendi şema desteğiyle
 * (Gemini responseSchema, Anthropic output_config.format) bunu üretir.
 */
export type YapiliCikti = {
  /** Müşteriye gidecek mesajlar. Sahadaki ritim gibi kısa ve parça parça. */
  mesajlar: string[]
  niyet: Niyet
  /** Anlaşılan araç (marka/model/yıl). Netleşmediyse null. */
  arac: string | null
  /** Anlaşılan iş kapsamı (ör. "ön 3 parça PPF"). Netleşmediyse null. */
  kapsam: string | null
  /** Kapsam netleşti ve rakam fiyat listesinde var mı. */
  fiyat_verilebilir_mi: boolean
  devir_gerekli_mi: boolean
  devir_sebebi: DevirSebebi | null
  /** Müşterinin söylediği gün/saat, kendi kelimeleriyle. Yoksa null. */
  randevu_talebi: string | null
  /** Fotoğraf geldiyse araca dair gözlem. Fiyat bilgisi İÇERMEZ. */
  gorsel_notu: string | null
  /**
   * Bu turda gönderilecek fiyat listesi görseli. Yoksa null.
   * fiyat_verilebilir_mi false ise şema çözücüsü bunu zorla null yapar:
   * görsel de rakamdır, fiyatla açma yasağı görsele de işler.
   */
  fiyat_gorseli: FiyatGorselAnahtari | null
  /**
   * Hazır fiyat listesi anahtarı. Liste metnini MODEL YAZMAZ; kod basar.
   * Sebep: liste ~1.100 jeton ve turun 20-60 saniyesini yiyordu (13 Ağustos
   * ölçümü). Kodla basılınca hem saniyeler içinde gidiyor hem rakam hatası
   * imkânsız hale geliyor.
   */
  fiyat_listesi: ListeAnahtari | null
  /** 0-1 arası. Düşükse devir bayrağı beklenir. */
  guven: number
}

export type Kullanim = {
  saglayici: string
  model: string
  girdiJeton: number
  ciktiJeton: number
  /**
   * Önbellekten okunan girdi jetonu. Anthropic'te $0.20/1M (normalin %10'u),
   * yani maliyeti bu alanı ölçmeden hesaplamak gerçeği 5 kat yanlış gösterir.
   * Sağlayıcı bildirmiyorsa 0.
   */
  onbellekOkuma?: number
  /** Önbelleğe YAZILAN jeton. Anthropic'te 1 saatlik TTL'de $2/1M (2×). */
  onbellekYazma?: number
}

export type MotorYanit = {
  /** mesajlar dizisinin satır satır birleştirilmiş hali. Log ve denetim için. */
  metin: string
  yapili: YapiliCikti
  kullanim: Kullanim
}

/**
 * Fatih Bey'in panelden bota eklediği içerik (`bot_egitim` tablosu).
 * Motor bunu hazır alır; veritabanını okumak çağıranın işi (bkz. lib/egitim.ts).
 */
export type EgitimIcerigi = {
  /** Kalıcı işletme bilgisi. Promptun SABİT önekine girer, önbelleği bozmaz. */
  bilgi: { baslik: string; icerik: string }[]
  /** Ton/davranış notları. Sabit öneke girer. */
  davranis: { baslik: string; icerik: string }[]
  /** Bu konuşmaya UYAN kampanyalar. Yalnızca reklamdan gelen müşteride dolu. */
  reklam: { baslik: string; icerik: string }[]
}

export type YanitGirdi = {
  /** Konuşma geçmişi, eskiden yeniye. Son eleman müşterinin yeni mesajı olmalı. */
  konusma: KonusmaMesaji[]
  /** Biliniyorsa müşterinin adı. Ton kuralı: "[İsim] bey merhabalar". */
  kisiAdi?: string | null
  /** Müşteri reklamdan geldiyse reklamın başlığı (Instagram/Facebook referral). */
  reklamBasligi?: string | null
  /** Müşterinin bu turda gönderdiği fotoğraflar. */
  gorseller?: Gorsel[]
  /** Test edilebilirlik için saat enjeksiyonu. Verilmezse şimdi. */
  simdi?: Date
  /** Panelden eklenen bilgi/davranış/kampanya. Yoksa bot eskisi gibi çalışır. */
  egitim?: EgitimIcerigi
}

export class MotorHatasi extends Error {
  constructor(
    public readonly saglayici: string,
    mesaj: string,
  ) {
    super(`[${saglayici}] ${mesaj}`)
    this.name = 'MotorHatasi'
  }
}
