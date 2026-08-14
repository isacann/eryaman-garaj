import Link from 'next/link'
import { notFound } from 'next/navigation'
import { konusmaGetir } from '@/lib/db/sorgular'
import { kisiAdi, pencereKalan, saat, tamZaman } from '@/lib/bicim'
import Analiz from '@/components/Analiz'
import { DurumRozeti, KanalRozeti } from '@/components/Rozet'
import type { Message } from '@/lib/db/types'
import type { Kullanim, YapiliCikti } from '@/lib/motor'
import CevapKutusu from './CevapKutusu'

export const dynamic = 'force-dynamic'

const GONDEREN_ETIKET = {
  musteri: 'Müşteri',
  bot: 'Bot',
  ekip: 'Ekip',
} as const

/**
 * Bot cevabının yapılandırılmış çıktısı mesajın meta alanında duruyor
 * (src/lib/bot.ts ilk mesaja iliştirir). Yoksa null döner.
 */
function analiziCoz(meta: Message['meta']): { yapili: YapiliCikti; kullanim: Kullanim | null } | null {
  if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) return null
  const kutu = meta as Record<string, unknown>
  const yapili = kutu.yapili
  if (typeof yapili !== 'object' || yapili === null) return null
  if (!Array.isArray((yapili as Record<string, unknown>).mesajlar)) return null
  return {
    yapili: yapili as unknown as YapiliCikti,
    kullanim: (kutu.kullanim as Kullanim | undefined) ?? null,
  }
}

function MesajBalonu({ mesaj }: { mesaj: Message }) {
  const gelen = mesaj.yon === 'gelen'
  const analiz = mesaj.gonderen === 'bot' ? analiziCoz(mesaj.meta) : null

  return (
    <div className={`flex ${gelen ? 'justify-start' : 'justify-end'}`}>
      <div className="max-w-[min(34rem,85%)]">
        <div
          className={`rounded-xl px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap ${
            gelen
              ? 'rounded-tl-sm bg-yuzey-2 text-metin'
              : 'rounded-tr-sm bg-amber-zemin text-metin'
          }`}
        >
          {mesaj.metin}
          {mesaj.medya_url && (
            <a
              href={mesaj.medya_url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 block text-xs text-amber underline underline-offset-2"
            >
              Görseli aç
            </a>
          )}
        </div>
        {analiz && <Analiz yapili={analiz.yapili} kullanim={analiz.kullanim} />}
        <p
          className={`mt-1 font-mono text-[10px] text-metin-silik ${
            gelen ? 'text-left' : 'text-right'
          }`}
        >
          {GONDEREN_ETIKET[mesaj.gonderen] ?? mesaj.gonderen} · {saat(mesaj.created_at)}
        </p>
      </div>
    </div>
  )
}

export default async function SohbetSayfasi({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const veri = await konusmaGetir(id)
  if (!veri) notFound()

  const { konusma, kisi, mesajlar } = veri
  const isim = kisiAdi(kisi?.ad ?? null, kisi?.kanal_kimlik ?? '—')
  const kalan = pencereKalan(konusma.pencere_bitis_at)

  return (
    <div className="flex h-screen flex-col">
      <header className="shrink-0 border-b border-cizgi px-5 py-4 md:px-8">
        <Link href="/" className="mb-2 inline-block text-xs text-metin-soluk md:hidden">
          ← Gelen kutusu
        </Link>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-[15px] font-semibold">{isim}</h1>
          <KanalRozeti kanal={konusma.kanal} />
          <DurumRozeti durum={konusma.durum} />
        </div>
        <p className="mt-1.5 font-mono text-[11px] text-metin-silik">
          {kisi?.kanal_kimlik ?? '—'} · son mesaj {tamZaman(konusma.son_mesaj_at)} ·{' '}
          {kalan ? `yanıt penceresi ${kalan}` : 'yanıt penceresi kapalı'}
        </p>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-6 md:px-8">
        {mesajlar.length === 0 ? (
          <p className="text-sm text-metin-silik">Bu yazışmada mesaj yok.</p>
        ) : (
          mesajlar.map((m) => <MesajBalonu key={m.id} mesaj={m} />)
        )}
      </div>

      <CevapKutusu konusmaId={konusma.id} devirde={konusma.durum === 'devir'} />
    </div>
  )
}
