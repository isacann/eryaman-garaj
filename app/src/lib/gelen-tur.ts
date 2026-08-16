// Gelen mesajı bota götüren ortak akış (WhatsApp + Instagram).
//
// NEDEN VAR — 14 Ağustos 2026, sahada yakalandı: müşteri arka arkaya iki mesaj
// attığında (çok yaygın: "Merhaba hocam" + "PPF fiyatınız nedir") her mesaj
// ayrı bir webhook doğuruyor, her webhook ayrı bir bot turu başlatıyor ve
// müşteri İKİ AYRI CEVAP alıyor — ikisi de baştan selamlıyor:
//
//   18:30:30  bot  Merhabalar Tayyar Aydın bey, hoşgeldiniz.
//   18:30:31  bot  Tabi yardımcı olalım. Tam kapsamlı mı kısmi mi...
//   18:30:36  bot  Merhabalar Tayyar Aydın bey, hoşgeldiniz.      ← ikinci tur
//   18:30:38  bot  Tabi yardımcı olalım. Tam kapsamlı mı kısmi mi...
//
// İki tur birbirinden habersiz: ikincisi başladığında birincisinin cevabı
// henüz yazılmamış oluyor, o yüzden ikisi de "bu ilk cevap" diye davranıyor.
// Üstelik iki model çağrısı = iki kat maliyet.
//
// ÇÖZÜM: kısa bir yerleşme süresi. Mesaj kaydedildikten sonra biraz beklenir;
// bu sırada müşteri yeni bir mesaj daha yazdıysa BU tur sessizce çekilir, cevabı
// en son mesajın turu verir. O tur da geçmişin tamamını okuduğu için müşterinin
// iki cümlesini birlikte görür ve TEK, bütün bir cevap yazar — yani yan etki
// olarak parçalı yazan müşteriye verilen cevabın kalitesi de artar.
//
// ⚠ Bekleme `after()` içinde, yani müşteri bir şey beklemiyor: webhook'a 200
// zaten dönmüş durumda. Maliyeti sadece fonksiyonun açık kalma süresi.

import { botCevapla } from '@/lib/bot'
import { isBasvurusuMu } from '@/lib/is-basvurusu'
import { hataKaydet } from '@/lib/hata-log'
import { gelenMesajiKaydet } from '@/lib/mesajlar'
import { supabaseServis } from '@/lib/supabase/sunucu'
import type { GelenMesaj } from '@/lib/channels/types'

/**
 * Yerleşme süresi. Sahadaki ölçüm: parçalı mesajlar arasında 13 saniye vardı
 * (17:58:22 → 17:58:35). Kısa tutulursa çift cevap sürer, uzun tutulursa bot
 * geç kalır. 12 saniye ikisinin arasında: botun kendi cevap süresi zaten
 * 13-24 saniye, bu ekleme müşteri tarafında belirgin fark yaratmıyor.
 *
 * Ortam değişkeniyle ayarlanabilir (MOTOR_YERLESME_MS); 0 verilirse beklemez.
 */
const YERLESME_MS = Number(process.env.MOTOR_YERLESME_MS ?? 12_000)

/**
 * Bir konuşmada aynı anda kaç bot turu çalışabilir: BİR.
 *
 * ⚠ 15 Ağustos, sahada: yerleşme süresi tek başına yetmiyor. Yerleşme yalnızca
 * "müşteri hâlâ yazıyor mu" sorusunu cevaplıyor, "önceki tur bitti mi" sorusunu
 * DEĞİL. Gerçekleşen sıra:
 *
 *   17:37:00  müşteri 1. mesaj  → tur A başlar, 12 sn yerleşme bekler
 *   17:37:12  tur A modele gider (cevap yazması 13-24 sn sürüyor)
 *   17:37:15  müşteri 2. mesaj  → tur B başlar, 12 sn yerleşme bekler
 *   17:37:27  tur B: "son mesaj benim" → geçer, MODELE GİDER
 *   17:37:30  tur A cevabını veritabanına yazar  ← tur B bunu göremedi
 *
 * Tur B geçmişi okuduğunda içinde hiç bot mesajı yok, dolayısıyla "bu ilk
 * cevap" diye davranıp baştan selamlıyor. Müşteri iki ayrı karşılama alıyor,
 * işletme iki kat model parası ödüyor.
 *
 * Kilit bunu kapatır: tur B, tur A bitene kadar BEKLER. Sonra `botCevapla`
 * çalışır ve geçmişte tur A'nın cevabını görür — ya konuşmayı doğru yerden
 * sürdürür ya da "cevaplanacak müşteri mesajı yok" kilidine takılıp sessizce
 * çekilir. İkisi de doğru sonuç.
 *
 * Kilit veritabanında tutuluyor çünkü turlar ayrı sunucusuz çağrılarda
 * çalışıyor; bellekteki bir bayrak onları birbirinden habersiz bırakırdı.
 */
const KILIT_OMRU_MS = 90_000
const KILIT_BEKLEME_ARALIGI_MS = 2_000
const KILIT_EN_FAZLA_BEKLEME_MS = 60_000

/**
 * Tur kilidini almayı dener. Aldıysa true.
 *
 * Yarış korumalı: PATCH filtresi "kilit boş ya da süresi dolmuş" koşulunu
 * içeriyor ve dönen satır sayısına bakılıyor. İki tur aynı anda denerse
 * yalnızca biri satır alır — kontrol edip sonra yazmak yarışa açık olurdu.
 *
 * `KILIT_OMRU_MS` sonrası kilit kendiliğinden düşer: bir tur çökerse ya da
 * sunucusuz çağrı yarıda kesilirse konuşma sonsuza dek kilitli kalmamalı.
 */
export async function turKilidiAl(konusmaId: string, simdi: Date): Promise<boolean> {
  const db = supabaseServis()
  const esik = new Date(simdi.getTime() - KILIT_OMRU_MS).toISOString()

  const { data } = await db
    .from('conversations')
    .update({ bot_tur_at: simdi.toISOString() })
    .eq('id', konusmaId)
    .or(`bot_tur_at.is.null,bot_tur_at.lt.${esik}`)
    .select('id')

  return (data?.length ?? 0) > 0
}

export async function turKilidiniBirak(konusmaId: string): Promise<void> {
  const db = supabaseServis()
  await db.from('conversations').update({ bot_tur_at: null }).eq('id', konusmaId)
}

/** Konuşmadaki en son MÜŞTERİ mesajının kimliği. */
async function sonMusteriMesajId(konusmaId: string): Promise<string | null> {
  const db = supabaseServis()
  const { data } = await db
    .from('messages')
    .select('id')
    .eq('conversation_id', konusmaId)
    .eq('gonderen', 'musteri')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.id ?? null
}

/**
 * Bir webhook yükünden çıkan mesajları kaydeder ve gerektiğinde botu çalıştırır.
 *
 * @param kaynak Hata kayıtlarında görünecek etiket: `wa-webhook` / `ig-webhook`.
 * @param mesajOncesi Bot çalıştırılmadan hemen önce yapılacak iş (Instagram'da
 *        kişinin adını çekmek gibi). Hata verirse akış durmaz.
 */
export async function gelenleriIsle(
  kaynak: string,
  mesajlar: GelenMesaj[],
  mesajOncesi?: (mesaj: GelenMesaj) => Promise<void>,
): Promise<void> {
  for (const mesaj of mesajlar) {
    try {
      const sonuc = await gelenMesajiKaydet(mesaj)

      // Webhook tekrarı: aynı mesaj ikinci kez geldi, bot yeniden cevap YAZMAZ.
      if (sonuc.tekrar) {
        console.log(`[${kaynak}] tekrar gelen mesaj, bot atlandı:`, mesaj.hariciId)
        continue
      }

      // İş başvurusu / eleman sorusu: bot turu HİÇ AÇILMAZ (Fatih Bey,
      // 15 Ağustos: "cevap vermesin, pas geçsin"). Mesaj panele düştü; ekip
      // isterse elle cevaplar. Takip, mesai kuyruğu, bildirim — hiçbiri
      // kurulmaz çünkü hepsi bot turuna bağlı. Kayıt: sessiz kalışın izi
      // panelde kaybolmasın diye activity_log'a düşülür.
      if (isBasvurusuMu(mesaj.metin)) {
        console.log(`[${kaynak}] iş başvurusu mesajı, bot pas geçti`)
        const db = supabaseServis()
        await db.from('activity_log').insert({
          aktor: 'bot',
          tip: 'is_basvurusu_pas',
          payload: { konusma_id: sonuc.konusmaId } as never,
        })
        continue
      }

      if (mesajOncesi) {
        try {
          await mesajOncesi(mesaj)
        } catch (e) {
          await hataKaydet(kaynak, 'mesaj öncesi iş başarısız', e, sonuc.konusmaId)
        }
      }

      // ---- Yerleşme: müşteri hâlâ yazıyorsa cevabı son tura bırak ----
      if (YERLESME_MS > 0 && sonuc.mesajId) {
        await new Promise((r) => setTimeout(r, YERLESME_MS))

        const sonId = await sonMusteriMesajId(sonuc.konusmaId)
        if (sonId && sonId !== sonuc.mesajId) {
          // Daha yeni bir müşteri mesajı var; onun turu ikisini birden cevaplar.
          console.log(`[${kaynak}] müşteri yazmaya devam etti, bu tur atlandı`)
          continue
        }
      }

      // ---- Tur kilidi: bu konuşmada başka bir tur çalışıyorsa bitmesini bekle ----
      let kilitAlindi = false
      const beklemeBaslangic = Date.now()
      while (Date.now() - beklemeBaslangic < KILIT_EN_FAZLA_BEKLEME_MS) {
        kilitAlindi = await turKilidiAl(sonuc.konusmaId, new Date())
        if (kilitAlindi) break
        await new Promise((r) => setTimeout(r, KILIT_BEKLEME_ARALIGI_MS))
      }

      if (!kilitAlindi) {
        // Bir dakika boyunca serbest kalmadı: önceki tur ya çok uzun sürüyor ya
        // da takıldı. Zorla araya girip çift cevap üretmektense bu turu
        // bırakıyoruz — kilidin ömrü dolunca sonraki mesaj yine işlenecek.
        await hataKaydet(
          kaynak,
          'tur kilidi alınamadı, bu tur atlandı',
          `konuşmada ${KILIT_EN_FAZLA_BEKLEME_MS / 1000} sn boyunca başka bir bot turu çalışıyordu`,
          sonuc.konusmaId,
        )
        continue
      }

      try {
        const cevap = await botCevapla(sonuc.konusmaId)
        if (!cevap.tamam && cevap.sebep !== 'cevapsiz') {
          // Vercel logu ~1 saatte siliniyor; "dün akşam neden cevap vermedi"
          // sorusunun cevabı activity_log'da 60 gün duruyor.
          //
          // 'cevapsiz' kayda geçmez: o bir hata değil, "önceki tur bu mesajı
          // zaten cevapladı" demek. Kilit devreye girdikten sonra bu normal
          // bir sonuç; hata olarak yazmak kayıtları gürültüye boğardı.
          await hataKaydet(
            kaynak,
            `bot cevaplamadı: ${cevap.sebep}`,
            cevap.mesaj,
            sonuc.konusmaId,
          )
        }
      } finally {
        // Kilit HER durumda bırakılır: bot patlasa bile konuşma kilitli kalmaz.
        await turKilidiniBirak(sonuc.konusmaId)
      }
    } catch (e) {
      await hataKaydet(kaynak, `mesaj işlenemedi (${mesaj.hariciId ?? '-'})`, e)
    }
  }
}
