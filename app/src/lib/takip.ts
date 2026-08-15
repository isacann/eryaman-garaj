// Takip merdiveni. KAPSAM karar 6.
//
//   3. saat  → ÜCRETSİZ ("listemize bakabildiniz mi")
//   20. saat → ÜCRETSİZ
//
// ⚠ Süreler 14 Ağustos 2026'da iki kez değişti (Fatih Bey):
//   · 20 dakikalık ilk basamak KALDIRILDI — sahada fazla ısrarcı kaçıyordu.
//     (11 Ağustos'ta 3saat/20saat yerine 20dk/6saat denenmişti, geri dönüldü.)
//   · 25. saat ŞABLON basamağı KALDIRILDI — WhatsApp artık Evolution üzerinden
//     gidiyor; Meta'nın onaylı şablon mekanizması ve 24 saatlik müşteri
//     hizmetleri penceresi burada YOK. Şablon, pencere kapandıktan sonra mesaj
//     atabilmek içindi; pencere olmayınca basamağın da anlamı kalmadı.
//
// ⚠ Instagram hâlâ Meta'da ve orada 24 saat penceresi GEÇERLİ. Instagram
// bağlandığında pencere dışı takip gönderilemeyecek; o kanal için ayrı bir
// karar gerekir (bugün konu değil, Instagram gelen mesajı henüz işlemiyor).
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
import { PROAKTIF_BASLANGIC, proaktifSessizMi, sonrakiYerelSaat } from '@/lib/motor/saat'
import { supabaseServis } from '@/lib/supabase/sunucu'
import { hatirlatmaAni, randevuHatirlatmaMetni } from '@/lib/randevu'
import { RANDEVU_HATIRLATMA, type Json, type TakipBasamagi } from '@/lib/db/types'

/**
 * Müşterinin son mesajından itibaren kaçıncı DAKİKADA hangi basamak.
 * Birim dakika: ilk basamak saatten kısa (20 dk), saat cinsi yetmiyor.
 */
export const MERDIVEN: { basamak: TakipBasamagi; dakika: number; ucretli: boolean }[] = [
  { basamak: '3saat', dakika: 3 * 60, ucretli: false },
  { basamak: '20saat', dakika: 20 * 60, ucretli: false },
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
  '3saat': 'Fiyat listemize bakabildiniz mi? Aklınıza takılan bir şey olursa buradayım.',
  '20saat':
    'Müsait olduğunuzda dönerseniz aracınızın bilgilerini alabilirim. Müsaitseniz buyrun gelin, burada daha net yardımcı olalım size.',
}

/**
 * İlk basamağın metni bağlama uyarlanır (Fatih Bey: "bağlama uygun olacak").
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
  if (basamak === '3saat' && !fiyatGonderildiMi) {
    return 'Aklınıza takılan bir şey olursa buradayım, yardımcı olayım.'
  }
  return metinler[basamak]
}

type TakipMetinleri = Partial<Record<TakipBasamagi, string>>

async function ayarlariOku(): Promise<{
  takipAktif: boolean
  metinler: Record<TakipBasamagi, string>
}> {
  const db = supabaseServis()
  // sablon_takip_aktif kolonu şemada duruyor ama artık okunmuyor: şablon
  // basamağı kaldırıldı (Evolution'da onaylı şablon yok). Kolon, ileride
  // Meta Cloud API'ye dönülürse diye bırakıldı.
  const { data } = await db
    .from('settings')
    .select('takip_aktif, meta')
    .eq('id', 1)
    .maybeSingle()

  const ham = (data?.meta as { takip_metinleri?: TakipMetinleri } | null)?.takip_metinleri ?? {}

  return {
    takipAktif: data?.takip_aktif ?? true,
    metinler: {
      '3saat': ham['3saat']?.trim() || VARSAYILAN_METINLER['3saat'],
      '20saat': ham['20saat']?.trim() || VARSAYILAN_METINLER['20saat'],
    },
  }
}

/**
 * Botun kendi başlattığı mesaj gece gitmez. Planlanan an proaktif pencerenin
 * (08:00–22:00) dışına düşerse sabah açılışa kaydırılır.
 *
 * ⚠ 15 Ağustos: burası eskiden `mesaiDisiMi` bakıyordu, yani 01:00'e kadar
 * "gönderilebilir" sayıyordu ve takip mesajı sahada 00:50'de gitti. Mesai
 * penceresi gelen mesaja CEVABI yönetir; botun kendi başlattığı mesajın penceresi
 * ayrıdır (bkz. saat.ts / PROAKTIF_BITIS).
 */
export function proaktifeKaydir(an: Date): Date {
  if (!proaktifSessizMi(an)) return an
  return sonrakiYerelSaat(PROAKTIF_BASLANGIC, an)
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
  //
  // ⚠ Randevu hatırlatması bu temizliğin DIŞINDA tutulur. O, müşterinin son
  // mesajından değil randevu tarihinden sayılıyor; müşteri araya yazdı diye
  // iptal edilirse randevusunu konuşan her müşteri hatırlatmasını kaybederdi.
  await db
    .from('followups')
    .update({ durum: 'iptal', meta: { sebep: 'yeniden-planlandi' } as Json })
    .eq('conversation_id', konusmaId)
    .eq('durum', 'beklemede')
    .neq('basamak', RANDEVU_HATIRLATMA)

  if (!takipAktif) return

  for (const adim of MERDIVEN) {
    const planlanan = proaktifeKaydir(
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
    // Randevu hatırlatması merdivenin parçası değil: ekip devralsa bile
    // müşteriye "yarın aracınızı getirecektiniz" demek doğru kalır.
    .neq('basamak', RANDEVU_HATIRLATMA)
}

/**
 * Randevu hatırlatmasını planlar (ya da randevu değiştiyse yeniden planlar).
 *
 * `randevuAt` null ise bekleyen hatırlatma iptal edilir: zaman netliğini
 * kaybetmiş bir randevu için "yarın görüşüyoruz" demek yanlış olur.
 *
 * Hatırlatma randevudan 24 saat önce gider; o an mesai dışına düşerse sabah
 * açılışa kaydırılır. Randevuya 24 saatten az kaldıysa hiç kurulmaz — müşteri
 * bugün için randevu aldıysa ona "yarın" demek anlamsız.
 */
export async function randevuHatirlatmasiPlanla(
  konusmaId: string,
  randevuAt: string | null,
  simdi: Date = new Date(),
): Promise<void> {
  const db = supabaseServis()

  if (!randevuAt) {
    await db
      .from('followups')
      .update({ durum: 'iptal', meta: { sebep: 'randevu-zamani-yok' } as Json })
      .eq('conversation_id', konusmaId)
      .eq('basamak', RANDEVU_HATIRLATMA)
      .eq('durum', 'beklemede')
    return
  }

  const randevu = new Date(randevuAt)
  if (Number.isNaN(randevu.getTime())) return

  // null = geleceğe düşen uygun bir an kalmamış (randevuya 2 saatten az var).
  const hedef = hatirlatmaAni(randevu, simdi)
  if (!hedef) return

  const planlanan = proaktifeKaydir(hedef)

  await db.from('followups').upsert(
    {
      conversation_id: konusmaId,
      basamak: RANDEVU_HATIRLATMA,
      planlanan_at: planlanan.toISOString(),
      durum: 'beklemede',
      gonderildi_at: null,
      // randevu_at gönderim anında tekrar okunuyor; buradaki kopya yalnızca iz.
      meta: { randevu_at: randevu.toISOString() } as Json,
    },
    { onConflict: 'conversation_id,basamak' },
  )
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
  const { takipAktif, metinler } = await ayarlariOku()

  if (!takipAktif) return { gonderildi: 0, iptal: 0 }

  // ⛔ İKİNCİ KAPI (15 Ağustos). Planlama anında proaktifeKaydir zaten geceyi
  // sabaha atıyor, ama kuyrukta eski kurallarla planlanmış satırlar ve gecikmiş
  // cron turları var. Gece hiçbir şey göndermemek, o satırların sabahı
  // beklemesi demektir — kaybolmazlar, 08:00 turunda gönderilirler.
  if (proaktifSessizMi(an)) return { gonderildi: 0, iptal: 0 }

  const { data: kuyruk } = await db
    .from('followups')
    .select('id, conversation_id, basamak, planlanan_at, meta')
    .eq('durum', 'beklemede')
    .lte('planlanan_at', an.toISOString())
    // Randevu hatırlatmasının kuralları farklı (müşteri yazsa da gider, ekip
    // devralsa da gider); onu randevuHatirlatmalariniGonder işliyor. Burada
    // elenmezse aşağıdaki "bilinmeyen basamak" koruması onu iptal ederdi.
    .neq('basamak', RANDEVU_HATIRLATMA)
    .order('planlanan_at', { ascending: true })
    .limit(50)

  let gonderildi = 0
  let iptal = 0

  for (const satir of kuyruk ?? []) {
    const basamak = satir.basamak as TakipBasamagi

    // Merdiven her değiştiğinde veritabanında eski basamak adıyla bekleyen
    // satırlar kalıyor (14 Ağustos: 20dk/6saat → 3saat/20saat, ayrıca 'sablon'
    // tamamen kaldırıldı). Bunların metni yok; korumasız bırakılırsa müşteriye
    // BOŞ mesaj gider. Tanımadığımız basamağı göndermek yerine iptal ediyoruz.
    if (!MERDIVEN.some((m) => m.basamak === basamak)) {
      await db
        .from('followups')
        .update({ durum: 'iptal', meta: { sebep: 'bilinmeyen-basamak' } as Json })
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

/**
 * Zamanı gelmiş RANDEVU HATIRLATMALARINI gönderir. Cron'un işi.
 *
 * Takip merdiveninden ayrı tutulmasının sebebi kuralların ters olması:
 *   · Merdiven müşteri yazınca iptal olur — hatırlatma OLMAZ, randevu duruyor.
 *   · Merdiven ekip devralınca durur — hatırlatma DURMAZ, randevu yine geçerli.
 *   · Merdiven müşterinin son mesajından sayılır — hatırlatma randevudan.
 *
 * Gönderim anında randevunun hâlâ geçerli olduğu doğrulanır: ekip panelden
 * iptal etmiş ya da zamanı değiştirmiş olabilir.
 */
export async function randevuHatirlatmalariniGonder(
  an: Date = new Date(),
): Promise<{ gonderildi: number; iptal: number }> {
  const db = supabaseServis()

  // Randevu hatırlatması da botun kendi başlattığı bir mesajdır: gece gitmez.
  // "Yarın saat 10:00 için bekliyoruz" cümlesini 23:30'da göndermek, hatırlatma
  // olmaktan çıkıp rahatsızlık olur; sabah 08:00 turunda gider.
  if (proaktifSessizMi(an)) return { gonderildi: 0, iptal: 0 }

  const { data: kuyruk } = await db
    .from('followups')
    .select('id, conversation_id, planlanan_at, meta')
    .eq('durum', 'beklemede')
    .eq('basamak', RANDEVU_HATIRLATMA)
    .lte('planlanan_at', an.toISOString())
    .order('planlanan_at', { ascending: true })
    .limit(50)

  let gonderildi = 0
  let iptal = 0

  const iptalEt = async (id: string, sebep: string) => {
    await db
      .from('followups')
      .update({ durum: 'iptal', meta: { sebep } as Json })
      .eq('id', id)
    iptal += 1
  }

  for (const satir of kuyruk ?? []) {
    // Randevunun güncel hâli: ekip panelden iptal etmiş ya da saatini
    // değiştirmiş olabilir. Kuyruktaki kopyaya değil, tabloya güveniyoruz.
    const { data: randevuSatiri } = await db
      .from('appointment_requests')
      .select('randevu_at, durum')
      .eq('conversation_id', satir.conversation_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!randevuSatiri?.randevu_at) {
      await iptalEt(satir.id, 'randevu-yok')
      continue
    }
    if (randevuSatiri.durum === 'iptal') {
      await iptalEt(satir.id, 'randevu-iptal')
      continue
    }

    const randevu = new Date(randevuSatiri.randevu_at)

    // Randevu ileri alınmışsa hatırlatma erken kalmış demektir: gönderme,
    // yeni zamanına göre yeniden planla.
    const hedef = hatirlatmaAni(randevu, an)
    if (hedef && hedef.getTime() > an.getTime()) {
      await db
        .from('followups')
        .update({ planlanan_at: proaktifeKaydir(hedef).toISOString() })
        .eq('id', satir.id)
      continue
    }

    // Randevu saati geçmişse hatırlatmanın anlamı kalmadı (cron gecikmiş ya da
    // randevu geriye alınmış olabilir).
    if (randevu.getTime() <= an.getTime()) {
      await iptalEt(satir.id, 'randevu-gecti')
      continue
    }

    // Konuşma ve kişi ayrı okunuyor: gömülü ilişki (contacts(ad)) üretilen
    // tiplerde `never`e düşüyor ve durum alanı okunamıyor.
    const { data: konusma } = await db
      .from('conversations')
      .select('id, durum, contact_id')
      .eq('id', satir.conversation_id)
      .maybeSingle()

    // Kapalı yazışmaya hatırlatma gitmez. Devirdekine GİDER: ekip devraldı
    // diye randevu ortadan kalkmıyor.
    if (!konusma || konusma.durum === 'kapali') {
      await iptalEt(satir.id, 'konusma-yok')
      continue
    }

    const { data: kisi } = await db
      .from('contacts')
      .select('ad')
      .eq('id', konusma.contact_id)
      .maybeSingle()
    const ad = kisi?.ad ?? null

    try {
      await gidenMesajGonder(
        satir.conversation_id,
        randevuHatirlatmaMetni(randevu, ad, an),
        'bot',
        { takip: RANDEVU_HATIRLATMA, randevu_at: randevu.toISOString() } as Json,
      )

      await db
        .from('followups')
        .update({ durum: 'gonderildi', gonderildi_at: an.toISOString() })
        .eq('id', satir.id)

      await db.from('activity_log').insert({
        aktor: 'bot',
        tip: 'randevu_hatirlatildi',
        payload: {
          konusma_id: satir.conversation_id,
          randevu_at: randevu.toISOString(),
        } as Json,
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
