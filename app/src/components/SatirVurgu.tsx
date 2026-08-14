'use client'

import { usePathname } from 'next/navigation'

/** Açık olan konuşmanın satırını işaretler. */
export default function SatirVurgu({
  id,
  children,
}: {
  id: string
  children: React.ReactNode
}) {
  const acik = usePathname() === `/sohbet/${id}`
  return (
    <div className={acik ? 'border-l-2 border-amber bg-yuzey' : 'border-l-2 border-transparent'}>
      {children}
    </div>
  )
}
