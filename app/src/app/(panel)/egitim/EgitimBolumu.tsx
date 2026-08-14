'use client'

// Bot eğitimi sayfasının tek bölümü. Üç tür de (bilgi / davranış / reklam)
// aynı bileşeni kullanıyor; aralarındaki tek fark reklam kaydının bir eşleşme
// anahtarı istemesi.

import { useState, useTransition } from 'react'

import { egitimDurumDegistir, egitimEkle, egitimSil, type EgitimSonucu } from './eylemler'
import type { BotEgitim, EgitimTuru } from '@/lib/db/types'

type Props = {
  tur: EgitimTuru
  baslik: string
  aciklama: string
  ornekBaslik: string
  ornekIcerik: string
  ornekAnahtar?: string
  anahtarli?: boolean
  kayitlar: BotEgitim[]
}

/** Kampanyanın son günü geçti mi. Bot bunları artık müşteriye söylemiyor. */
function suresiDolmusMu(gun: string): boolean {
  return gun < new Date().toISOString().slice(0, 10)
}

export default function EgitimBolumu({
  tur,
  baslik,
  aciklama,
  ornekBaslik,
  ornekIcerik,
  ornekAnahtar,
  anahtarli = false,
  kayitlar,
}: Props) {
  const [yeniBaslik, setYeniBaslik] = useState('')
  const [yeniIcerik, setYeniIcerik] = useState('')
  const [yeniAnahtar, setYeniAnahtar] = useState('')
  const [yeniBitis, setYeniBitis] = useState('')
  const [sonuc, setSonuc] = useState<EgitimSonucu | null>(null)
  const [bekliyor, basla] = useTransition()

  function calistir(eylem: () => Promise<EgitimSonucu>, temizle = false) {
    setSonuc(null)
    basla(async () => {
      const s = await eylem()
      setSonuc(s)
      if (s.tamam && temizle) {
        setYeniBaslik('')
        setYeniIcerik('')
        setYeniAnahtar('')
        setYeniBitis('')
      }
    })
  }

  return (
    <section>
      <h2 className="text-sm font-medium">{baslik}</h2>
      <p className="mt-1 text-[13px] text-metin-soluk">{aciklama}</p>

      <div className="mt-4 space-y-2 rounded-xl border border-cizgi bg-yuzey p-4">
        <input
          value={yeniBaslik}
          onChange={(e) => setYeniBaslik(e.target.value)}
          placeholder={`Başlık — örn. "${ornekBaslik}"`}
          className="w-full rounded-lg border border-cizgi bg-yuzey-2 px-3 py-2 text-sm outline-none focus:border-cizgi-parlak"
        />

        {anahtarli && (
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={yeniAnahtar}
              onChange={(e) => setYeniAnahtar(e.target.value)}
              placeholder={`Reklam anahtarı — örn. "${ornekAnahtar ?? 'cam filmi'}"`}
              className="w-full rounded-lg border border-cizgi bg-yuzey-2 px-3 py-2 text-sm outline-none focus:border-cizgi-parlak"
            />
            <label className="flex items-center gap-2 rounded-lg border border-cizgi bg-yuzey-2 px-3 py-2 text-sm">
              <span className="shrink-0 text-metin-silik">Son gün</span>
              <input
                type="date"
                value={yeniBitis}
                onChange={(e) => setYeniBitis(e.target.value)}
                className="w-full bg-transparent outline-none"
              />
            </label>
          </div>
        )}

        <textarea
          value={yeniIcerik}
          onChange={(e) => setYeniIcerik(e.target.value)}
          rows={4}
          placeholder={`İçerik — örn. "${ornekIcerik}"`}
          className="w-full resize-y rounded-lg border border-cizgi bg-yuzey-2 px-3 py-2 text-sm outline-none focus:border-cizgi-parlak"
        />

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={bekliyor || !yeniBaslik.trim() || !yeniIcerik.trim()}
            onClick={() =>
              calistir(
                () =>
                  egitimEkle({
                    tur,
                    baslik: yeniBaslik,
                    icerik: yeniIcerik,
                    anahtar: anahtarli ? yeniAnahtar : null,
                    gecerliBitis: anahtarli ? yeniBitis : null,
                  }),
                true,
              )
            }
            className="rounded-lg border border-cizgi bg-yuzey-2 px-3 py-2 text-sm transition-colors hover:border-cizgi-parlak disabled:opacity-50"
          >
            {bekliyor ? 'Bekleyin...' : 'Ekle'}
          </button>
          <span className="text-[11px] text-metin-silik">{yeniIcerik.length} karakter</span>
        </div>

        {sonuc && (
          <p className={`text-[12px] ${sonuc.tamam ? 'text-yesil' : 'text-kirmizi'}`}>
            {sonuc.mesaj}
          </p>
        )}
      </div>

      {kayitlar.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-cizgi px-4 py-6 text-center text-[13px] text-metin-silik">
          Henüz kayıt yok.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {kayitlar.map((k) => (
            <li
              key={k.id}
              className={`rounded-lg border border-cizgi bg-yuzey p-3 ${k.aktif ? '' : 'opacity-55'}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{k.baslik}</p>
                  {k.anahtar && (
                    <p className="mt-0.5 font-mono text-[11px] text-amber">
                      eşleşme: {k.anahtar}
                    </p>
                  )}
                  {k.gecerli_bitis && (
                    <p
                      className={`mt-0.5 text-[11px] ${
                        suresiDolmusMu(k.gecerli_bitis) ? 'text-kirmizi' : 'text-metin-silik'
                      }`}
                    >
                      {suresiDolmusMu(k.gecerli_bitis)
                        ? `süresi doldu (${k.gecerli_bitis}) — bot artık söylemiyor`
                        : `son gün: ${k.gecerli_bitis}`}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={bekliyor}
                    onClick={() => calistir(() => egitimDurumDegistir(k.id, !k.aktif))}
                    className="rounded-md border border-cizgi px-2 py-1 text-[12px] transition-colors hover:border-cizgi-parlak disabled:opacity-50"
                  >
                    {k.aktif ? 'Kapat' : 'Aç'}
                  </button>
                  <button
                    type="button"
                    disabled={bekliyor}
                    onClick={() => calistir(() => egitimSil(k.id))}
                    className="rounded-md border border-cizgi px-2 py-1 text-[12px] text-kirmizi transition-colors hover:border-kirmizi disabled:opacity-50"
                  >
                    Sil
                  </button>
                </div>
              </div>
              <p className="mt-2 whitespace-pre-line text-[13px] text-metin-soluk">{k.icerik}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
