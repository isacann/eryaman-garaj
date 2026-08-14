'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabaseTarayici } from '@/lib/supabase/tarayici'

export default function GirisFormu() {
  const router = useRouter()
  const params = useSearchParams()
  const devam = params.get('devam') ?? '/'

  const [eposta, setEposta] = useState('')
  const [sifre, setSifre] = useState('')
  const [hata, setHata] = useState<string | null>(null)
  const [bekliyor, setBekliyor] = useState(false)

  async function gonder(e: React.FormEvent) {
    e.preventDefault()
    setHata(null)
    setBekliyor(true)

    const { error } = await supabaseTarayici().auth.signInWithPassword({
      email: eposta.trim(),
      password: sifre,
    })

    if (error) {
      setHata(
        error.message === 'Invalid login credentials'
          ? 'E-posta ya da şifre hatalı.'
          : error.message,
      )
      setBekliyor(false)
      return
    }

    router.replace(devam)
    router.refresh()
  }

  return (
    <form onSubmit={gonder} className="space-y-4">
      <div>
        <label htmlFor="eposta" className="mb-1.5 block text-xs text-metin-soluk">
          E-posta
        </label>
        <input
          id="eposta"
          type="email"
          required
          autoComplete="username"
          value={eposta}
          onChange={(e) => setEposta(e.target.value)}
          className="w-full rounded-lg border border-cizgi bg-yuzey px-3 py-2.5 text-sm outline-none placeholder:text-metin-silik focus:border-cizgi-parlak"
          placeholder="ornek@eryamangaraj.com"
        />
      </div>

      <div>
        <label htmlFor="sifre" className="mb-1.5 block text-xs text-metin-soluk">
          Şifre
        </label>
        <input
          id="sifre"
          type="password"
          required
          autoComplete="current-password"
          value={sifre}
          onChange={(e) => setSifre(e.target.value)}
          className="w-full rounded-lg border border-cizgi bg-yuzey px-3 py-2.5 text-sm outline-none placeholder:text-metin-silik focus:border-cizgi-parlak"
          placeholder="••••••••"
        />
      </div>

      {hata && (
        <p className="rounded-lg border border-kirmizi/25 bg-kirmizi/10 px-3 py-2 text-xs text-kirmizi">
          {hata}
        </p>
      )}

      <button
        type="submit"
        disabled={bekliyor}
        className="w-full rounded-lg bg-amber px-4 py-2.5 text-sm font-semibold text-zemin transition-colors hover:bg-amber-koyu disabled:opacity-50"
      >
        {bekliyor ? 'Giriliyor...' : 'Giriş yap'}
      </button>
    </form>
  )
}
