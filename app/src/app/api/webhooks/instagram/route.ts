// Instagram DM webhook'u.
//
//   GET  → hub.challenge doğrulaması (Meta panelinde "Verify and save" bunu çağırır)
//   POST → X-Hub-Signature-256 imza kontrolü → mesajı kaydet → botu çalıştır
//
// 14 Ağustos 2026'da bota bağlandı. Öncesinde yalnızca imzayı doğrulayıp olayı
// konsola yazıyordu; gelen DM'ler hiçbir yere kaydedilmiyordu.
//
// ⚠ Meta POST'a ~5 saniye içinde 200 beklemezse isteği YENİDEN gönderiyor.
// Bot cevabı fiyat senaryosunda 13-24 saniye sürüyor; awaite edilirse Meta
// timeout'a düşer ve aynı mesaj tekrar tekrar işlenir. Bu yüzden 200 hemen
// dönülüyor, iş `after()` içinde yapılıyor.
//
// ⚠ İmza aynı app secret ile hesaplanır ("Instagram API with Instagram Login"
// yolunda Instagram uygulamasının kendi secret'ı olur — farklıysa
// META_INSTAGRAM_APP_SECRET tanımlanır, yoksa META_APP_SECRET kullanılır).
//
// ⚠ UYGULAMA LIVE MODA ALINMADAN gerçek DM'ler buraya DÜŞMEZ. Kod hazır ama
// Meta İşletme Doğrulaması tamamlanana kadar kanal sessiz kalır.
//
// KAPSAM DIŞI: Instagram yorumları. Sadece DM.

import { createHmac, timingSafeEqual } from 'node:crypto'
import { after, NextResponse } from 'next/server'
import { instagramKanal, instagramProfilAl } from '@/lib/channels/instagram'
import { gelenleriIsle } from '@/lib/gelen-tur'
import { supabaseServis } from '@/lib/supabase/sunucu'

export const runtime = 'nodejs'

const DOGRULAMA_JETONU = process.env.META_WEBHOOK_VERIFY_TOKEN ?? ''
const APP_SECRET =
  process.env.META_INSTAGRAM_APP_SECRET ?? process.env.META_APP_SECRET ?? ''

export async function GET(req: Request) {
  const parametreler = new URL(req.url).searchParams
  const mod = parametreler.get('hub.mode')
  const jeton = parametreler.get('hub.verify_token')
  const meydanOkuma = parametreler.get('hub.challenge')

  if (!DOGRULAMA_JETONU) {
    console.error('[ig-webhook] META_WEBHOOK_VERIFY_TOKEN tanımlı değil')
    return new Response('yapılandırma eksik', { status: 500 })
  }

  if (mod === 'subscribe' && jeton === DOGRULAMA_JETONU && meydanOkuma) {
    // Meta düz metin bekliyor, JSON değil.
    return new Response(meydanOkuma, {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    })
  }

  return new Response('doğrulanamadı', { status: 403 })
}

export async function POST(req: Request) {
  // Gövdeyi imza kontrolü için HAM haliyle okumak şart; JSON'a çevirip geri
  // dizersek boşluk/sıra değişir ve imza tutmaz.
  const hamGovde = await req.text()

  if (!imzaGecerliMi(req, hamGovde)) {
    return NextResponse.json({ hata: 'imza geçersiz' }, { status: 401 })
  }

  let yuk: unknown
  try {
    yuk = JSON.parse(hamGovde)
  } catch {
    return NextResponse.json({ hata: 'geçersiz JSON' }, { status: 400 })
  }

  const mesajlar = instagramKanal.gelenMesajiCoz(yuk)

  // Okundu/iletildi bildirimleri ve yorum olayları da bu adrese geliyor;
  // mesaj yoksa yapılacak iş de yok.
  // Kaydetme, yerleşme beklemesi ve bot turu ortak akışta (lib/gelen-tur.ts).
  // Instagram'a özel tek iş: webhook ad taşımadığı için yeni kişide profil
  // çekilip kaydediliyor — bot selamlamada ismi kullanabilsin diye.
  if (mesajlar.length > 0) {
    after(() =>
      gelenleriIsle('ig-webhook', mesajlar, (mesaj) => adiTamamla(mesaj.kanalKimlik)),
    )
  }

  // Meta'ya her hâlükârda 200: hata dönersek yeniden deneme kuyruğu şişer.
  return NextResponse.json({ tamam: true, mesaj: mesajlar.length })
}

/**
 * Kişinin adı boşsa Instagram'dan çekip yazar.
 *
 * Yalnızca adı olmayan kayıtta API'ye gidilir: her mesajda profil çekmek
 * gereksiz çağrı ve gecikme demek.
 */
async function adiTamamla(kanalKimlik: string): Promise<void> {
  const db = supabaseServis()
  const { data: kisi } = await db
    .from('contacts')
    .select('id, ad')
    .eq('kanal', 'instagram')
    .eq('kanal_kimlik', kanalKimlik)
    .maybeSingle()

  if (!kisi || kisi.ad) return

  const profil = await instagramProfilAl(kanalKimlik)
  if (!profil?.ad && !profil?.kullaniciAdi) return

  await db
    .from('contacts')
    .update({
      ad: profil.ad ?? profil.kullaniciAdi,
      instagram_kullanici: profil.kullaniciAdi,
    })
    .eq('id', kisi.id)
}

/**
 * X-Hub-Signature-256 kontrolü. App secret tanımlı değilse kontrol atlanır —
 * kurulum aşamasında endpoint'i doğrulayabilmek için. Üretimde secret ŞART.
 */
function imzaGecerliMi(req: Request, hamGovde: string): boolean {
  if (!APP_SECRET) {
    console.warn('[ig-webhook] app secret yok, imza kontrolü atlandı')
    return true
  }

  const baslik = req.headers.get('x-hub-signature-256')
  if (!baslik?.startsWith('sha256=')) return false

  const beklenen = createHmac('sha256', APP_SECRET).update(hamGovde).digest('hex')
  const gelen = baslik.slice('sha256='.length)

  // Uzunluk farklıysa timingSafeEqual patlar, önce kontrol et.
  if (gelen.length !== beklenen.length) return false
  return timingSafeEqual(Buffer.from(gelen, 'hex'), Buffer.from(beklenen, 'hex'))
}
