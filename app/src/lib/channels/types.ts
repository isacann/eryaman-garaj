// Kanal soyutlaması.
//
// KURAL: Uygulamanın hiçbir yeri doğrudan WhatsApp'a ya da Instagram'a bağlanmaz.
// Her gönderim ve her gelen mesaj bu arayüzden geçer. Böylece yanıt motoru, panel
// ve takip kuyruğu hangi kanalda olduğunu bilmek zorunda kalmaz; Meta erişimi
// gelmeden de sahte kanalla (mock) uçtan uca çalışır.

import type { Json, KanalAdi } from '@/lib/db/types'

/** Her kanalın kendi yükünden çıkardığı ortak gelen mesaj biçimi. */
export type GelenMesaj = {
  kanal: KanalAdi
  /** Gönderenin kanal içindeki kimliği: WhatsApp'ta wa_id, Instagram'da scoped user id. */
  kanalKimlik: string
  /** Kanal veriyorsa görünen ad ya da kullanıcı adı. */
  ad: string | null
  metin: string | null
  medyaUrl: string | null
  /** Kanalın mesaj kimliği. Webhook tekrar gelirse aynı mesaj iki kez yazılmasın diye. */
  hariciId: string | null
  /**
   * Müşteri bir REKLAMDAN geldiyse o reklamın bilgisi.
   *
   * Meta, tıklanabilir reklamlardan (Click-to-Instagram-Direct / Messenger)
   * gelen mesajlarda webhook yüküne `referral` nesnesi koyuyor: ad_id,
   * ad_title, photo_url, video_url. Fatih Bey'in sorusu buydu — "reklamda
   * 'cam filmi için fiyat al' yazıyor, bot bunu görecek mi": görüyor.
   *
   * Bota verildiğinde açılış bağlamı olur: müşteri "merhaba" yazsa bile
   * hangi hizmet için geldiği bilinir.
   *
   * ⚠ `metin`: reklamın KENDİ yaratıcı metni (headline + body). Meta bunu
   * WhatsApp'ta `referral.headline` / `referral.body`, Instagram'da
   * `ads_context_data` içinde veriyor. Kampanya rakamı çoğu zaman burada
   * yazılıdır ("4.500₺'den başlayan fiyatlarla") — yani reklamın metnini
   * Meta BEDAVA veriyor, ayrıca izin ya da App Review gerekmiyor.
   * Yapılandırılmış kampanya/indirim verisi ise Meta'da HİÇ YOK; onun için
   * panele girilen kampanya (bot_egitim, tur='reklam') kaynak alınır.
   */
  reklam: {
    adId: string | null
    baslik: string | null
    metin?: string | null
  } | null
  /** ISO 8601. */
  zaman: string
  /** Ham yük, teşhis için saklanır. */
  ham: Json
}

export type GonderimSonucu =
  | { basarili: true; hariciId: string | null }
  | { basarili: false; hata: string }

export interface Kanal {
  readonly ad: KanalAdi

  /**
   * Konuşmanın karşı tarafına metin gönderir.
   * Veritabanına yazmaz. Mesaj kaydı servis katmanının işi (src/lib/mesajlar.ts),
   * kanal sadece taşıma yapar. Böylece her kanal aynı kayıt akışını paylaşır.
   */
  mesajGonder(konusmaId: string, metin: string): Promise<GonderimSonucu>

  /**
   * Görsel gönderir (fiyat listesi görseli gibi).
   *
   * Gerçek veride işletmenin en sık davranışlarından biri "Fiyat listemizi
   * yönlendiriyorum" (arşivde 39 kez) ve gönderilen şey bir görsel. Kanal
   * katmanı bu yüzden metin dışında medyayı da taşımak zorunda.
   *
   * `medyaUrl` herkese açık https adresi olmalı: Meta görseli kendi sunucusuna
   * bu adresten çeker.
   */
  medyaGonder(
    konusmaId: string,
    medyaUrl: string,
    altYazi?: string | null,
  ): Promise<GonderimSonucu>

  /** Webhook isteğinin gerçekten bu kanaldan geldiğini doğrular (imza / doğrulama jetonu). */
  webhookDogrula(req: Request): Promise<boolean>

  /**
   * Webhook yükünü ortak biçime çevirir.
   * Dizi döner çünkü Meta tek istekte birden çok mesaj yollayabiliyor.
   * Mesaj olmayan olaylar (durum bildirimi, okundu bilgisi) boş dizi döndürür.
   */
  gelenMesajiCoz(payload: unknown): GelenMesaj[]
}

export class KanalHatasi extends Error {
  constructor(
    public readonly kanal: KanalAdi,
    mesaj: string,
  ) {
    super(`[${kanal}] ${mesaj}`)
    this.name = 'KanalHatasi'
  }
}
