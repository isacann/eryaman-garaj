'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabaseTarayici } from '@/lib/supabase/tarayici'

const BAGLANTILAR = [
  { yol: '/', etiket: 'Gelen kutusu' },
  { yol: '/randevular', etiket: 'Randevu talepleri' },
  { yol: '/test', etiket: 'Test konsolu' },
  { yol: '/egitim', etiket: 'Bot eğitimi' },
  { yol: '/ayarlar', etiket: 'Ayarlar' },
]

export default function YanMenu({ eposta }: { eposta: string }) {
  const yol = usePathname()
  const router = useRouter()

  function aktifMi(hedef: string) {
    if (hedef === '/') return yol === '/' || yol.startsWith('/sohbet')
    return yol.startsWith(hedef)
  }

  async function cikis() {
    await supabaseTarayici().auth.signOut()
    router.replace('/giris')
    router.refresh()
  }

  return (
    <aside className="flex shrink-0 flex-col border-b border-cizgi bg-yuzey md:h-screen md:w-60 md:border-r md:border-b-0">
      <div className="px-5 pt-5 pb-4">
        <p className="font-mono text-[10px] tracking-[0.28em] text-amber uppercase">
          Eryaman Garaj
        </p>
        <p className="mt-1 text-sm font-medium">Yanıt paneli</p>
      </div>

      <nav className="flex gap-1 px-3 pb-3 md:flex-col md:pb-0">
        {BAGLANTILAR.map((b) => {
          const aktif = aktifMi(b.yol)
          return (
            <Link
              key={b.yol}
              href={b.yol}
              aria-current={aktif ? 'page' : undefined}
              className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                aktif
                  ? 'bg-yuzey-2 font-medium text-metin'
                  : 'text-metin-soluk hover:bg-yuzey-2 hover:text-metin'
              }`}
            >
              {b.etiket}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto hidden border-t border-cizgi px-5 py-4 md:block">
        <p className="truncate text-xs text-metin-silik">{eposta}</p>
        <button
          type="button"
          onClick={cikis}
          className="mt-2 text-xs text-metin-soluk transition-colors hover:text-amber"
        >
          Çıkış yap
        </button>
      </div>
    </aside>
  )
}
