import { ayarlariGetir } from '@/lib/db/sorgular'
import AyarFormu from './AyarFormu'
import TelegramKur from './TelegramKur'

export const dynamic = 'force-dynamic'

export default async function AyarlarSayfasi() {
  const ayarlar = await ayarlariGetir()

  return (
    <div className="mx-auto max-w-2xl px-5 py-8 md:px-10 md:py-10">
      <h1 className="text-[15px] font-semibold">Ayarlar</h1>
      <p className="mt-1.5 text-[13px] text-metin-soluk">
        Botun çalışma saatleri, takip davranışı ve bildirimler.
      </p>

      {ayarlar ? (
        <>
          <div className="mt-8">
            <TelegramKur chatId={ayarlar.telegram_chat_id} />
          </div>
          <AyarFormu ayarlar={ayarlar} />
        </>
      ) : (
        <p className="mt-8 rounded-lg border border-dashed border-cizgi px-4 py-10 text-center text-sm text-metin-silik">
          Ayar kaydı bulunamadı. Şemayı kur: npm run db:kur
        </p>
      )}
    </div>
  )
}
