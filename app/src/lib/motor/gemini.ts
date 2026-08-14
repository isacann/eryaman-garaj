// Gemini sağlayıcısı (varsayılan).
//
// Resmî REST uçları kullanılıyor, ek bağımlılık yok. Yapılandırılmış çıktı
// generationConfig.responseSchema ile zorlanıyor; cevaptan regex ile JSON
// ayıklanmıyor.
//
// Anahtar: GEMINI_API_KEY

import { ciktiyiCoz, geminiSemasi, YANIT_SEMASI } from './sema'
import {
  anahtarAl,
  modelAdiCoz,
  type Saglayici,
  type SaglayiciAdi,
} from './saglayici'
import { MotorHatasi, type Gorsel, type KonusmaMesaji, type MotorYanit } from './types'

const TABAN_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

type GeminiParca = { text: string } | { inlineData: { mimeType: string; data: string } }

type GeminiYanit = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
  error?: { message?: string }
}

function icerikleriKur(konusma: KonusmaMesaji[], gorseller: Gorsel[]) {
  const icerikler = konusma.map((mesaj) => ({
    role: mesaj.rol === 'musteri' ? 'user' : 'model',
    parts: [{ text: mesaj.metin }] as GeminiParca[],
  }))

  if (gorseller.length > 0) {
    // Fotoğraflar son müşteri turuna iliştirilir.
    const sonUser = [...icerikler].reverse().find((i) => i.role === 'user')
    const hedef = sonUser ?? icerikler[icerikler.length - 1]
    if (hedef) {
      hedef.parts.unshift(
        ...gorseller.map((g) => ({ inlineData: { mimeType: g.mimeTur, data: g.base64 } })),
      )
    }
  }

  return icerikler
}

export function geminiSaglayiciOlustur(ad: SaglayiciAdi, modelEzme?: string): Saglayici {
  const model = modelAdiCoz(ad, modelEzme)

  return {
    ad,
    model,

    anahtarKontrolu() {
      anahtarAl('GEMINI_API_KEY', ad)
    },

    async yanitla(sistemPrompt, konusma, gorseller = []): Promise<MotorYanit> {
      const anahtar = anahtarAl('GEMINI_API_KEY', ad)

      const govde = {
        systemInstruction: { parts: [{ text: sistemPrompt }] },
        contents: icerikleriKur(konusma, gorseller),
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: geminiSemasi(YANIT_SEMASI),
          temperature: 0.4,
          maxOutputTokens: 1400,
        },
      }

      const istek = await fetch(`${TABAN_URL}/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': anahtar },
        body: JSON.stringify(govde),
      })

      const ham = (await istek.json().catch(() => null)) as GeminiYanit | null

      if (!istek.ok) {
        const sebep = ham?.error?.message ?? `HTTP ${istek.status}`
        throw new MotorHatasi(ad, `istek başarısız (${model}): ${sebep}`)
      }

      const parcalar = ham?.candidates?.[0]?.content?.parts ?? []
      const metin = parcalar
        .map((p) => p.text ?? '')
        .join('')
        .trim()
      if (metin === '') {
        const bitis = ham?.candidates?.[0]?.finishReason ?? 'bilinmiyor'
        throw new MotorHatasi(ad, `boş cevap geldi (finishReason: ${bitis})`)
      }

      let nesne: unknown
      try {
        nesne = JSON.parse(metin)
      } catch {
        throw new MotorHatasi(ad, `cevap JSON değil: ${metin.slice(0, 200)}`)
      }

      const yapili = ciktiyiCoz(nesne)

      return {
        metin: yapili.mesajlar.join('\n'),
        yapili,
        kullanim: {
          saglayici: ad,
          model,
          girdiJeton: ham?.usageMetadata?.promptTokenCount ?? 0,
          ciktiJeton: ham?.usageMetadata?.candidatesTokenCount ?? 0,
        },
      }
    },
  }
}

export function geminiSaglayici(modelEzme?: string): Saglayici {
  return geminiSaglayiciOlustur('gemini', modelEzme)
}
