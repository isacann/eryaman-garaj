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

export const runtime = 'nodejs'

const API_ANAHTARI = process.env.EVOLUTION_API_KEY ?? ''
const WEBHOOK_SIR = process.env.EVOLUTION_WEBHOOK_SIR ?? ''

/**
 * Sağlık kontrolü. Evolution GET ile doğrulama yapmıyor (Meta yapıyordu);
 * bu uç nokta yalnızca "adres ayakta mı" sorusunu cevaplamak için duruyor.
 */
export async function GET() {
  return NextResponse.json({ tamam: true, kanal: 'whatsapp', saglayici: 'evolution' })
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

  // Her hâlükârda 200: hata dönersek Evolution'ın yeniden deneme kuyruğu şişer.
  return NextResponse.json({ tamam: true, mesaj: mesajlar.length })
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
