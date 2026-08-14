import Link from 'next/link'
import { randevulariGetir } from '@/lib/db/sorgular'
import { kisiAdi, tamZaman } from '@/lib/bicim'
import { KanalRozeti, RandevuRozeti } from '@/components/Rozet'

export const dynamic = 'force-dynamic'

export default async function RandevularSayfasi() {
  const satirlar = await randevulariGetir()

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 md:px-10 md:py-10">
      <h1 className="text-[15px] font-semibold">Randevu talepleri</h1>
      <p className="mt-1.5 max-w-prose text-[13px] text-metin-soluk">
        Bot uygun saati konuşur, talep buraya düşer. Teyidi ekip verir, takvim kaydı
        yapılmaz.
      </p>

      {satirlar.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-cizgi px-4 py-10 text-center text-sm text-metin-silik">
          Bekleyen randevu talebi yok.
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {satirlar.map(({ talep, kisi, konusma }) => (
            <li key={talep.id} className="rounded-xl border border-cizgi bg-yuzey p-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="text-sm font-medium">
                  {kisiAdi(kisi?.ad ?? null, kisi?.kanal_kimlik ?? '—')}
                </span>
                {konusma && <KanalRozeti kanal={konusma.kanal} />}
                <RandevuRozeti durum={talep.durum} />
                <span className="ml-auto font-mono text-[11px] text-metin-silik">
                  {tamZaman(talep.created_at)}
                </span>
              </div>

              <dl className="mt-3 grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-3">
                <div>
                  <dt className="text-[11px] text-metin-silik">İstenen zaman</dt>
                  <dd className="mt-0.5">{talep.istenen_zaman_metin ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-metin-silik">Araç</dt>
                  <dd className="mt-0.5">{talep.arac ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-metin-silik">Hizmet</dt>
                  <dd className="mt-0.5">{talep.hizmet ?? '—'}</dd>
                </div>
              </dl>

              {konusma && (
                <Link
                  href={`/sohbet/${konusma.id}`}
                  className="mt-3 inline-block text-xs text-amber underline-offset-2 hover:underline"
                >
                  Yazışmayı aç
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
