// Sahte kanal webhook'u. Meta erişimi olmadan uçtan uca akışı çalıştırmak için.
// Sadece geliştirmede açık (mockKanal.webhookDogrula üretimde false döner).
//
// Örnek:
//   curl -X POST http://localhost:3000/api/mock/gelen \
//     -H "content-type: application/json" \
//     -d '{"kimlik":"905551112233","ad":"Test","metin":"PPF fiyatı nedir?"}'

import { NextResponse } from 'next/server'
import { mockKanal } from '@/lib/channels/mock'
import { gelenMesajiKaydet } from '@/lib/mesajlar'

export async function POST(req: Request) {
  if (!(await mockKanal.webhookDogrula(req))) {
    return NextResponse.json({ hata: 'kapalı' }, { status: 403 })
  }

  let yuk: unknown
  try {
    yuk = await req.json()
  } catch {
    return NextResponse.json({ hata: 'geçersiz JSON' }, { status: 400 })
  }

  const mesajlar = mockKanal.gelenMesajiCoz(yuk)
  if (mesajlar.length === 0) {
    return NextResponse.json({ hata: 'çözülecek mesaj yok' }, { status: 400 })
  }

  try {
    const sonuclar = []
    for (const mesaj of mesajlar) sonuclar.push(await gelenMesajiKaydet(mesaj))
    return NextResponse.json({ tamam: true, sonuclar })
  } catch (e) {
    const mesaj = e instanceof Error ? e.message : 'bilinmeyen hata'
    return NextResponse.json({ hata: mesaj }, { status: 500 })
  }
}
