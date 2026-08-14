'use client'

// Test konsolu. Fatih Bey müşteri gibi yazar, bot cevap verir.
//
// Motor burada ÇALIŞMAZ: metin ve fotoğraf sunucu eylemine gider, anahtarlar
// tarayıcıya inmez. Fotoğraf yollamadan önce burada küçültülür, hem yükleme
// hızlansın hem modele giden veri şişmesin.

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Analiz from '@/components/Analiz'

/** Motorun anahtarı → public/fiyat-listesi altındaki dosya. */
const GORSEL_DOSYA: Record<string, string> = {
  ppf: 'ppf-genel.png',
  'cam-filmi': 'cam-filmi.png',
  mikron: 'ppf-mikron-tablosu.png',
}
import type { Kullanim, YapiliCikti } from '@/lib/motor'
import { testMesajGonder } from './eylemler'

/** Modele giden fotoğrafın en uzun kenarı. */
const EN_UZUN_KENAR = 1024

/**
 * Konsol sekmede saklanır: panele bakıp geri gelince yazışma kopmasın.
 * Fotoğraf önizlemeleri saklanmaz, sekme deposunu boşuna doldurmasınlar.
 */
const DEPO_ANAHTARI = 'eryaman-test-konsolu'

type Tur = {
  anahtar: string
  musteriMetni: string
  gorselOnizleme: string | null
  botMesajlari: string[]
  yapili: YapiliCikti | null
  kullanim: Kullanim | null
  not: string | null
  bekliyor: boolean
}

type SecilenGorsel = { mimeTur: string; base64: string; onizleme: string }

function yeniOturum(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/** Fotoğrafı en uzun kenarı 1024 olacak şekilde küçültüp JPEG'e çevirir. */
async function gorselHazirla(dosya: File): Promise<SecilenGorsel> {
  const url = URL.createObjectURL(dosya)
  try {
    const resim = await new Promise<HTMLImageElement>((coz, red) => {
      const i = new Image()
      i.onload = () => coz(i)
      i.onerror = () => red(new Error('Fotoğraf okunamadı.'))
      i.src = url
    })

    const oran = Math.min(1, EN_UZUN_KENAR / Math.max(resim.naturalWidth, resim.naturalHeight))
    const genislik = Math.max(1, Math.round(resim.naturalWidth * oran))
    const yukseklik = Math.max(1, Math.round(resim.naturalHeight * oran))

    const tuval = document.createElement('canvas')
    tuval.width = genislik
    tuval.height = yukseklik
    const boya = tuval.getContext('2d')
    if (!boya) throw new Error('Fotoğraf işlenemedi.')
    boya.drawImage(resim, 0, 0, genislik, yukseklik)

    const veriUrl = tuval.toDataURL('image/jpeg', 0.72)
    return {
      mimeTur: 'image/jpeg',
      base64: veriUrl.slice(veriUrl.indexOf(',') + 1),
      onizleme: veriUrl,
    }
  } finally {
    URL.revokeObjectURL(url)
  }
}

type Depo = { oturum: string; ad: string; konusmaId: string | null; turlar: Tur[] }

export default function TestKonsolu() {
  const oturum = useRef<string>('')
  const dosyaGirdisi = useRef<HTMLInputElement>(null)
  const dip = useRef<HTMLDivElement>(null)

  const [ad, setAd] = useState('')
  const [metin, setMetin] = useState('')
  const [gorsel, setGorsel] = useState<SecilenGorsel | null>(null)
  const [turlar, setTurlar] = useState<Tur[]>([])
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)
  const [konusmaId, setKonusmaId] = useState<string | null>(null)
  const [yuklendi, setYuklendi] = useState(false)

  useEffect(() => {
    try {
      const ham = sessionStorage.getItem(DEPO_ANAHTARI)
      if (ham) {
        const depo = JSON.parse(ham) as Depo
        oturum.current = depo.oturum ?? ''
        setAd(depo.ad ?? '')
        setKonusmaId(depo.konusmaId ?? null)
        setTurlar(Array.isArray(depo.turlar) ? depo.turlar : [])
      }
    } catch {
      // Bozuk kayıt varsa boş konsolla devam.
    }
    setYuklendi(true)
  }, [])

  useEffect(() => {
    if (!yuklendi) return
    const depo: Depo = {
      oturum: oturum.current,
      ad,
      konusmaId,
      turlar: turlar.map((tur) => ({ ...tur, gorselOnizleme: null })),
    }
    try {
      sessionStorage.setItem(DEPO_ANAHTARI, JSON.stringify(depo))
    } catch {
      // Sekme deposu doluysa sorun değil, konsol yine çalışır.
    }
  }, [yuklendi, ad, konusmaId, turlar])

  useEffect(() => {
    dip.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [turlar])

  function oturumAl(): string {
    if (!oturum.current) oturum.current = yeniOturum()
    return oturum.current
  }

  async function dosyaSecildi(e: React.ChangeEvent<HTMLInputElement>) {
    const dosya = e.target.files?.[0]
    e.target.value = ''
    if (!dosya) return
    setHata(null)
    try {
      setGorsel(await gorselHazirla(dosya))
    } catch (hataNesnesi) {
      setHata(hataNesnesi instanceof Error ? hataNesnesi.message : 'Fotoğraf hazırlanamadı.')
    }
  }

  async function gonder() {
    const yazi = metin.trim()
    if ((!yazi && !gorsel) || gonderiliyor) return

    const anahtar = `${Date.now()}`
    setTurlar((oncekiler) => [
      ...oncekiler,
      {
        anahtar,
        musteriMetni: yazi || '[fotoğraf]',
        gorselOnizleme: gorsel?.onizleme ?? null,
        botMesajlari: [],
        yapili: null,
        kullanim: null,
        not: null,
        bekliyor: true,
      },
    ])
    setMetin('')
    setGorsel(null)
    setHata(null)
    setGonderiliyor(true)

    const sonuc = await testMesajGonder({
      oturum: oturumAl(),
      ad: ad.trim() || null,
      metin: yazi,
      gorsel: gorsel ? { mimeTur: gorsel.mimeTur, base64: gorsel.base64 } : null,
    })

    setTurlar((oncekiler) =>
      oncekiler.map((tur) =>
        tur.anahtar !== anahtar
          ? tur
          : sonuc.tamam
            ? {
                ...tur,
                bekliyor: false,
                botMesajlari: sonuc.mesajlar,
                yapili: sonuc.yapili,
                kullanim: sonuc.kullanim,
              }
            : { ...tur, bekliyor: false, not: sonuc.hata },
      ),
    )
    if (sonuc.konusmaId) setKonusmaId(sonuc.konusmaId)
    setGonderiliyor(false)
  }

  function sifirla() {
    oturum.current = yeniOturum()
    setTurlar([])
    setKonusmaId(null)
    setGorsel(null)
    setMetin('')
    setHata(null)
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 pt-6 pb-2 md:px-8 md:pt-8">
      <header>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h1 className="text-[15px] font-semibold">Test konsolu</h1>
          <button
            type="button"
            onClick={sifirla}
            className="rounded-lg border border-cizgi px-3 py-1.5 text-xs text-metin-soluk transition-colors hover:border-cizgi-parlak hover:text-metin"
          >
            Sohbeti sıfırla
          </button>
        </div>
        <p className="mt-1.5 max-w-prose text-[13px] text-metin-soluk">
          Müşteri gibi yaz, bot cevaplasın. Buradaki yazışmalar gelen kutusuna{' '}
          <span className="text-metin">Test konsolu</span> rozetiyle düşer, gerçek
          müşterilerle karışmaz. Dışarı hiçbir mesaj gitmez.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="ad" className="mb-1.5 block text-[11px] text-metin-silik">
              Müşteri adı (isteğe bağlı)
            </label>
            <input
              id="ad"
              value={ad}
              onChange={(e) => setAd(e.target.value)}
              placeholder="Emrah"
              className="w-44 rounded-lg border border-cizgi bg-yuzey px-3 py-2 text-sm outline-none placeholder:text-metin-silik focus:border-cizgi-parlak"
            />
          </div>
          {konusmaId && (
            <Link
              href={`/sohbet/${konusmaId}`}
              className="pb-2 text-xs text-amber underline-offset-2 hover:underline"
            >
              Bu yazışmayı panelde aç
            </Link>
          )}
        </div>
      </header>

      <div className="mt-6 flex-1 space-y-5">
        {turlar.length === 0 && (
          <p className="rounded-lg border border-dashed border-cizgi px-4 py-10 text-center text-sm text-metin-silik">
            İlk mesajını yaz. Örnek: &quot;Merhaba, ppf fiyatı ne kadar?&quot;
          </p>
        )}

        {turlar.map((tur) => (
          <div key={tur.anahtar} className="space-y-2">
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-xl rounded-tr-sm bg-amber-zemin px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap">
                {tur.gorselOnizleme && (
                  // Test konsolunun yerel önizlemesi; next/image gereksiz.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={tur.gorselOnizleme}
                    alt="Gönderilen fotoğraf"
                    className="mb-2 max-h-52 rounded-lg"
                  />
                )}
                {tur.musteriMetni}
              </div>
            </div>

            {tur.bekliyor && (
              <p className="text-[12px] text-metin-silik">Bot yazıyor...</p>
            )}

            {tur.botMesajlari.map((mesaj, sira) => (
              <div key={sira} className="flex justify-start">
                <div className="max-w-[85%] rounded-xl rounded-tl-sm bg-yuzey-2 px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap">
                  {mesaj}
                </div>
              </div>
            ))}

            {/* Bot fiyat listesi görseli gönderdiyse müşterinin gördüğünü burada
                da göster: "gönderdim" demek yetmez, hangisini gönderdiği görünsün. */}
            {tur.yapili?.fiyat_gorseli && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-xl rounded-tl-sm bg-yuzey-2 p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/fiyat-listesi/${GORSEL_DOSYA[tur.yapili.fiyat_gorseli]}`}
                    alt="Fiyat listesi"
                    className="max-h-64 w-auto rounded-lg"
                  />
                  <p className="mt-1.5 px-1 text-[11px] text-metin-silik">
                    Fiyat listesi görseli gönderildi
                  </p>
                </div>
              </div>
            )}

            {tur.yapili && <Analiz yapili={tur.yapili} kullanim={tur.kullanim} />}

            {tur.not && (
              <p className="whitespace-pre-line rounded-lg border border-cizgi bg-yuzey px-3 py-2 text-[12px] text-metin-soluk">
                {tur.not}
              </p>
            )}
          </div>
        ))}

        <div ref={dip} />
      </div>

      <div className="sticky bottom-0 -mx-4 mt-4 border-t border-cizgi bg-zemin px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:-mx-8 md:px-8">
        {hata && <p className="mb-2 text-[12px] text-kirmizi">{hata}</p>}

        {gorsel && (
          <div className="mb-2 flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={gorsel.onizleme} alt="Seçilen fotoğraf" className="h-12 w-12 rounded object-cover" />
            <button
              type="button"
              onClick={() => setGorsel(null)}
              className="text-xs text-metin-soluk hover:text-kirmizi"
            >
              Fotoğrafı kaldır
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <input
            ref={dosyaGirdisi}
            type="file"
            accept="image/*"
            onChange={dosyaSecildi}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => dosyaGirdisi.current?.click()}
            aria-label="Fotoğraf ekle"
            className="size-11 shrink-0 rounded-lg border border-cizgi text-lg text-metin-soluk transition-colors hover:border-cizgi-parlak hover:text-metin"
          >
            +
          </button>

          <textarea
            value={metin}
            onChange={(e) => setMetin(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void gonder()
              }
            }}
            rows={1}
            placeholder="Müşteri gibi yaz..."
            className="max-h-32 min-h-11 flex-1 resize-y rounded-lg border border-cizgi bg-yuzey px-3 py-2.5 text-sm outline-none placeholder:text-metin-silik focus:border-cizgi-parlak"
          />

          <button
            type="button"
            onClick={() => void gonder()}
            disabled={gonderiliyor || (!metin.trim() && !gorsel)}
            className="h-11 shrink-0 rounded-lg bg-amber px-4 text-sm font-semibold text-zemin transition-colors hover:bg-amber-koyu disabled:opacity-40"
          >
            {gonderiliyor ? '...' : 'Gönder'}
          </button>
        </div>
      </div>
    </div>
  )
}
