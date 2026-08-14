'use client'

import { useState, useTransition } from 'react'
import { randevuIptalEt, randevuZamaniGuncelle } from './eylemler'

/**
 * Randevu saatini gösterir ve düzeltmeye izin verir.
 *
 * Neden düzeltilebilir olmalı: bot müşterinin "cumartesi öğleden sonra"
 * ifadesini 14:00'e çeviriyor. Bu bir tahmin; gerçek saat ekiple telefonda
 * değişebiliyor. Hatırlatma mesajı bu alana bağlı olduğundan yanlış kalırsa
 * müşteriye yanlış saat hatırlatılır.
 */
export function RandevuZamani({
  talepId,
  randevuAt,
  iptalMi,
}: {
  talepId: string
  randevuAt: string | null
  iptalMi: boolean
}) {
  const [deger, setDeger] = useState(() => yereleCevir(randevuAt))
  const [durum, setDurum] = useState<string | null>(null)
  const [bekliyor, basla] = useTransition()

  function kaydet() {
    if (!deger) {
      setDurum('Önce bir tarih seçin.')
      return
    }
    basla(async () => {
      const sonuc = await randevuZamaniGuncelle(talepId, deger)
      setDurum(sonuc.mesaj)
    })
  }

  function iptal() {
    basla(async () => {
      const sonuc = await randevuIptalEt(talepId)
      setDurum(sonuc.mesaj)
    })
  }

  return (
    <div className="mt-3 border-t border-cizgi pt-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-metin-silik">
            Randevu zamanı {randevuAt ? '' : '(bot netleştiremedi)'}
          </span>
          <input
            type="datetime-local"
            value={deger}
            onChange={(e) => setDeger(e.target.value)}
            disabled={bekliyor || iptalMi}
            className="rounded-md border border-cizgi bg-arka px-2 py-1.5 text-[13px] disabled:opacity-50"
          />
        </label>

        <button
          type="button"
          onClick={kaydet}
          disabled={bekliyor || iptalMi}
          className="rounded-md border border-cizgi px-3 py-1.5 text-xs hover:bg-yuzey-2 disabled:opacity-50"
        >
          Kaydet
        </button>

        {!iptalMi && (
          <button
            type="button"
            onClick={iptal}
            disabled={bekliyor}
            className="rounded-md px-3 py-1.5 text-xs text-metin-soluk hover:text-metin disabled:opacity-50"
          >
            Randevuyu iptal et
          </button>
        )}
      </div>

      {randevuAt && !iptalMi && (
        <p className="mt-1.5 text-[11px] text-metin-silik">
          Hatırlatma müşteriye randevudan 24 saat önce gider.
        </p>
      )}
      {!randevuAt && !iptalMi && (
        <p className="mt-1.5 text-[11px] text-metin-silik">
          Zaman girilmediği sürece hatırlatma gönderilmez.
        </p>
      )}
      {durum && <p className="mt-1.5 text-[11px] text-amber">{durum}</p>}
    </div>
  )
}

/**
 * ISO (UTC) → datetime-local değeri, Türkiye saatiyle.
 * `toISOString().slice(0,16)` kullanmak UTC gösterirdi ve saat 3 saat geri
 * görünürdü; ekip yanlış saati düzeltmeye çalışırdı.
 */
function yereleCevir(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''

  const parcalar = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)

  const al = (t: string) => parcalar.find((p) => p.type === t)?.value ?? ''
  return `${al('year')}-${al('month')}-${al('day')}T${al('hour')}:${al('minute')}`
}
