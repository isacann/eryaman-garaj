'use client'

// Panelden elle cevap yazma kutusu ve devir düğmeleri.
// Ekip buraya bir şey yazdığı anda konuşma devre geçer, bot susar.

import { useState, useTransition } from 'react'
import { FIYAT_GORSELLERI } from '@/lib/fiyat-gorselleri'
import { botaGeriVer, ekipCevapGonder, fiyatGorseliGonder } from './eylemler'

export default function CevapKutusu({
  konusmaId,
  devirde,
}: {
  konusmaId: string
  devirde: boolean
}) {
  const [metin, setMetin] = useState('')
  const [hata, setHata] = useState<string | null>(null)
  const [bilgi, setBilgi] = useState<string | null>(null)
  const [bekliyor, basla] = useTransition()

  function gorselGonder(anahtar: string) {
    if (bekliyor) return
    setHata(null)
    setBilgi(null)
    basla(async () => {
      const sonuc = await fiyatGorseliGonder(konusmaId, anahtar)
      if (sonuc.tamam) setBilgi(sonuc.mesaj)
      else setHata(sonuc.mesaj)
    })
  }

  function gonder() {
    const yazi = metin.trim()
    if (!yazi || bekliyor) return
    setHata(null)
    basla(async () => {
      const sonuc = await ekipCevapGonder(konusmaId, yazi)
      if (sonuc.tamam) setMetin('')
      else setHata(sonuc.mesaj)
    })
  }

  function botaVer() {
    setHata(null)
    basla(async () => {
      const sonuc = await botaGeriVer(konusmaId)
      if (!sonuc.tamam) setHata(sonuc.mesaj)
    })
  }

  return (
    <div className="shrink-0 border-t border-cizgi bg-zemin px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-8">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[11px] text-metin-silik">
          {devirde
            ? 'Bu yazışmada bot susuyor, cevapları ekip yazıyor.'
            : 'Buraya yazarsan yazışmayı devralırsın, bot susar.'}
        </p>
        {devirde && (
          <button
            type="button"
            onClick={botaVer}
            disabled={bekliyor}
            className="shrink-0 rounded-lg border border-cizgi px-3 py-1.5 text-xs text-metin-soluk transition-colors hover:border-cizgi-parlak hover:text-metin disabled:opacity-50"
          >
            Bot&apos;a geri ver
          </button>
        )}
      </div>

      <div className="mb-2 flex flex-wrap gap-1.5">
        {FIYAT_GORSELLERI.map((g) => (
          <button
            key={g.anahtar}
            type="button"
            onClick={() => gorselGonder(g.anahtar)}
            disabled={bekliyor}
            title={`${g.ad} görselini müşteriye gönder`}
            className="rounded-lg border border-cizgi px-2.5 py-1 text-[11px] text-metin-soluk transition-colors hover:border-cizgi-parlak hover:text-metin disabled:opacity-50"
          >
            {g.ad}
          </button>
        ))}
      </div>

      {hata && <p className="mb-2 text-[12px] text-kirmizi">{hata}</p>}
      {bilgi && <p className="mb-2 text-[12px] text-yesil">{bilgi}</p>}

      <div className="flex items-end gap-2">
        <textarea
          value={metin}
          onChange={(e) => setMetin(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              gonder()
            }
          }}
          rows={1}
          placeholder="Cevabını yaz..."
          aria-label="Ekip cevabı"
          className="max-h-32 min-h-11 flex-1 resize-y rounded-lg border border-cizgi bg-yuzey px-3 py-2.5 text-sm outline-none placeholder:text-metin-silik focus:border-cizgi-parlak"
        />
        <button
          type="button"
          onClick={gonder}
          disabled={bekliyor || !metin.trim()}
          className="h-11 shrink-0 rounded-lg bg-amber px-4 text-sm font-semibold text-zemin transition-colors hover:bg-amber-koyu disabled:opacity-40"
        >
          {bekliyor ? '...' : 'Gönder'}
        </button>
      </div>
    </div>
  )
}
