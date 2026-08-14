'use client'

// Telegram kurulum kutusu (KAPSAM Bölüm 7: "Telegram — Fatih Bey kuracak").
//
// Akış: bota /start yazılır → "Bağlantıyı kur" → "Test mesajı gönder".
// Sohbet kimliğini elle sormuyoruz; bota yazan son kişiden okuyoruz, çünkü
// kimliği kullanıcıya buldurmak bu kurulumun en çok hata veren adımı.

import { useState, useTransition } from 'react'
import { telegramBagla, telegramTest, type AyarSonucu } from './eylemler'

export default function TelegramKur({ chatId }: { chatId: string | null }) {
  const [sonuc, setSonuc] = useState<AyarSonucu | null>(null)
  const [bekliyor, basla] = useTransition()

  function calistir(eylem: () => Promise<AyarSonucu>) {
    setSonuc(null)
    basla(async () => setSonuc(await eylem()))
  }

  const bagliMi = Boolean(chatId)

  return (
    <div className="rounded-xl border border-cizgi bg-yuzey p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Telegram bağlantısı</p>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] ${
            bagliMi ? 'bg-yesil/15 text-yesil' : 'bg-yuzey-2 text-metin-silik'
          }`}
        >
          {bagliMi ? 'bağlı' : 'bağlı değil'}
        </span>
      </div>

      <ol className="mt-3 space-y-1 text-[13px] text-metin-soluk">
        <li>1. Telegram&apos;da Eryaman Garaj botunu açıp <b>/start</b> yazın.</li>
        <li>2. Aşağıdaki &quot;Bağlantıyı kur&quot; düğmesine basın.</li>
        <li>3. Test mesajı gönderip geldiğini görün.</li>
      </ol>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => calistir(telegramBagla)}
          disabled={bekliyor}
          className="rounded-lg border border-cizgi bg-yuzey-2 px-3 py-2 text-sm transition-colors hover:border-cizgi-parlak disabled:opacity-50"
        >
          {bekliyor ? 'Bekleyin...' : 'Bağlantıyı kur'}
        </button>

        <button
          type="button"
          onClick={() => calistir(telegramTest)}
          disabled={bekliyor || !bagliMi}
          className="rounded-lg border border-cizgi bg-yuzey-2 px-3 py-2 text-sm transition-colors hover:border-cizgi-parlak disabled:opacity-50"
        >
          Test mesajı gönder
        </button>
      </div>

      {sonuc && (
        <p className={`mt-3 text-xs ${sonuc.tamam ? 'text-yesil' : 'text-kirmizi'}`}>
          {sonuc.mesaj}
        </p>
      )}
    </div>
  )
}
