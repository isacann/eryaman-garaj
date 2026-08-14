'use client'

import { usePathname } from 'next/navigation'

/**
 * Konuşma listesinin kabı. Dar ekranda sohbet açıkken liste gizlenir,
 * geniş ekranda ikisi yan yana durur.
 */
export default function ListeKabi({ children }: { children: React.ReactNode }) {
  const sohbetAcik = usePathname().startsWith('/sohbet')

  return (
    <div
      className={`w-full shrink-0 overflow-y-auto border-cizgi md:block md:w-80 md:border-r lg:w-96 ${
        sohbetAcik ? 'hidden' : 'block'
      }`}
    >
      {children}
    </div>
  )
}
