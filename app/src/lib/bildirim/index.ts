// Bildirim kuralları. KAPSAM Bölüm 5'in kodu burasıdır.
//
// | Ne olduğunda        | Kime      | Ne zaman                                |
// |---------------------|-----------|-----------------------------------------|
// | Randevu talebi      | Fatih Bey | anlık, her saat                         |
// | Devir gerekiyor     | Fatih Bey | anlık, her saat                         |
// | Sıcak müşteri       | Fatih Bey | 08:00-00:00 anlık, gece sabaha ertelenir |
// | Sistem sorunu       | Operiqo   | anlık                                   |
//
// Her bildirim önce KUYRUĞA yazılır, sonra gönderilmeye çalışılır. Sebep:
//   1. Gece gelen sıcak müşteri bildirimi sabah 08:00'e ertelenmeli.
//   2. Telegram o an cevap vermezse bildirim kaybolmamalı; cron yeniden dener.
// Bu yüzden "gönderemedim" bir hata değil, kuyrukta bekleyen iştir.

import 'server-only'

import { operiqoChatId } from '@/lib/env'
import { sonrakiYerelSaat, yerelSaat } from '@/lib/motor/saat'
import { supabaseServis } from '@/lib/supabase/sunucu'
import type { BildirimHedefi, BildirimTipi, Json } from '@/lib/db/types'
import type { YapiliCikti } from '@/lib/motor'
import { htmlKacir, konusmaBaglantisi, telegramGonder } from './telegram'

/** Sıcak müşteri bildirimlerinin susturulduğu saatler (KAPSAM Bölüm 5). */
export const SESSIZ_BASLANGIC = '00:00'
export const SESSIZ_BITIS = '08:00'

/** Bu kadar denemeden sonra cron o satırla uğraşmayı bırakır. */
export const AZAMI_DENEME = 5

export type BildirimGirdi = {
  hedef: BildirimHedefi
  tip: BildirimTipi
  govde: string
  konusmaId?: string | null
  /** Verilmezse "şimdi". Sıcak müşteri gece geldiyse sabah 08:00 olur. */
  planlananAt?: Date
  meta?: Json
}

/** Sıcak müşteri bildirimi bu saatte gelirse ertelenir mi. */
export function sessizSaatteMi(an: Date = new Date()): boolean {
  const [saat] = yerelSaat(an).split(':')
  const s = Number.parseInt(saat, 10)
  return s >= 0 && s < 8
}

/**
 * Bildirimi kuyruğa yazar ve hemen göndermeyi dener.
 * Gönderim başarısızsa satır kuyrukta kalır, cron tekrar dener.
 */
export async function bildirimGonder(girdi: BildirimGirdi): Promise<void> {
  const db = supabaseServis()

  const planlanan = girdi.planlananAt ?? new Date()

  const { data, error } = await db
    .from('notifications')
    .insert({
      hedef: girdi.hedef,
      tip: girdi.tip,
      govde: girdi.govde,
      conversation_id: girdi.konusmaId ?? null,
      planlanan_at: planlanan.toISOString(),
      ...(girdi.meta === undefined ? {} : { meta: girdi.meta }),
    })
    .select('id')
    .single()

  if (error || !data) {
    // Bildirim yazılamadıysa bile müşteriye cevap gitmeye devam etmeli.
    console.error('[bildirim] kuyruğa yazılamadı:', error?.message)
    return
  }

  // Geleceğe planlandıysa şimdi gönderme, cron zamanı gelince alır.
  if (planlanan.getTime() > Date.now() + 30_000) return

  await tekBildirimiGonder(data.id)
}

/** Kuyruktaki tek bir satırı gönderir. Cron ve anlık yol aynı fonksiyonu kullanır. */
export async function tekBildirimiGonder(bildirimId: string): Promise<boolean> {
  const db = supabaseServis()

  const { data: bildirim } = await db
    .from('notifications')
    .select('id, hedef, govde, conversation_id, durum, deneme')
    .eq('id', bildirimId)
    .maybeSingle()

  if (!bildirim || bildirim.durum !== 'beklemede') return false

  const chatId = await hedefChatId(bildirim.hedef)
  if (!chatId) {
    await kusurYaz(bildirimId, bildirim.deneme, 'Telegram chat kimliği tanımlı değil')
    return false
  }

  const butonlar = bildirim.conversation_id
    ? [{ metin: 'Panelde aç', url: konusmaBaglantisi(bildirim.conversation_id) }]
    : []

  const sonuc = await telegramGonder(chatId, bildirim.govde, butonlar)

  if (!sonuc.basarili) {
    await kusurYaz(bildirimId, bildirim.deneme, sonuc.hata)
    return false
  }

  await db
    .from('notifications')
    .update({
      durum: 'gonderildi',
      gonderildi_at: new Date().toISOString(),
      deneme: bildirim.deneme + 1,
      son_hata: null,
    })
    .eq('id', bildirimId)

  return true
}

async function kusurYaz(id: string, deneme: number, hata: string): Promise<void> {
  const db = supabaseServis()
  const yeniDeneme = deneme + 1
  await db
    .from('notifications')
    .update({
      deneme: yeniDeneme,
      son_hata: hata.slice(0, 500),
      // Denemeler tükendiyse kuyruktan düşür ki cron sonsuza kadar uğraşmasın.
      ...(yeniDeneme >= AZAMI_DENEME ? { durum: 'hata' as const } : {}),
    })
    .eq('id', id)
}

async function hedefChatId(hedef: BildirimHedefi): Promise<string | null> {
  if (hedef === 'operiqo') return operiqoChatId()

  const db = supabaseServis()
  const { data } = await db
    .from('settings')
    .select('telegram_chat_id, telegram_aktif')
    .eq('id', 1)
    .maybeSingle()

  if (!data?.telegram_aktif) return null
  return data.telegram_chat_id?.trim() || null
}

// ---------------------------------------------------------------------------
// Gövde kurucuları — Telegram HTML. Değişken içerik htmlKacir()'den geçer.
// ---------------------------------------------------------------------------

function kisiSatiri(kisiAdi: string | null, kanal: string): string {
  const ad = kisiAdi?.trim() ? htmlKacir(kisiAdi.trim()) : 'İsimsiz kişi'
  return `<b>${ad}</b> · ${htmlKacir(kanal)}`
}

function alanSatiri(etiket: string, deger: string | null): string {
  if (!deger?.trim()) return ''
  return `\n${etiket}: ${htmlKacir(deger.trim())}`
}

export function randevuGovdesi(
  kisiAdi: string | null,
  kanal: string,
  yapili: YapiliCikti,
): string {
  return (
    `📅 <b>Randevu talebi</b>\n\n` +
    kisiSatiri(kisiAdi, kanal) +
    alanSatiri('İstenen zaman', yapili.randevu_talebi) +
    alanSatiri('Araç', yapili.arac) +
    alanSatiri('Kapsam', yapili.kapsam) +
    `\n\nPanelden onaylayın, teyit mesajını bot yazacak.`
  )
}

const DEVIR_SEBEP_METNI: Record<string, string> = {
  'pazarlik-indirim': 'İndirim / pazarlık',
  'liste-disi-is': 'Fiyat listesi dışı iş',
  'coklu-arac': 'Birden fazla araç',
  sikayet: 'Şikâyet',
  'insan-istedi': 'Müşteri insanla görüşmek istiyor',
  'emin-degil': 'Bot emin değil',
}

export function devirGovdesi(
  kisiAdi: string | null,
  kanal: string,
  yapili: YapiliCikti,
): string {
  const sebep = yapili.devir_sebebi
    ? (DEVIR_SEBEP_METNI[yapili.devir_sebebi] ?? yapili.devir_sebebi)
    : 'Belirtilmedi'

  return (
    `🔔 <b>Devir gerekiyor</b>\n\n` +
    kisiSatiri(kisiAdi, kanal) +
    `\nSebep: ${htmlKacir(sebep)}` +
    alanSatiri('Araç', yapili.arac) +
    alanSatiri('Kapsam', yapili.kapsam) +
    `\n\n15 dakika içinde yazılmazsa bot "ekibimiz birazdan dönecek" diyecek.`
  )
}

export function sicakGovdesi(
  kisiAdi: string | null,
  kanal: string,
  yapili: YapiliCikti,
): string {
  return (
    `🔥 <b>Sıcak müşteri</b>\n\n` +
    kisiSatiri(kisiAdi, kanal) +
    alanSatiri('Araç', yapili.arac) +
    alanSatiri('Kapsam', yapili.kapsam) +
    `\nDurum: fiyat konuşuluyor`
  )
}

export function sistemGovdesi(baslik: string, ayrinti: string): string {
  return `⚠️ <b>Sistem sorunu</b>\n\n${htmlKacir(baslik)}\n\n<code>${htmlKacir(ayrinti.slice(0, 900))}</code>`
}

/**
 * Arıza sınıfı. Ham hata İngilizce ve teknik; işletmenin göreceği mesaj
 * "ne oldu, ne yapmalıyım" sorusunu cevaplamalı.
 */
type ArizaSinifi = 'bakiye' | 'sinir' | 'genel'

function arizaSinifla(ayrinti: string): ArizaSinifi {
  const k = ayrinti.toLowerCase()
  if (
    k.includes('insufficient_quota') ||
    k.includes('credit_balance_exhausted') ||
    k.includes('no credits remaining') ||
    // Anthropic'in sözcüğü: "Your credit balance is too low to access the API".
    k.includes('credit balance is too low') ||
    k.includes('billing')
  ) {
    return 'bakiye'
  }
  if (k.includes('rate limit') || k.includes('rate_limit') || k.includes('quota')) return 'sinir'
  return 'genel'
}

const ARIZA_METNI: Record<ArizaSinifi, string> = {
  bakiye:
    '⚠️ <b>Bot şu an cevap veremiyor</b>\n\n' +
    'Yapay zeka hesabındaki bakiye bitti. Kredi yüklenene kadar gelen mesajlara otomatik cevap gitmeyecek.\n\n' +
    'Bu sürede yazan müşterilere panelden elle cevap yazabilirsiniz.',
  sinir:
    '⚠️ <b>Bot geçici olarak cevap veremedi</b>\n\n' +
    'Yapay zeka anlık yoğunluk sınırına takıldı. Genelde kendiliğinden düzelir; ' +
    'sürerse bize haber verin.',
  genel:
    '⚠️ <b>Bot şu an cevap veremiyor</b>\n\n' +
    'Teknik bir aksaklık oluştu ve kaydedildi. Bu sürede yazan müşterilere panelden ' +
    'elle cevap yazabilirsiniz.',
}

/** Aynı arıza için bu süre içinde tek bildirim gider. */
const ARIZA_SUSTURMA_DK = 30

/**
 * İşletmeye arıza bildirimi: bot susuyorsa Fatih Bey bunu müşteriden değil
 * bizden öğrenmeli (İsa kararı, 11 Ağustos).
 *
 * Öncesinde bu uyarı `operiqo` hedefine gidiyordu ve `TELEGRAM_OPERIQO_CHAT_ID`
 * hiç tanımlanmadığı için fonksiyon ilk satırda sessizce çıkıyordu: 11 Ağustos'ta
 * bakiye bittiğinde kuyruğa tek satır bile yazılmadı, kimsenin haberi olmadı.
 * Artık kurulu ve çalışan tek hedefe — Fatih Bey'e — gidiyor.
 *
 * Susturma şart: bakiye bittiğinde her gelen müşteri mesajı bir arıza üretir,
 * bastırılmazsa Telegram bildirime boğulur ve bildirim değerini yitirir.
 */
export async function sistemUyarisi(baslik: string, ayrinti: string): Promise<void> {
  const sinif = arizaSinifla(ayrinti)
  const db = supabaseServis()

  const esik = new Date(Date.now() - ARIZA_SUSTURMA_DK * 60_000).toISOString()
  const { data: yakin } = await db
    .from('notifications')
    .select('id')
    .eq('tip', 'sistem')
    .eq('meta->>sinif', sinif)
    .gte('created_at', esik)
    .limit(1)

  if (yakin && yakin.length > 0) return

  await bildirimGonder({
    hedef: 'fatih',
    tip: 'sistem',
    govde: ARIZA_METNI[sinif],
    // Teknik ayrıntı Telegram'a değil kayda gider; teşhis buradan yapılır.
    meta: { sinif, baslik, ayrinti: ayrinti.slice(0, 500) } as Json,
  })
}

/**
 * Bot bir tur cevap verdikten sonra çağrılır: hangi bildirimlerin gideceğine
 * yapılandırılmış çıktıya bakarak karar verir.
 *
 * Sıcak müşteri tanımı (KAPSAM Bölüm 5): araç bilgisi + fiyat sorusu.
 * Devir ya da randevu zaten bildirim ürettiyse sıcak bildirimi tekrarlanmaz —
 * aynı olay için Fatih Bey'e iki mesaj gitmesin.
 */
export async function botTurundanSonraBildir(
  konusmaId: string,
  kisiAdi: string | null,
  kanal: string,
  yapili: YapiliCikti,
  an: Date = new Date(),
): Promise<void> {
  const isler: Promise<void>[] = []

  if (yapili.randevu_talebi) {
    isler.push(
      bildirimGonder({
        hedef: 'fatih',
        tip: 'randevu',
        govde: randevuGovdesi(kisiAdi, kanal, yapili),
        konusmaId,
      }),
    )
  }

  if (yapili.devir_gerekli_mi) {
    isler.push(
      bildirimGonder({
        hedef: 'fatih',
        tip: 'devir',
        govde: devirGovdesi(kisiAdi, kanal, yapili),
        konusmaId,
      }),
    )
  }

  const sicakMi =
    !yapili.randevu_talebi &&
    !yapili.devir_gerekli_mi &&
    yapili.arac !== null &&
    (yapili.niyet === 'fiyat-net' || yapili.niyet === 'fiyat-genel')

  if (sicakMi) {
    isler.push(
      bildirimGonder({
        hedef: 'fatih',
        tip: 'sicak',
        govde: sicakGovdesi(kisiAdi, kanal, yapili),
        konusmaId,
        // Gece gelen sıcak müşteri sabah 08:00'de haber verilir.
        planlananAt: sessizSaatteMi(an) ? sonrakiYerelSaat(SESSIZ_BITIS, an) : an,
      }),
    )
  }

  await Promise.all(isler)
}

/** Cron'un işi: zamanı gelmiş bekleyen bildirimleri gönderir. */
export async function bekleyenBildirimleriGonder(
  an: Date = new Date(),
): Promise<{ gonderildi: number; basarisiz: number }> {
  const db = supabaseServis()

  const { data: kuyruk } = await db
    .from('notifications')
    .select('id')
    .eq('durum', 'beklemede')
    .lte('planlanan_at', an.toISOString())
    .order('planlanan_at', { ascending: true })
    .limit(50)

  let gonderildi = 0
  let basarisiz = 0
  for (const satir of kuyruk ?? []) {
    if (await tekBildirimiGonder(satir.id)) gonderildi += 1
    else basarisiz += 1
  }

  return { gonderildi, basarisiz }
}

export { htmlKacir, konusmaBaglantisi, sonChatIdYakala, telegramGonder } from './telegram'
