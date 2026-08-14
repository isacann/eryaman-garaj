import { Suspense } from 'react'
import GirisFormu from './GirisFormu'

export default function GirisSayfasi() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-10">
          <p className="font-mono text-[11px] tracking-[0.28em] text-amber uppercase">
            Eryaman Garaj
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Yanıt paneli</h1>
          <p className="mt-2 text-sm text-metin-soluk">
            WhatsApp ve Instagram yazışmaları tek yerde.
          </p>
        </div>
        <Suspense fallback={null}>
          <GirisFormu />
        </Suspense>
      </div>
    </main>
  )
}
