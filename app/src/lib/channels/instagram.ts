// Instagram DM kanalı — İSKELET.
//
// TODO: Meta erişimi gelince doldurulacak (KAPSAM Bölüm 9).
// Gerekenler: Instagram Professional hesabı, Meta Business üzerinden varlık erişimi
// (şifre DEĞİL, KAPSAM Bölüm 7 "erişim yöntemi"), erişim jetonu, app secret.
//
// HANGİ YOL SEÇİLECEK — KARAR: "Instagram API with Instagram Login".
// Meta'nın App Review tablosunda bizim satırımız birebir şu:
//   "My app is only for a business I own or manage | Instagram Login |
//    Standard Access | Not required"
// Yani App Review GEREKMEZ. Ama bu yalnızca Instagram Login yolu için geçerli:
//   - Instagram Login  → instagram_business_manage_messages → Standard Access
//   - Facebook Login   → instagram_manage_messages          → Advanced Access (App Review)
// Yanlış yola girilirse boş yere haftalarca inceleme beklenir.
// Gerçek bekleme kalemi: İşletme Doğrulaması + uygulamanın Live moda alınması.
// Dev modda üretim webhook'ları hiç teslim edilmiyor.
//
// KAPSAM DIŞI: Instagram yorumları. Sadece DM. (Bölüm 3)

import { KanalHatasi, type GelenMesaj, type GonderimSonucu, type Kanal } from './types'

export const instagramKanal: Kanal = {
  ad: 'instagram',

  async mesajGonder(_konusmaId: string, _metin: string): Promise<GonderimSonucu> {
    // TODO: POST https://graph.instagram.com/v21.0/me/messages
    // recipient.id = kişinin scoped user id'si.
    void _konusmaId
    void _metin
    throw new KanalHatasi('instagram', 'Instagram DM bağlantısı henüz kurulmadı.')
  },

  async medyaGonder(
    _konusmaId: string,
    _medyaUrl: string,
    _altYazi?: string | null,
  ): Promise<GonderimSonucu> {
    // TODO: POST .../me/messages { message: { attachment: { type: 'image',
    // payload: { url } } } }. Instagram DM'de görselin alt yazısı ayrı mesaj
    // olarak gider; tek istekte caption alanı yok.
    void _konusmaId
    void _medyaUrl
    void _altYazi
    throw new KanalHatasi('instagram', 'Instagram DM bağlantısı henüz kurulmadı.')
  },

  async webhookDogrula(_req: Request): Promise<boolean> {
    // TODO: GET doğrulaması (hub.verify_token) + POST'ta X-Hub-Signature-256 kontrolü.
    void _req
    return false
  },

  gelenMesajiCoz(_payload: unknown): GelenMesaj[] {
    // TODO: entry[].messaging[] → GelenMesaj.
    // Kimlik: sender.id, metin: message.text, medya: message.attachments[].payload.url.
    // message.is_echo true ise bizim gönderdiğimiz mesajdır, atlanır.
    // Yorum olayları (entry[].changes) bu işin kapsamında değil, boş dizi döner.
    //
    // REKLAM BİLGİSİ (Fatih Bey'in sorusu, 10 Ağustos): Instagram reklamına
    // tıklayıp DM açan müşterilerde yükte `referral` nesnesi gelir:
    //   entry[].messaging[].referral = { ref, source: 'ADS', type, ad_id,
    //                                    ads_context_data: { ad_title, photo_url, video_url } }
    // İlk mesajda `message.referral` olarak da gelebilir. Bunu GelenMesaj.reklam
    // alanına taşı: bot o zaman "cam filmi fiyat al" reklamından geldiğini bilir
    // ve müşteri sadece "merhaba" yazsa bile doğru hizmetle açar.
    void _payload
    return []
  },
}
