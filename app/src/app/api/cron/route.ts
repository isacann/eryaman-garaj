// Zamanlanmış işler. Supabase pg_cron her 5 dakikada bir burayı çağırır.
//
// NEDEN VERCEL CRON DEĞİL: Vercel'in Hobby planında cron günde YALNIZCA bir kez
// çalışabiliyor; daha sık bir ifade yazılırsa dağıtım hata veriyor. Günde bir
// tetikleme ile 3. saat takibi de 15 dakika kuralı da anlamsızlaşırdı. Supabase
// zaten altyapımızda ve pg_cron ücretsiz katmanda mevcut, ek hesap/masraf yok.
// Fatih Bey ileride Vercel Pro'ya geçerse vercel.json'a crons bloğu eklenip bu
// rota aynen kullanılabilir; kodda değişiklik gerekmez.
// Kurulum: node scripts/cron-kur.mjs
//
// Dört iş, bu sırayla:
//   1. Sabah kuyruğu   — gece gelip cevapsız kalan yazışmaların asıl cevabı (karar 5)
//   2. 15 dk kuralı    — devir bayrağı kalkmış ama ekip yazmamışsa hatırlatma (karar 4)
//   3. Takip merdiveni — 3. saat / 20. saat / şablon (karar 6)
//   4. Bildirim kuyruğu— ertelenmiş ve gönderilememiş Telegram bildirimleri (Bölüm 5)
//
// Sıra tesadüf değil: önce müşteriye gidecek mesajlar üretilir, en sonda
// Fatih Bey'e haber verilir; böylece bildirim geldiğinde panelde her şey hazır.
//
// GÜVENLİK: Vercel Cron `Authorization: Bearer $CRON_SECRET` yollar. Sır
// tanımlıysa doğrulanır. Sır tanımlı DEĞİLSE üretimde rota kapalıdır —
// açıkta kalan bir uç noktanın botu tetiklemesindense hiç çalışmaması yeğdir.

import { NextResponse } from 'next/server'

import { bekleyenBildirimleriGonder, sistemUyarisi } from '@/lib/bildirim'
import { mesaiKuyrugunuIslet } from '@/lib/bot'
import { devirHatirlatmalariniIslet } from '@/lib/devir'
import { cronSirri } from '@/lib/env'
import { bekleyenTakipleriGonder } from '@/lib/takip'

// Zamanlanmış iş: önbelleğe alınmamalı, her çağrıda gerçekten çalışmalı.
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function yetkiliMi(req: Request): boolean {
  const sir = cronSirri()

  if (!sir) {
    // Geliştirmede elle tetiklemeye izin var, üretimde yok.
    return process.env.NODE_ENV !== 'production'
  }

  const baslik = req.headers.get('authorization')
  return baslik === `Bearer ${sir}`
}

async function isleriCalistir() {
  const an = new Date()

  // Her iş kendi içinde yutulur: biri patlarsa diğerleri yine de çalışsın.
  const sonuc: Record<string, unknown> = { an: an.toISOString() }

  try {
    sonuc.mesaiKuyrugu = await mesaiKuyrugunuIslet(an)
  } catch (e) {
    sonuc.mesaiKuyruguHata = e instanceof Error ? e.message : 'bilinmeyen hata'
  }

  try {
    sonuc.devirHatirlatma = await devirHatirlatmalariniIslet(an)
  } catch (e) {
    sonuc.devirHatirlatmaHata = e instanceof Error ? e.message : 'bilinmeyen hata'
  }

  try {
    sonuc.takip = await bekleyenTakipleriGonder(an)
  } catch (e) {
    sonuc.takipHata = e instanceof Error ? e.message : 'bilinmeyen hata'
  }

  try {
    sonuc.bildirim = await bekleyenBildirimleriGonder(an)
  } catch (e) {
    sonuc.bildirimHata = e instanceof Error ? e.message : 'bilinmeyen hata'
  }

  // Bir iş patladıysa Operiqo haberdar olsun; sessiz bozulma en kötüsü.
  const hatalar = Object.entries(sonuc).filter(([k]) => k.endsWith('Hata'))
  if (hatalar.length > 0) {
    await sistemUyarisi(
      'Zamanlanmış işlerde hata',
      hatalar.map(([k, v]) => `${k}: ${String(v)}`).join('\n'),
    )
  }

  return sonuc
}

export async function GET(req: Request) {
  if (!yetkiliMi(req)) {
    return NextResponse.json({ hata: 'yetkisiz' }, { status: 401 })
  }
  return NextResponse.json({ tamam: true, ...(await isleriCalistir()) })
}

// Vercel Cron GET kullanır; POST elle tetikleme ve test içindir.
export async function POST(req: Request) {
  return GET(req)
}
