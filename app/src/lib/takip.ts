// Takip merdiveni. KAPSAM karar 6.
//
//   20. dakika → pencere içi, ÜCRETSİZ ("listemize bakabildiniz mi")
//   6. saat    → pencere içi, ÜCRETSİZ
//   25. saat   → tek onaylı şablon, ÜCRETLİ (settings.sablon_takip_aktif KAPALI gelir)
//
// ⚠ Süreler 11 Ağustos 2026'da Fatih Bey'in isteğiyle değişti: eskiden
// 3. saat → 20. saat → 25. saat idi. Gerekçe: fiyat listesi gönderildikten
// kısa süre sonra "bakabildiniz mi" diye dönmek sahadaki satış pratiğine daha
// yakın; 3 saat beklemek müşteriyi soğutuyor.
//
// Kesme koşulları: müşteri cevap verdi, ilgilenmediğini söyledi, ekip devraldı,
// randevu onaylandı ya da yazışma kapandı.
//
// Zamanlar müşterinin SON mesajından sayılır, çünkü Meta'nın 24 saatlik müşteri
// hizmetleri penceresi de oradan başlar (KAPSAM Bölüm 6).
//
// NOT: Takip metinleri arşivdeki gerçek yazışmalardan türetildi. Fatih Bey'in
// bugüne kadar düzenli bir takip pratiği YOK (904 sohbette hatırlatma kalıbı
// bulunamadı; 242 mesaj cevapsız kalmış). Yani bu, sistemin getirdiği yeni
// davranış; metinler onun ağzından ama sahadan birebir kopya değil.

import 'server-only'

import { gidenMesajGonder } from '@/lib/mesajlar'
import { mesaiDisiMi, sonrakiYerelSaat, VARSAYILAN_BASLANGIC } from '@/lib/motor/saat'
import { supabaseServis } from '@/lib/supabase/sunucu'
import type { Json, TakipBasamagi } from '@/lib/db/types'

/**
 * Müşterinin son mesajından itibaren kaçıncı DAKİKADA hangi basamak.
 * Birim dakika: ilk basamak saatten kısa (20 dk), saat cinsi yetmiyor.
 */
export const MERDIVEN: { basamak: TakipBasamagi; dakika: number; ucretli: boolean }[] = [
  { basamak: '20dk', dakika: 20, ucretli: false },
  { basamak: '6saat', dakika: 6 * 60, ucretli: false },
  // Pencere 24. saatte kapanır; şablon ondan sonra gider.
  { basamak: 'sablon', dakika: 25 * 60, ucretli: true },
]

/**
 * Varsayılan takip metinleri.
 * Kaynak cümleler arşivden: "Müsait olduğunuzda dönerseniz aracınızın bilgilerini
 * alabilirim", "Müsaitseniz buyrun gelin burada daha net yardımcı olalım size".
 * Ayarlardan değiştirilebilir (settings.meta.takip_metinleri).
 */
export const VARSAYILAN_METINLER: Record<TakipBasamagi, string> = {
  // Fatih Bey (11 Ağustos): "listemize vs. bakabildiniz mi şeklinde, bağlama uygun".
  // Fiyat/liste gönderilmemiş bir yazışmada bu cümle anlamsız kaçacağı için
  // metin gönderim anında bağlama göre seçiliyor (bkz. takipMetniSec).
  '20dk': 'Fiyat listemize bakabildiniz mi? Aklınıza takılan bir şey olursa buradayım.',
  '6saat':
    'Müsait olduğunuzda dönerseniz aracınızın bilgilerini alabilirim. Müsaitseniz buyrun gelin, burada daha net yardımcı olalım size.',
  sablon:
    'Merhabalar, aracınızla ilgili görüşmemiz yarım kalmıştı. Hâlâ ilgileniyorsanız yardımcı olmaktan memnuniyet duyarız.',
}

/**
 * 20. dakika metni bağlama uyarlanır (Fatih Bey: "bağlama uygun olacak").
 *
 * Yazışmada fiyat ya da liste görseli gittiyse "listemize bakabildiniz mi"
 * doğru cümle. Gitmediyse — müşteri henüz aracını yazmamışsa, konu adres/saat
 * ise — aynı cümle saçma kaçar; orada nötr hatırlatma gider.
 */
export function takipMetniSec(
  basamak: TakipBasamagi,
  metinler: Record<TakipBasamagi, string>,
  fiyatGonderildiMi: boolean,
): string {
  if (basamak === '20dk' && !fiyatGonderildiMi) {
    return 'Aklınıza takılan bir şey olursa buradayım, yardımcı olayım.'
  }
  return metinler[basamak]
}

type TakipMetinleri = Partial<Record<TakipBasamagi, string>>

async function ayarlariOku(): Promise<{
  takipAktif: boolean
  sablonAktif: boolean
  metinler: Record<TakipBasamagi, string>
}> {
  const db = supabaseServis()
  const { data } = await db
    .from('settings')
    .select('takip_aktif, sablon_takip_aktif, meta')
    .eq('id', 1)
    .maybeSingle()

  const ham = (data?.meta as { takip_metinleri?: TakipMetinleri } | null)?.takip_metinleri ?? {}

  return {
    takipAktif: data?.takip_aktif ?? true,
    sablonAktif: data?.sablon_takip_aktif ?? false,
    metinler: {
      '20dk': ham['20dk']?.trim() || VARSAYILAN_METINLER['20dk'],
      '6saat': ham['6saat']?.trim() || VARSAYILAN_METINLER['6saat'],
      sablon: ham.sablon?.trim() || VARSAYILAN_METINLER.sablon,
    },
  }
}

/**
 * Takip mesajı gece yarısı gitmez. Planlanan an mesai dışına düşerse
 * sabah açılışa (08:00) kaydırılır — KAPSAM karar 5'in takip kuyruğuna yansıması.
 */
export function mesaiyeKaydir(an: Date): Date {
  if (!mesaiDisiMi(an)) return an
  return sonrakiYerelSaat(VARSAYILAN_BASLANGIC, an)
}

/**
 * Konuşma için takip merdivenini (yeniden) planlar.
 * Bot cevap verdikten sonra çağrılır. Müşteri her yazdığında saat sıfırlanır:
 * eski bekleyen satırlar iptal edilip yenileri kurulur.
 */
export async function takipPlanla(konusmaId: string, referans: Date = new Date()): Promise<void> {
  const db = supabaseServis()
  const { takipAktif } = await ayarlariOku()

  // Önce bu konuşmanın bekleyen takiplerini temizle: müşteri yeni yazdıysa
  // merdiven baştan başlar.
  await db
    .from('followups')
    .update({ durum: 'iptal', meta: { sebep: 'yeniden-planlandi' } as Json })
    .eq('conversation_id', konusmaId)
    .eq('durum', 'beklemede')

  if (!takipAktif) return

  for (const adim of MERDIVEN) {
    const planlanan = mesaiyeKaydir(
      new Date(referans.getTime() + adim.dakika * 60_000),
    )

    // Aynı (konuşma, basamak) çifti için benzersiz indeks var; upsert ile
    // iptal edilmiş eski satırı yeniden beklemeye alıyoruz.
    //
    // referans_at: merdivenin kurulduğu an. Gönderim anında "müşteri arada
    // yazdı mı" sorusu buna göre cevaplanır. Planlanan andan saat farkını geri
    // çıkararak hesaplamak YANLIŞ olurdu: merdiven zaten müşterinin son
    // mesajından kurulduğu için o hesap her takibi "müşteri cevap verdi" diye
    // iptal ediyordu.
    await db.from('followups').upsert(
      {
        conversation_id: konusmaId,
        basamak: adim.basamak,
        planlanan_at: planlanan.toISOString(),
        durum: 'beklemede',
        gonderildi_at: null,
        meta: { referans_at: referans.toISOString() } as Json,
      },
      { onConflict: 'conversation_id,basamak' },
    )
  }
}

/** Merdiveni durdurur. Müşteri yazdı, ekip devraldı, randevu onaylandı vb. */
export async function takipleriIptalEt(konusmaId: string, sebep: string): Promise<void> {
  const db = supabaseServis()
  await db
    .from('followups')
    .update({ durum: 'iptal', meta: { sebep } as Json })
    .eq('conversation_id', konusmaId)
    .eq('durum', 'beklemede')
}

/**
 * Zamanı gelmiş takipleri gönderir. Cron'un işi.
 *
 * Gönderim anında son kez kontrol edilir: konuşma hâlâ botta mı, müşteri
 * arada yazmış mı, şablon basamağı açık mı. Planlama anında doğru olan şey
 * gönderim anında yanlış olabilir.
 */
export async function bekleyenTakipleriGonder(
  an: Date = new Date(),
): Promise<{ gonderildi: number; iptal: number }> {
  const db = supabaseServis()
  const { takipAktif, sablonAktif, metinler } = await ayarlariOku()

  if (!takipAktif) return { gonderildi: 0, iptal: 0 }

  const { data: kuyruk } = await db
    .from('followups')
    .select('id, conversation_id, basamak, planlanan_at, meta')
    .eq('durum', 'beklemede')
    .lte('planlanan_at', an.toISOString())
    .order('planlanan_at', { ascending: true })
    .limit(50)

  let gonderildi = 0
  let iptal = 0

  for (const satir of kuyruk ?? []) {
    const basamak = satir.basamak as TakipBasamagi

    // Merdiven değişince (11 Ağustos: 3saat/20saat → 20dk/6saat) veritabanında
    // eski basamak adıyla bekleyen satırlar kalıyor. Bunların metni yok;
    // korumasız bırakılırsa müşteriye BOŞ mesaj gider. Tanımadığımız basamağı
    // göndermek yerine iptal ediyoruz.
    if (!MERDIVEN.some((m) => m.basamak === basamak)) {
      await db
        .from('followups')
        .update({ durum: 'iptal', meta: { sebep: 'bilinmeyen-basamak' } as Json })
        .eq('id', satir.id)
      iptal += 1
      continue
    }

    // Şablon basamağı Meta onayı gelene kadar kapalı (KAPSAM Madde 4.3).
    if (basamak === 'sablon' && !sablonAktif) {
      await db
        .from('followups')
        .update({ durum: 'iptal', meta: { sebep: 'sablon-kapali' } as Json })
        .eq('id', satir.id)
      iptal += 1
      continue
    }

    const { data: konusma } = await db
      .from('conversations')
      .select('id, durum, son_mesaj_at')
      .eq('id', satir.conversation_id)
      .maybeSingle()

    if (!konusma) {
      await db.from('followups').update({ durum: 'iptal' }).eq('id', satir.id)
      iptal += 1
      continue
    }

    // Ekip devraldıysa ya da yazışma kapandıysa bot araya girmez.
    if (konusma.durum !== 'bot') {
      await db
        .from('followups')
        .update({ durum: 'iptal', meta: { sebep: `konusma-${konusma.durum}` } as Json })
        .eq('id', satir.id)
      iptal += 1
      continue
    }

    // Müşteri merdiven kurulduktan SONRA yazdıysa takip anlamsız: ya konuşma
    // devam ediyor ya da merdiven yeniden kurulmuş, bu satır artıktır.
    const referansHam = (satir.meta as { referans_at?: string } | null)?.referans_at
    const referans = referansHam ? new Date(referansHam) : null
    const sonGelen = await sonMusteriMesajiZamani(satir.conversation_id)

    if (referans && sonGelen && sonGelen.getTime() > referans.getTime()) {
      await db
        .from('followups')
        .update({ durum: 'iptal', meta: { sebep: 'musteri-cevap-verdi' } as Json })
        .eq('id', satir.id)
      iptal += 1
      continue
    }

    // "Listemize bakabildiniz mi" ancak gerçekten liste/fiyat gittiyse anlamlı.
    // Fiyat mesajlarında ₺ geçer; fiyat listesi görselinde medya_url dolar.
    const { data: fiyatIzi } = await db
      .from('messages')
      .select('id')
      .eq('conversation_id', satir.conversation_id)
      .eq('yon', 'giden')
      .or('metin.ilike.%₺%,medya_url.not.is.null')
      .limit(1)

    const metin = takipMetniSec(basamak, metinler, (fiyatIzi?.length ?? 0) > 0)

    try {
      await gidenMesajGonder(satir.conversation_id, metin, 'bot', {
        takip: basamak,
      } as Json)

      await db
        .from('followups')
        .update({ durum: 'gonderildi', gonderildi_at: an.toISOString() })
        .eq('id', satir.id)

      await db.from('activity_log').insert({
        aktor: 'bot',
        tip: 'takip_gonderildi',
        payload: { konusma_id: satir.conversation_id, basamak } as Json,
      })

      gonderildi += 1
    } catch (e) {
      const hata = e instanceof Error ? e.message : 'bilinmeyen hata'
      await db
        .from('followups')
        .update({ meta: { son_hata: hata } as Json })
        .eq('id', satir.id)
    }
  }

  return { gonderildi, iptal }
}

async function sonMusteriMesajiZamani(konusmaId: string): Promise<Date | null> {
  const db = supabaseServis()
  const { data } = await db
    .from('messages')
    .select('created_at')
    .eq('conversation_id', konusmaId)
    .eq('yon', 'gelen')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data?.created_at ? new Date(data.created_at) : null
}
