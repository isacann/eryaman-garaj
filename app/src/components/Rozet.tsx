import type { KanalAdi, KonusmaDurumu, RandevuDurumu } from '@/lib/db/types'

const TEMEL =
  'inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10px] tracking-wide uppercase'

const KANAL_ETIKET: Record<KanalAdi, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  mock: 'Test',
  test: 'Test konsolu',
}

export function KanalRozeti({ kanal }: { kanal: KanalAdi }) {
  return (
    <span className={`${TEMEL} bg-yuzey-2 text-metin-silik`}>{KANAL_ETIKET[kanal] ?? kanal}</span>
  )
}

const DURUM_ETIKET: Record<KonusmaDurumu, string> = {
  bot: 'Bot',
  devir: 'Devir',
  kapali: 'Kapalı',
}

const DURUM_STIL: Record<KonusmaDurumu, string> = {
  bot: 'bg-yuzey-2 text-metin-soluk',
  devir: 'bg-amber-zemin text-amber',
  kapali: 'bg-yuzey-2 text-metin-silik',
}

export function DurumRozeti({ durum }: { durum: KonusmaDurumu }) {
  return (
    <span className={`${TEMEL} ${DURUM_STIL[durum] ?? DURUM_STIL.bot}`}>
      {DURUM_ETIKET[durum] ?? durum}
    </span>
  )
}

const RANDEVU_ETIKET: Record<RandevuDurumu, string> = {
  bekliyor: 'Bekliyor',
  onaylandi: 'Onaylandı',
  iptal: 'İptal',
}

const RANDEVU_STIL: Record<RandevuDurumu, string> = {
  bekliyor: 'bg-amber-zemin text-amber',
  onaylandi: 'bg-yesil/10 text-yesil',
  iptal: 'bg-yuzey-2 text-metin-silik',
}

export function RandevuRozeti({ durum }: { durum: RandevuDurumu }) {
  return (
    <span className={`${TEMEL} ${RANDEVU_STIL[durum] ?? RANDEVU_STIL.bekliyor}`}>
      {RANDEVU_ETIKET[durum] ?? durum}
    </span>
  )
}
