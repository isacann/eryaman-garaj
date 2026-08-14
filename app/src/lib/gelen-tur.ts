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

      const cevap = await botCevapla(sonuc.konusmaId)
      if (!cevap.tamam) {
        // Vercel logu ~1 saatte siliniyor; "dün akşam neden cevap vermedi"
        // sorusunun cevabı activity_log'da 60 gün duruyor.
        await hataKaydet(
          kaynak,
          `bot cevaplamadı: ${cevap.sebep}`,
          cevap.mesaj,
          sonuc.konusmaId,
        )
      }
    } catch (e) {
      await hataKaydet(kaynak, `mesaj işlenemedi (${mesaj.hariciId ?? '-'})`, e)
    }
  }
}
