// Kanal kaydı. Kanal seçimi tek yerden yapılır.

import type { KanalAdi } from '@/lib/db/types'
import type { Kanal } from './types'
import { mockKanal } from './mock'
import { testKanal } from './test'
import { whatsappKanal } from './whatsapp'
import { instagramKanal } from './instagram'

const kanallar: Record<KanalAdi, Kanal> = {
  mock: mockKanal,
  test: testKanal,
  whatsapp: whatsappKanal,
  instagram: instagramKanal,
}

export function kanalAl(ad: KanalAdi): Kanal {
  return kanallar[ad]
}

export type { GelenMesaj, GonderimSonucu, Kanal } from './types'
export { KanalHatasi } from './types'
