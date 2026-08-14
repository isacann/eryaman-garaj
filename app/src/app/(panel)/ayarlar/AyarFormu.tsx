'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { ayarlariKaydet, type AyarSonucu } from './eylemler'
import type { Settings } from '@/lib/db/types'

function Kaydet() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-amber px-4 py-2 text-sm font-semibold text-zemin transition-colors hover:bg-amber-koyu disabled:opacity-50"
    >
      {pending ? 'Kaydediliyor...' : 'Kaydet'}
    </button>
  )
}

function Anahtar({
  ad,
  etiket,
  aciklama,
  varsayilan,
}: {
  ad: string
  etiket: string
  aciklama: string
  varsayilan: boolean
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-cizgi bg-yuzey p-4">
      <input
        type="checkbox"
        name={ad}
        defaultChecked={varsayilan}
        className="mt-0.5 size-4 accent-amber"
      />
      <span>
        <span className="block text-sm font-medium">{etiket}</span>
        <span className="mt-0.5 block text-[13px] text-metin-soluk">{aciklama}</span>
      </span>
    </label>
  )
}

export default function AyarFormu({ ayarlar }: { ayarlar: Settings }) {
  const [sonuc, eylem] = useActionState<AyarSonucu | null, FormData>(ayarlariKaydet, null)

  return (
    <form action={eylem} className="mt-8 space-y-4">
      <div className="rounded-xl border border-cizgi bg-yuzey p-4">
        <p className="text-sm font-medium">Çalışma saatleri</p>
        <p className="mt-0.5 text-[13px] text-metin-soluk">
          Bu aralığın dışında bot tek bir mesai dışı mesajı atar, asıl cevabı açılışta
          yazar.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="baslangic" className="mb-1.5 block text-[11px] text-metin-silik">
              Başlangıç
            </label>
            <input
              id="baslangic"
              name="baslangic"
              type="time"
              required
              defaultValue={ayarlar.calisma_saati_baslangic.slice(0, 5)}
              className="rounded-lg border border-cizgi bg-yuzey-2 px-3 py-2 text-sm outline-none focus:border-cizgi-parlak"
            />
          </div>
          <div>
            <label htmlFor="bitis" className="mb-1.5 block text-[11px] text-metin-silik">
              Bitiş
            </label>
            <input
              id="bitis"
              name="bitis"
              type="time"
              required
              defaultValue={ayarlar.calisma_saati_bitis.slice(0, 5)}
              className="rounded-lg border border-cizgi bg-yuzey-2 px-3 py-2 text-sm outline-none focus:border-cizgi-parlak"
            />
          </div>
        </div>
      </div>

      <Anahtar
        ad="bot_aktif"
        etiket="Bot açık"
        aciklama="Kapatılırsa gelen mesajlar yalnızca panele düşer, bot cevap yazmaz."
        varsayilan={ayarlar.bot_aktif}
      />

      <Anahtar
        ad="takip_aktif"
        etiket="Takip mesajları (3. ve 20. saat)"
        aciklama="Cevapsız kalan yazışmalara hatırlatma gönderir. Yanıt penceresi içinde olduğu için ücretsiz. Müşteri yazarsa ya da ekip devralırsa iptal olur."
        varsayilan={ayarlar.takip_aktif}
      />

      <Anahtar
        ad="sablon_takip_aktif"
        etiket="24 saat sonrası şablon takibi"
        aciklama="Yanıt penceresi kapandıktan sonra Meta'nın onayladığı şablonu gönderir. Ücretli, Meta onayı gerekir."
        varsayilan={ayarlar.sablon_takip_aktif}
      />

      <Anahtar
        ad="telegram_aktif"
        etiket="Telegram bildirimleri"
        aciklama="Randevu talebi, devir ve sıcak müşteri haberleri Telegram'a düşer. Kapatılırsa bildirim gitmez, panel yine çalışır."
        varsayilan={ayarlar.telegram_aktif}
      />

      <div className="flex items-center gap-3 pt-1">
        <Kaydet />
        {sonuc && (
          <span className={`text-xs ${sonuc.tamam ? 'text-yesil' : 'text-kirmizi'}`}>
            {sonuc.mesaj}
          </span>
        )}
      </div>
    </form>
  )
}
