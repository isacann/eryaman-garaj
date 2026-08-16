// WhatsApp webhook'u — Evolution API.
//
// 14 Ağustos 2026'da Meta Cloud API'den Evolution'a çevrildi. Cloud API sürümü
// git geçmişinde ve `lib/channels/whatsapp-cloud.ts`'te duruyor.
//
// ⚠ DOĞRULAMA MODELİ DEĞİŞTİ. Meta'da `X-Hub-Signature-256` HMAC imzası ve
// `hub.challenge` GET doğrulaması vardı; Evolution'da ikisi de YOK. Yerine:
//   1. Yükteki `apikey` alanı  — Evolution her webhook'a kendi anahtarını koyar
//   2. Adresteki `?sir=` parametresi — bizim koyduğumuz, anahtar gelmezse yedek
// En az biri yapılandırılmışsa zorunludur; hiçbiri yoksa istek geçer ama
// kayda uyarı düşer (yalnızca kurulum aşaması için).
//
// ⚠ Cevap HEMEN 200 dönülüyor, bot `after()` içinde çalışıyor. Bot cevabı fiyat
// senaryosunda 13-24 saniye sürüyor; beklenirse Evolution isteği zaman aşımına
// düşürür ve aynı mesajı yeniden yollayabilir.

import { after, NextResponse } from 'next/server'
import { whatsappKanal } from '@/lib/channels/whatsapp'
import { gelenleriIsle } from '@/lib/gelen-tur'
import { hataKaydet } from '@/lib/hata-log'
import { ekipElleYazdiginiIsle } from '@/lib/mesajlar'

export const runtime = 'nodejs'

// ⚠ 16 Ağustos, sahada: bu satır YOKKEN Vercel varsayılan süre limiti, cevap
// üretimi uzun süren bir bot turunu (yerleşme 12 sn + model + düzeltme turu)
// after() içinde SESSİZCE kesti — ne cevap gitti ne hata kaydı düştü, müşteri
// öylece cevapsız kaldı. Kesilen iş iz bırakmaz; tek belirti bot_tur_at'in
// dolu kalmasıydı. Bot turunun tamamı bu limitin içinde yaşar.
export const maxDuration = 300

const API_ANAHTARI = process.env.EVOLUTION_API_KEY ?? ''
const WEBHOOK_SIR = process.env.EVOLUTION_WEBHOOK_SIR ?? ''

/**
 * Sağlık kontrolü. Evolution GET ile doğrulama yapmıyor (Meta yapıyordu);
 * bu uç nokta yalnızca "adres ayakta mı" sorusunu cevaplamak için duruyor.
 */
export async function GET() {
  return NextResponse.json({
    tamam: true,
    kanal: 'whatsapp',
    saglayici: 'evolution',
    // Canlıda HANGİ kodun koştuğunun kanıtı. yayinla.mjs her dağıtımda git
    // hash'ini KOD_SURUMU olarak yazar; canli-dogrula.mjs yereldeki hash ile
    // karşılaştırır. 15 Ağustos dersi: "dağıtım başarılı" 8 saat boyunca
    // "canlı kod güncel" sanıldı — webhook başka projeye bakıyordu.
    surum: process.env.KOD_SURUMU ?? 'bilinmiyor',
  })
}

export async function POST(req: Request) {
  let yuk: unknown
  try {
    yuk = await req.json()
  } catch {
    return NextResponse.json({ hata: 'geçersiz JSON' }, { status: 400 })
  }

  if (!yetkiliMi(req, yuk)) {
    return NextResponse.json({ hata: 'yetkisiz' }, { status: 401 })
  }

  const mesajlar = whatsappKanal.gelenMesajiCoz(yuk)

  // Evolution bağlantı durumu, okundu bilgisi, kişi güncellemesi gibi onlarca
  // olay yolluyor; müşteri mesajı yoksa yapılacak iş de yok.
  // Kaydetme, yerleşme beklemesi ve bot turu ortak akışta (lib/gelen-tur.ts):
  // müşteri arka arkaya yazdığında tek cevap üretilmesini o sağlıyor.
  if (mesajlar.length > 0) {
    after(() => gelenleriIsle('wa-webhook', mesajlar))
  }

  // İşletme hattından ÇIKAN mesajlar. Bot tetiklenmez — tam tersi, susturulur:
  // ekip telefondan cevap yazdıysa yazışma devre geçer (Fatih Bey, 15 Ağustos:
  // "Biz mesaja cevap verdikten sonra bot devreden çıksın"). Botun kendi
  // gönderdiği mesaj da buraya düşer; ayrımı ekipElleYazdiginiIsle yapıyor.
  const gidenler = whatsappKanal.gidenEkipMesajiCoz?.(yuk) ?? []
  if (gidenler.length > 0) {
    after(async () => {
      for (const giden of gidenler) {
        try {
          await ekipElleYazdiginiIsle(giden)
        } catch (e) {
          await hataKaydet('wa-webhook', 'ekip mesajı işlenemedi', e)
        }
      }
    })
  }

  // Her hâlükârda 200: hata dönersek Evolution'ın yeniden deneme kuyruğu şişer.
  return NextResponse.json({ tamam: true, mesaj: mesajlar.length, giden: gidenler.length })
}

/**
 * İsteğin gerçekten kendi Evolution sunucumuzdan geldiğini doğrular.
 *
 * Meta'daki HMAC imzasının yerini tutmaz — Evolution paylaşılan sır modeli
 * kullanıyor. Yine de webhook adresini bilen herkesin bota mesaj uydurmasını
 * engelliyor ki bu, korunmasız bırakılırsa gerçek bir istismar yolu olurdu.
 */
function yetkiliMi(req: Request, yuk: unknown): boolean {
  // 1. Yükteki apikey (Evolution kendi koyuyor)
  if (API_ANAHTARI) {
    const gelen =
      typeof yuk === 'object' && yuk !== null
        ? (yuk as { apikey?: unknown }).apikey
        : undefined
    if (typeof gelen === 'string' && gelen === API_ANAHTARI) return true
  }

  // 2. Adresteki gizli parametre (webhook URL'sine ?sir=... diye eklenir)
  if (WEBHOOK_SIR) {
    const sir = new URL(req.url).searchParams.get('sir')
    if (sir === WEBHOOK_SIR) return true
  }

  // Hiçbir doğrulama yapılandırılmamışsa kurulum aşamasındayız: geçir ama
  // sessiz kalma. Üretimde bu satırın loga düşmesi yapılandırma hatasıdır.
  if (!API_ANAHTARI && !WEBHOOK_SIR) {
    console.warn('[wa-webhook] EVOLUTION_API_KEY / EVOLUTION_WEBHOOK_SIR yok, doğrulama atlandı')
    return true
  }

  return false
}
