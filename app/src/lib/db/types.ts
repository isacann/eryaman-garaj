// supabase/schema.sql'in TypeScript karşılığı. Şema değişirse burası da değişir.
// Durum alanları veritabanında CHECK'siz TEXT; burada daraltılmış birleşim tipleriyle
// tutuluyor ki panelde yanlış değer yazılmasın.

export type Json = string | number | boolean | null | { [k: string]: Json } | Json[]

// mock = betikle beslenen geliştirici kanalı, test = paneldeki test konsolu.
// İkisi de gerçek tablolara yazar ama dışarı mesaj göndermez.
export type KanalAdi = 'whatsapp' | 'instagram' | 'mock' | 'test'
export type KonusmaDurumu = 'bot' | 'devir' | 'kapali'
export type MesajYonu = 'gelen' | 'giden'
export type MesajGonderen = 'musteri' | 'bot' | 'ekip'
export type RandevuDurumu = 'bekliyor' | 'onaylandi' | 'iptal'
// Merdiven 11 Ağustos 2026'da değişti (Fatih Bey): 20 dakika → 6 saat → 25 saat.
// Eskisi 3saat → 20saat → sablon idi.
export type TakipBasamagi = '20dk' | '6saat' | 'sablon'
export type TakipDurumu = 'beklemede' | 'gonderildi' | 'iptal'
// KAPSAM Bölüm 5: sistem arızası Operiqo'ya, kalanı Fatih Bey'e.
export type BildirimHedefi = 'fatih' | 'operiqo'
export type BildirimTipi = 'randevu' | 'devir' | 'sicak' | 'sistem'
export type BildirimDurumu = 'beklemede' | 'gonderildi' | 'hata'

export type Contact = {
  id: string
  kanal: KanalAdi
  kanal_kimlik: string
  ad: string | null
  telefon: string | null
  instagram_kullanici: string | null
  notlar: string | null
  meta: Json
  created_at: string
  updated_at: string
}

export type Conversation = {
  id: string
  contact_id: string
  kanal: KanalAdi
  durum: KonusmaDurumu
  son_mesaj_at: string | null
  pencere_bitis_at: string | null
  devir_at: string | null
  okundu_at: string | null
  meta: Json
  created_at: string
  updated_at: string
}

export type Message = {
  id: string
  conversation_id: string
  yon: MesajYonu
  gonderen: MesajGonderen
  metin: string | null
  medya_url: string | null
  harici_id: string | null
  meta: Json
  created_at: string
}

export type AppointmentRequest = {
  id: string
  conversation_id: string
  istenen_zaman_metin: string | null
  arac: string | null
  hizmet: string | null
  durum: RandevuDurumu
  meta: Json
  created_at: string
  updated_at: string
}

export type Followup = {
  id: string
  conversation_id: string
  basamak: TakipBasamagi
  planlanan_at: string
  durum: TakipDurumu
  gonderildi_at: string | null
  meta: Json
  created_at: string
  updated_at: string
}

export type Notification = {
  id: string
  hedef: BildirimHedefi
  tip: BildirimTipi
  govde: string
  conversation_id: string | null
  durum: BildirimDurumu
  planlanan_at: string
  gonderildi_at: string | null
  deneme: number
  son_hata: string | null
  meta: Json
  created_at: string
  updated_at: string
}

export type Settings = {
  id: number
  calisma_saati_baslangic: string
  calisma_saati_bitis: string
  bot_aktif: boolean
  sablon_takip_aktif: boolean
  takip_aktif: boolean
  telegram_chat_id: string | null
  telegram_aktif: boolean
  meta: Json
  updated_at: string
}

export type ActivityLog = {
  id: string
  aktor: string
  tip: string
  payload: Json
  created_at: string
}

/**
 * Fatih Bey'in panelden bota eklediği içerik.
 *   bilgi    → kalıcı işletme bilgisi, sistem promptuna kalıcı girer
 *   davranis → ton/üslup notu ("daha samimi ol")
 *   reklam   → yalnızca o reklamdan gelen konuşmaya giren kampanya
 */
export type EgitimTuru = 'bilgi' | 'davranis' | 'reklam'

export type BotEgitim = {
  id: string
  tur: EgitimTuru
  baslik: string
  icerik: string
  /** Sadece tur='reklam': reklam kimliği ya da başlıkta geçen kelime. */
  anahtar: string | null
  /**
   * Sadece tur='reklam': kampanyanın son günü (YYYY-AA-GG).
   * Geçmişse bot kampanyayı SÖYLEMEZ — süresi dolmuş bir indirimi vaat etmek
   * işletmeyi bağlar (sözleşme Madde 9.2).
   */
  gecerli_bitis: string | null
  aktif: boolean
  created_at: string
  updated_at: string
}

// supabase-js şemadan Relationships alanı bekler. Join kullanmıyoruz (sorgular.ts
// ayrı sorgu + bellekte eşleme yapıyor), o yüzden boş dizi yeterli.
type Tablo<Satir, Ekle, Guncelle> = {
  Row: Satir
  Insert: Ekle
  Update: Guncelle
  Relationships: []
}

type Yeni<T, Zorunlu extends keyof T> = Partial<Omit<T, Zorunlu>> & Pick<T, Zorunlu>

export type Database = {
  public: {
    Tables: {
      contacts: Tablo<Contact, Yeni<Contact, 'kanal' | 'kanal_kimlik'>, Partial<Contact>>
      conversations: Tablo<
        Conversation,
        Yeni<Conversation, 'contact_id' | 'kanal'>,
        Partial<Conversation>
      >
      messages: Tablo<
        Message,
        Yeni<Message, 'conversation_id' | 'yon' | 'gonderen'>,
        Partial<Message>
      >
      appointment_requests: Tablo<
        AppointmentRequest,
        Yeni<AppointmentRequest, 'conversation_id'>,
        Partial<AppointmentRequest>
      >
      followups: Tablo<
        Followup,
        Yeni<Followup, 'conversation_id' | 'basamak' | 'planlanan_at'>,
        Partial<Followup>
      >
      notifications: Tablo<
        Notification,
        Yeni<Notification, 'hedef' | 'tip' | 'govde'>,
        Partial<Notification>
      >
      settings: Tablo<Settings, Yeni<Settings, 'id'>, Partial<Settings>>
      activity_log: Tablo<ActivityLog, Yeni<ActivityLog, 'aktor' | 'tip'>, Partial<ActivityLog>>
      bot_egitim: Tablo<
        BotEgitim,
        Yeni<BotEgitim, 'tur' | 'baslik' | 'icerik'>,
        Partial<BotEgitim>
      >
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
