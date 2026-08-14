import Link from 'next/link'
import { konusmalariGetir } from '@/lib/db/sorgular'
import { kirp, kisaZaman, kisiAdi } from '@/lib/bicim'
import { DurumRozeti, KanalRozeti } from '@/components/Rozet'
import ListeKabi from '@/components/ListeKabi'
import SatirVurgu from '@/components/SatirVurgu'

export const dynamic = 'force-dynamic'

export default async function GelenKutusuDuzeni({ children }: { children: React.ReactNode }) {
  const satirlar = await konusmalariGetir()

  return (
    <div className="flex h-screen">
      <ListeKabi>
        <div className="flex items-baseline justify-between border-b border-cizgi px-5 py-4">
          <h1 className="text-[15px] font-semibold">Gelen kutusu</h1>
          <span className="font-mono text-[11px] text-metin-silik">{satirlar.length}</span>
        </div>

        {satirlar.length === 0 ? (
          <p className="m-5 rounded-lg border border-dashed border-cizgi px-4 py-8 text-center text-sm text-metin-silik">
            Henüz yazışma yok.
          </p>
        ) : (
          <ul>
            {satirlar.map(({ konusma, kisi, sonMesaj }) => {
              const isim = kisiAdi(kisi?.ad ?? null, kisi?.kanal_kimlik ?? '—')
              return (
                <li key={konusma.id}>
                  <SatirVurgu id={konusma.id}>
                    <Link
                      href={`/sohbet/${konusma.id}`}
                      className="block border-b border-cizgi px-5 py-3.5 transition-colors hover:bg-yuzey"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-sm font-medium">{isim}</span>
                        <span className="shrink-0 font-mono text-[11px] text-metin-silik">
                          {kisaZaman(konusma.son_mesaj_at)}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-[13px] text-metin-soluk">
                        {sonMesaj ? (kirp(sonMesaj.metin) || 'Görsel') : 'Mesaj yok'}
                      </p>
                      <div className="mt-2 flex gap-1.5">
                        <KanalRozeti kanal={konusma.kanal} />
                        {konusma.durum !== 'bot' && <DurumRozeti durum={konusma.durum} />}
                      </div>
                    </Link>
                  </SatirVurgu>
                </li>
              )
            })}
          </ul>
        )}
      </ListeKabi>

      <section className="min-w-0 flex-1 overflow-y-auto">{children}</section>
    </div>
  )
}
