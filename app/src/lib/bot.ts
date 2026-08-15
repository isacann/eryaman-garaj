// Botun bir konuşmaya cevap yazması. Motoru veritabanına bağlayan katman burası.
//
// Motor (src/lib/motor) sadece metin üretir, veritabanını bilmez.
// Servis katmanı (src/lib/mesajlar) sadece kaydeder, cevap üretmez.
// Bu dosya ikisini birleştirir ve tek bir soruyu cevaplar:
// "şu konuşmada bot ne yazacak ve bunun panele düşen sonuçları neler".
//
// Şimdilik tek çağıran test konsolu (/test). Meta webhook'u geldiğinde aynı
// fonksiyonu çağıracak, kanal fark etmiyor.

import 'server-only'

import { botTurundanSonraBildir, sistemUyarisi } from '@/lib/bildirim'
import { egitimIcerigiAl } from '@/lib/egitim'
import { panelAdresi } from '@/lib/env'
import { hataKaydet } from '@/lib/hata-log'
import { gorselAdresi, gorselBul } from '@/lib/fiyat-gorselleri'
import { gidenMedyaGonder, gidenMesajGonder } from '@/lib/mesajlar'
import { yanitUret } from '@/lib/motor'
import { mesaiDisiMi } from '@/lib/motor/saat'
import { randevuHatirlatmasiPlanla, takipPlanla } from '@/lib/takip'
import type { Gorsel, Kullanim, YapiliCikti } from '@/lib/motor'
import { supabaseServis } from '@/lib/supabase/sunucu'
import type { Json, KanalAdi, KonusmaDurumu } from '@/lib/db/types'

/** Modele verilecek geçmiş uzunluğu. Konuşmalar kısa, 40 tur fazlasıyla yeter. */
const GECMIS_SINIRI = 40

/**
 * Mesai dışı mesajı bu süre içinde bir kez atılır.
 * Mesai dışı pencere 01:00-08:00, yani 7 saat; 8 saatlik kilit o pencereyi tam
 * kapsar ve gece boyunca ikinci bir "mesai dışındayız" mesajını imkânsız kılar
 * (KAPSAM karar 5: "TEK mesai dışı mesajı").
 */
const MESAI_DISI_KILIT_SAAT = 8

/**
 * ⛔ ARTIK MÜŞTERİYE GÖNDERİLMİYOR (Fatih Bey, 15 Ağustos: "Bir de teknik bir
 * arıza falan bunları yazmasın").
 *
 * Eskiden motor patlayınca bu cümle müşteriye giderdi; gerekçe "sessizlik en
 * kötü sonuçtur" idi. Sahada tersi çıktı: müşteri işletmenin bozuk olduğunu
 * öğrenmiş oluyor ve bu cümle bir kez değil arka arkaya gitti (bkz. 15 Ağustos
 * döngüsü). Artık motor patladığında müşteriye HİÇBİR ŞEY yazılmaz; bunun
 * yerine devir bayrağı düşer ve iş insana geçer. Ekip 15 dakika içinde
 * yazmazsa devir kuralının nötr cümlesi ("Ekibimiz birazdan size dönüş
 * yapacak") zaten gider — müşteri yine cevapsız kalmaz, ama teknik arıza
 * anlatılmaz.
 *
 * Sabit, sahada kalmış eski mesajları teşhis sorgularında bulabilmek için
 * duruyor; gönderim yolu kaldırıldı.
 */
export const SON_CARE_METNI =
  'Kusura bakmayın, sistemimizde anlık bir aksaklık oldu. Ekibimiz birazdan size dönüş sağlayacak.'

export type BotSonuc =
  | {
      tamam: true
      yapili: YapiliCikti
      kullanim: Kullanim
      /** Kaydedilen giden mesajların kimlikleri, sırayla. */
      mesajIdleri: string[]
      /** Bu tur mesai dışı bilgilendirmesiydi, asıl cevap sabaha kaldı. */
      mesaiDisi?: boolean
    }
  | {
      tamam: false
      /**
       * devir = ekip devraldı, bot susar. kapali = bot ayarlardan kapalı.
       * mesai-sessiz = mesai dışı ve bilgilendirme bu gece zaten yapıldı.
       * hata = motor patladı.
       * cevapsiz = konuşmanın sonunda cevaplanacak müşteri mesajı yok.
       */
      sebep: 'devir' | 'kapali' | 'mesai-sessiz' | 'hata' | 'cevapsiz'
      mesaj: string
    }

export type BotSecenekleri = {
  gorseller?: Gorsel[]
  /** Test ve cron için saat enjeksiyonu. Verilmezse şimdi. */
  simdi?: Date
  /**
   * Mesai kuralını atla. Test konsolu bunu kullanır: Fatih Bey gece 02:00'de
   * cevap kalitesini denerken "mesai dışındayız" duvarına toslamasın.
   */
  mesaiKuralsiz?: boolean
}

/**
 * Konuşmanın son haline göre bot cevabı üretir, mesajları yazar ve
 * panele düşmesi gerekenleri düşürür (randevu talebi, devir bayrağı).
 *
 * Çağrılmadan ÖNCE müşterinin mesajı kaydedilmiş olmalı: geçmiş veritabanından
 * okunur, çağıranın elindeki metinden değil.
 */
export async function botCevapla(
  konusmaId: string,
  secenekler: BotSecenekleri = {},
): Promise<BotSonuc> {
  const db = supabaseServis()
  const gorseller = secenekler.gorseller ?? []
  const simdi = secenekler.simdi ?? new Date()

  const { data: konusma, error: konusmaHata } = await db
    .from('conversations')
    .select('id, contact_id, kanal, durum, meta')
    .eq('id', konusmaId)
    .single()
  if (konusmaHata || !konusma) {
    return { tamam: false, sebep: 'hata', mesaj: `konuşma bulunamadı: ${konusmaHata?.message}` }
  }

  // Ekip devraldıysa bot susar (KAPSAM karar 4).
  const durum = konusma.durum as KonusmaDurumu
  if (durum === 'devir') {
    return {
      tamam: false,
      sebep: 'devir',
      mesaj: 'Bu yazışmayı ekip devraldı, bot cevap yazmıyor.',
    }
  }
  if (durum === 'kapali') {
    return { tamam: false, sebep: 'kapali', mesaj: 'Bu yazışma kapatılmış.' }
  }

  // Mesai dışı (KAPSAM karar 5): asıl cevap yazılmaz, TEK bilgilendirme mesajı
  // atılır, yazışma kuyruğa alınır, sabah 08:00'de cron asıl cevabı yazdırır.
  // Bilgilendirme metnini yine motor üretir (sistem-prompt.ts mesai bloğu),
  // böylece ton tek yerden yönetilir; burada sadece "kaç kez" kararı verilir.
  const kanal = konusma.kanal as KanalAdi
  const mesaiKurali = !secenekler.mesaiKuralsiz && kanal !== 'test'
  const konusmaMeta = (konusma.meta ?? {}) as Record<string, unknown>

  if (mesaiKurali && mesaiDisiMi(simdi)) {
    const oncekiBildirim = konusmaMeta.mesai_disi_bildirim_at
    const kilitliMi =
      typeof oncekiBildirim === 'string' &&
      simdi.getTime() - new Date(oncekiBildirim).getTime() <
        MESAI_DISI_KILIT_SAAT * 3600_000

    // Her hâlükârda sabah cevaplanmak üzere işaretle.
    await db
      .from('conversations')
      .update({
        meta: {
          ...konusmaMeta,
          mesai_bekliyor: true,
          ...(kilitliMi ? {} : { mesai_disi_bildirim_at: simdi.toISOString() }),
        } as Json,
      })
      .eq('id', konusmaId)

    if (kilitliMi) {
      return {
        tamam: false,
        sebep: 'mesai-sessiz',
        mesaj: 'Mesai dışı. Bilgilendirme bu gece zaten yapıldı, sabah cevaplanacak.',
      }
    }
  }

  const { data: ayarlar } = await db
    .from('settings')
    .select('bot_aktif')
    .eq('id', 1)
    .maybeSingle()
  if (ayarlar && !ayarlar.bot_aktif) {
    return {
      tamam: false,
      sebep: 'kapali',
      mesaj: 'Bot ayarlardan kapalı. Ayarlar sayfasından açabilirsin.',
    }
  }

  const [{ data: kisi }, { data: mesajlar }] = await Promise.all([
    db.from('contacts').select('ad').eq('id', konusma.contact_id).maybeSingle(),
    db
      .from('messages')
      .select('yon, gonderen, metin, medya_url, created_at')
      .eq('conversation_id', konusmaId)
      // ⛔ KRİTİK: EN YENİ mesajlar alınır, en eski değil.
      // Eskiden `ascending: true` + limit(40) yazıyordu; bu, konuşma 40 mesajı
      // geçtiğinde botun EN ESKİ 40 mesajda takılı kalması demekti — müşterinin
      // az önce yazdığı araç/kapsam bilgisi hiç görülmüyordu. Fatih Bey'in
      // "aracın modelini yazmış ama tekrardan istiyor" ve "sürekli aynı şeyi
      // tekrarlıyor" şikâyetlerinin kök sebebi büyük olasılıkla buydu:
      // test konsolunda aynı sohbette çok tur yapıldığında 40 sınırı aşılıyor.
      .order('created_at', { ascending: false })
      .limit(GECMIS_SINIRI),
  ])

  // Sorgu yeniden eskiye geldi; modele kronolojik sırayla verilmeli.
  const kronolojik = [...(mesajlar ?? [])].reverse()

  // Ekip mesajları da müşterinin gözünde işletmenin ağzıdır, 'bot' rolüyle geçer.
  const gecmis = kronolojik
    .map((m) => ({
      rol: (m.yon === 'gelen' ? 'musteri' : 'bot') as 'musteri' | 'bot',
      metin: m.metin?.trim() || (m.medya_url ? '[fotoğraf gönderdi]' : ''),
    }))
    .filter((m) => m.metin !== '')

  if (gecmis.length === 0) {
    return { tamam: false, sebep: 'hata', mesaj: 'Konuşmada modele verilecek mesaj yok.' }
  }

  // ⛔ KÖK SEBEP KİLİDİ (15 Ağustos). Konuşmanın sonunda cevaplanacak bir
  // müşteri mesajı yoksa modele HİÇ gidilmez.
  //
  // Sahada olan: gece bayrağı kurulmuş bir yazışmayı sabah kuyruğu yeniden
  // işlemeye kalktı, ama müşterinin son mesajı zaten cevaplanmıştı — geçmiş bot
  // mesajıyla bitiyordu. Anthropic bunu "assistant message prefill" sayıp 400
  // döndürdü ("The conversation must end with a user message"), motor patladı,
  // son çare cümlesi gitti ve döngü kuruldu. Aynı 400 webhook yolunda da iki
  // kez görüldü (yarış durumunda bot mesajı en sona düştüğünde).
  //
  // Bu durum bir HATA değil, "yapacak iş yok" hâlidir: sessizce dönülür,
  // müşteriye hiçbir şey yazılmaz, ekibe uyarı gitmez.
  if (gecmis[gecmis.length - 1].rol !== 'musteri') {
    // Yazışma sabah kuyruğunda takılı kalmasın.
    if (konusmaMeta.mesai_bekliyor) {
      const kalan = { ...konusmaMeta }
      delete kalan.mesai_bekliyor
      await db.from('conversations').update({ meta: kalan as Json }).eq('id', konusmaId)
    }
    return {
      tamam: false,
      sebep: 'cevapsiz',
      mesaj: 'Konuşmanın sonunda cevaplanacak müşteri mesajı yok, bot yazmadı.',
    }
  }

  // Dönen müşteri: geçmişte bizden giden mesaj var ama son gidenin üzerinden
  // uzun süre geçmiş. Prompt bunu bilirse kısa bir "tekrar hoşgeldiniz" ile
  // açar ve geçmişi hatırlayarak davranır; bilmezse ya selamsız dalar ya da
  // müşteriyi yeni sanır (Fatih Bey, 15 Ağustos — Barkın vakası: eski müşteri
  // şikayetle döndü, bot sıfırdan satış diliyle karşıladı).
  const UZUN_ARA_SAAT = 24
  const sonGiden = [...kronolojik].reverse().find((m) => m.yon === 'giden')
  const uzunAradanSonraMi = Boolean(
    sonGiden?.created_at &&
      simdi.getTime() - new Date(sonGiden.created_at).getTime() >
        UZUN_ARA_SAAT * 3600_000,
  )

  let yanit
  try {
    yanit = await yanitUret({
      konusma: gecmis,
      kisiAdi: kisi?.ad ?? null,
      uzunAradanSonraMi,
      // Reklamdan gelen müşterinin bağlamı konuşma açılırken meta'ya yazıldı.
      reklamBasligi:
        (konusmaMeta.reklam as { baslik?: string } | undefined)?.baslik ?? null,
      gorseller,
      simdi,
      // Fatih Bey'in panelden eklediği bilgi/davranış notları ve — müşteri
      // reklamdan geldiyse — o reklama tanımlı kampanya.
      egitim: await egitimIcerigiAl(
        (konusmaMeta.reklam as
          | { adId?: string; baslik?: string; metin?: string }
          | undefined) ?? null,
        simdi,
      ),
    })
  } catch (e) {
    const hata = e instanceof Error ? e.message : 'motor hatası'
    await sistemUyarisi('Yanıt motoru cevap üretemedi', `Konuşma: ${konusmaId}\n${hata}`)

    // Motor patladı: müşteriye TEKNİK HİÇBİR ŞEY yazılmaz (Fatih Bey, 15
    // Ağustos). Yapılan tek şey işi insana geçirmek — devir bayrağı düşer,
    // Telegram uyarısı gider, ekip 15 dk içinde yazmazsa devir kuralının nötr
    // cümlesi devreye girer. Gerekçe SON_CARE_METNI'nin başında.
    try {
      const { data: guncelKonusma } = await db
        .from('conversations')
        .select('meta')
        .eq('id', konusmaId)
        .maybeSingle()
      const meta = (guncelKonusma?.meta ?? {}) as Record<string, unknown>

      // ⛔ Bayrağı hata yolunda da temizle. Bunu atlamak, sabah kuyruğunun aynı
      // konuşmayı her 5 dakikada bir yeniden denemesi demekti (15 Ağustos hatası).
      // Cevabı ekip yazacak; kuyrukta beklemesinin bir faydası yok.
      const kalanMeta = { ...meta }
      delete kalanMeta.mesai_bekliyor

      await db
        .from('conversations')
        .update({
          meta: {
            ...kalanMeta,
            ...(meta.devir_bayrak_at ? {} : { devir_bayrak_at: simdi.toISOString() }),
          } as Json,
        })
        .eq('id', konusmaId)
    } catch (ikincil) {
      // Buraya düşmek "ekibe devir bayrağı bile düşmedi" demektir — müşteri
      // cevapsız kalır ve kimsenin haberi olmaz. İzi kaybolmamalı.
      await hataKaydet('bot', 'motor hatasından sonra devir bayrağı düşmedi', ikincil, konusmaId)
    }

    return { tamam: false, sebep: 'hata', mesaj: hata }
  }

  const { yapili, kullanim } = yanit

  // Yapılandırılmış çıktı ilk mesaja iliştirilir; panelde ve konsolda oradan okunur.
  const mesajIdleri: string[] = []
  for (const [sira, metin] of yapili.mesajlar.entries()) {
    const sonuc = await gidenMesajGonder(
      konusmaId,
      metin,
      'bot',
      sira === 0 ? ({ yapili, kullanim } as unknown as Json) : undefined,
    )
    if (sonuc.mesajId) mesajIdleri.push(sonuc.mesajId)
  }

  // Fiyat listesi görseli. Sahadaki en sık davranışlardan biri ("Fiyat listemizi
  // yönlendiriyorum", arşivde 39 kez). Metin fiyatıyla AYNI kurala tabi: şema
  // çözücüsü fiyat_verilebilir_mi false iken bu alanı zaten null'a çekiyor.
  //
  // Gönderim başarısız olursa tur iptal edilmez: metin cevabı zaten gitti,
  // görselin gitmemesi müşteriyi cevapsız bırakmaz.
  if (yapili.fiyat_gorseli) {
    const gorsel = gorselBul(yapili.fiyat_gorseli)
    const adres = gorsel ? gorselAdresi(gorsel.dosya, panelAdresi()) : null

    if (gorsel && adres?.startsWith('https://')) {
      try {
        await gidenMedyaGonder(konusmaId, adres, gorsel.altYazi, 'bot')
      } catch (e) {
        console.error('[bot] fiyat görseli gönderilemedi:', e)
      }
    } else if (adres) {
      // Geliştirmede panel adresi http; Meta böyle bir adresten görsel çekemez.
      console.warn(`[bot] fiyat görseli atlandı, https değil: ${adres}`)
    }
  }

  // Randevu talebi panele düşer.
  //
  // ⚠ 14 Ağustos kararı (Fatih Bey): randevu ekip onayını BEKLEMİYOR. Bot gün
  // aldıysa kayıt doğrudan geçerli sayılır, Telegram bildirimi düşer, ekip
  // isterse panelden zamanı düzeltir ya da iptal eder. Eskiden durum='bekliyor'
  // ile bekliyordu ve onaylanmayan randevu hatırlatma da alamıyordu.
  if (yapili.randevu_talebi) {
    // İptal edilmemiş son kayıt güncellenir: müşteri günü değiştirdiğinde
    // ikinci bir randevu satırı açmak paneli ikiz kayıtla dolduruyordu.
    const { data: mevcut } = await db
      .from('appointment_requests')
      .select('id')
      .eq('conversation_id', konusmaId)
      .neq('durum', 'iptal')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const alanlar = {
      istenen_zaman_metin: yapili.randevu_talebi,
      randevu_at: yapili.randevu_zaman,
      arac: yapili.arac,
      hizmet: yapili.kapsam,
      durum: 'onaylandi' as const,
    }

    if (mevcut) {
      await db.from('appointment_requests').update(alanlar).eq('id', mevcut.id)
    } else {
      await db.from('appointment_requests').insert({ conversation_id: konusmaId, ...alanlar })
    }

    // Zaman netleştiyse hatırlatma kurulur; netleşmediyse (randevu_zaman null)
    // varsa eski hatırlatma iptal edilir — yanlış güne mesaj gitmesin.
    try {
      await randevuHatirlatmasiPlanla(konusmaId, yapili.randevu_zaman, simdi)
    } catch (e) {
      await hataKaydet('bot', 'randevu hatırlatması planlanamadı', e, konusmaId)
    }
  }

  // Devir bayrağı: bot susmaz, ekibe işaret düşer. Susma kararı insanındır.
  // devir_bayrak_at, 15 dakika kuralının sayacıdır (KAPSAM karar 4): ekip bu
  // andan itibaren 15 dk yazmazsa bot "ekibimiz birazdan dönecek" der.
  if (yapili.devir_gerekli_mi) {
    await db.from('activity_log').insert({
      aktor: 'bot',
      tip: 'devir_gerekli',
      payload: {
        konusma_id: konusmaId,
        sebep: yapili.devir_sebebi,
        guven: yapili.guven,
      } as Json,
    })

    const { data: guncelKonusma } = await db
      .from('conversations')
      .select('meta')
      .eq('id', konusmaId)
      .maybeSingle()
    const meta = (guncelKonusma?.meta ?? {}) as Record<string, unknown>

    // Zaten bir devir bayrağı bekliyorsa sayacı sıfırlama.
    if (!meta.devir_bayrak_at) {
      await db
        .from('conversations')
        .update({
          meta: { ...meta, devir_bayrak_at: simdi.toISOString() } as Json,
        })
        .eq('id', konusmaId)
    }
  }

  // Mesai dışı bilgilendirmesi de asıl cevap da verildiğine göre yazışma artık
  // sabahı bekleyen kuyrukta değil.
  const mesaiDisiTuru = mesaiKurali && mesaiDisiMi(simdi)
  if (!mesaiDisiTuru && konusmaMeta.mesai_bekliyor) {
    const kalan = { ...konusmaMeta }
    delete kalan.mesai_bekliyor
    await db.from('conversations').update({ meta: kalan as Json }).eq('id', konusmaId)
  }

  // Bildirim ve takip yan iştir: patlarsa müşteriye giden cevabı geri almaz.
  // Bu yüzden ikisi de kendi içinde yutulur, sadece loglanır.
  try {
    await botTurundanSonraBildir(konusmaId, kisi?.ad ?? null, kanal, yapili, simdi)
  } catch (e) {
    console.error('[bot] bildirim gönderilemedi:', e)
  }

  try {
    // Mesai dışı bilgilendirmesinden sonra takip merdiveni kurulmaz: asıl
    // cevap sabah yazılacak, merdiven o zaman kurulur.
    if (!mesaiDisiTuru) await takipPlanla(konusmaId, simdi)
  } catch (e) {
    console.error('[bot] takip planlanamadı:', e)
  }

  return { tamam: true, yapili, kullanim, mesajIdleri, mesaiDisi: mesaiDisiTuru }
}

/**
 * Gece gelip cevapsız kalan yazışmaların asıl cevabını sabah yazar.
 * KAPSAM karar 5'in ikinci yarısı: "sohbet kuyruğa alınır, 08:00'de bot asıl
 * cevabı yazar." Cron çağırır.
 *
 * Mesai dışındayken çağrılırsa hiçbir şey yapmaz — kuyruk sabahı bekler.
 */
export async function mesaiKuyrugunuIslet(
  an: Date = new Date(),
): Promise<{ cevaplandi: number; atlandi: number }> {
  if (mesaiDisiMi(an)) return { cevaplandi: 0, atlandi: 0 }

  const db = supabaseServis()
  const { data: bekleyenler } = await db
    .from('conversations')
    .select('id')
    .eq('durum', 'bot')
    .eq('meta->>mesai_bekliyor', 'true')
    .order('son_mesaj_at', { ascending: true })
    .limit(25)

  let cevaplandi = 0
  let atlandi = 0

  for (const konusma of bekleyenler ?? []) {
    let basarili = false
    try {
      const sonuc = await botCevapla(konusma.id, { simdi: an })
      basarili = sonuc.tamam
      if (sonuc.tamam) cevaplandi += 1
      else atlandi += 1
    } catch (e) {
      console.error('[bot] sabah cevabı yazılamadı:', e)
      atlandi += 1
    }

    // ⛔ SON SAVUNMA (15 Ağustos): cevap yazılamadıysa yazışmayı kuyruktan
    // KESİNLİKLE çıkar. `botCevapla` bayrağı kendi de temizliyor ama oraya hiç
    // varamayan yollar var (konuşma okunamadı, geçmiş boş, fonksiyon throw etti).
    // Bayrak kalırsa cron aynı konuşmayı 5 dakikada bir yeniden dener ve müşteri
    // aynı cümleyi arka arkaya yer — sahada tam olarak bu oldu.
    if (!basarili) {
      try {
        const { data: guncel } = await db
          .from('conversations')
          .select('meta')
          .eq('id', konusma.id)
          .maybeSingle()
        const meta = { ...((guncel?.meta ?? {}) as Record<string, unknown>) }
        if (meta.mesai_bekliyor) {
          delete meta.mesai_bekliyor
          await db.from('conversations').update({ meta: meta as Json }).eq('id', konusma.id)
        }
      } catch (e) {
        await hataKaydet('bot', 'sabah kuyruğu bayrağı temizlenemedi', e, konusma.id)
      }
    }
  }

  return { cevaplandi, atlandi }
}
