// Instagram DM webhook'u — DOĞRULAMA KATMANI.
//
// WhatsApp rotasıyla aynı iş: GET hub.challenge + POST imza kontrolü.
// Mesaj çözümü `lib/channels/instagram.ts` doldurulunca bağlanacak.
//
// ⚠ Instagram tarafında imza aynı app secret ile hesaplanır ("Instagram API
// with Instagram Login" yolunda Instagram uygulamasının kendi secret'ı olur —
// farklıysa META_INSTAGRAM_APP_SECRET tanımlanır, yoksa META_APP_SECRET kullanılır).
//
// KAPSAM DIŞI: Instagram yorumları. Sadece DM.

import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'

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
    console.error('[meta/instagram] META_WEBHOOK_VERIFY_TOKEN tanımlı değil')
    return new Response('yapılandırma eksik', { status: 500 })
  }

  if (mod === 'subscribe' && jeton === DOGRULAMA_JETONU && meydanOkuma) {
    return new Response(meydanOkuma, {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    })
  }

  return new Response('doğrulanamadı', { status: 403 })
}

export async function POST(req: Request) {
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

  // TODO: instagramKanal.gelenMesajiCoz(yuk) → gelenMesajiKaydet(...)
  // Reklamdan gelen DM'lerde yükteki `referral` alanı da taşınacak.
  console.log('[meta/instagram] gelen olay:', JSON.stringify(yuk))

  return NextResponse.json({ tamam: true })
}

function imzaGecerliMi(req: Request, hamGovde: string): boolean {
  if (!APP_SECRET) {
    console.warn('[meta/instagram] app secret yok, imza kontrolü atlandı')
    return true
  }

  const baslik = req.headers.get('x-hub-signature-256')
  if (!baslik?.startsWith('sha256=')) return false

  const beklenen = createHmac('sha256', APP_SECRET).update(hamGovde).digest('hex')
  const gelen = baslik.slice('sha256='.length)

  if (gelen.length !== beklenen.length) return false
  return timingSafeEqual(Buffer.from(gelen, 'hex'), Buffer.from(beklenen, 'hex'))
}
