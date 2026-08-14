import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Oturum çerezini tazeler ve panel sayfalarını korur.
// Tek yönetici kullanıcı (KAPSAM karar 10): oturum varsa her yere girer, yoksa /giris.

// Oturum çerezi olmayan ama meşru istekler. Her biri KENDİ yetkisini kendi
// doğrular; middleware'in burada yapacağı tek doğru iş yoldan çekilmek:
//   /api/mock — sahte kanal webhook'u, üretimde kendini kapatıyor
//   /api/cron — zamanlanmış işler, Authorization: Bearer CRON_SECRET ile korunuyor.
//               Buraya eklenmezse Supabase pg_cron çağrısı /giris'e yönlendirilir
//               ve HİÇBİR zamanlanmış iş çalışmaz.
//   /api/webhooks — Meta webhook'ları (imza doğrulaması kanal katmanında)
//   /gizlilik — gizlilik politikası. Meta uygulamayı yayınlarken bu adresi
//               herkese açık olarak çekiyor; girişe kapalı olursa yayın reddedilir.
const ACIK_YOLLAR = ['/giris', '/api/mock', '/api/cron', '/api/webhooks', '/gizlilik']

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return res

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return req.cookies.getAll()
      },
      setAll(liste) {
        for (const { name, value } of liste) req.cookies.set(name, value)
        res = NextResponse.next({ request: req })
        for (const { name, value, options } of liste) res.cookies.set(name, value, options)
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const yol = req.nextUrl.pathname
  const acik = ACIK_YOLLAR.some((p) => yol === p || yol.startsWith(`${p}/`))

  if (!user && !acik) {
    const hedef = req.nextUrl.clone()
    hedef.pathname = '/giris'
    hedef.searchParams.set('devam', yol)
    return NextResponse.redirect(hedef)
  }

  if (user && yol === '/giris') {
    const hedef = req.nextUrl.clone()
    hedef.pathname = '/'
    hedef.search = ''
    return NextResponse.redirect(hedef)
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
