// Test konsolunun istemci ile sunucu arasında paylaştığı tipler.
// Ayrı dosyada duruyorlar çünkü eylemler.ts bir "use server" modülü.

import type { Kullanim, YapiliCikti } from '@/lib/motor'

export type KonsolGirdi = {
  /** Konsol oturumunun kimliği. "Sohbeti sıfırla" yeni bir tane üretir. */
  oturum: string
  /** Test müşterisinin adı. Boşsa bot isim uydurmaz, sadece "Merhabalar" der. */
  ad: string | null
  metin: string
  gorsel: { mimeTur: string; base64: string } | null
}

export type KonsolSonuc =
  | {
      tamam: true
      konusmaId: string
      mesajlar: string[]
      yapili: YapiliCikti
      kullanim: Kullanim
    }
  | { tamam: false; hata: string; konusmaId?: string }
