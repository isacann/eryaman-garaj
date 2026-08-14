// Anthropic sağlayıcısı. Resmî SDK (@anthropic-ai/sdk) üzerinden çalışır.
//
// Yapılandırılmış çıktı output_config.format ile zorlanıyor (structured outputs),
// yani cevap şemaya uyan geçerli JSON olarak geliyor, metinden ayıklanmıyor.
//
// Anahtar: ANTHROPIC_API_KEY

import Anthropic from '@anthropic-ai/sdk'

import { ciktiyiCoz, YANIT_SEMASI } from './sema'
import {
  anahtarAl,
  modelAdiCoz,
  type Saglayici,
  type SaglayiciAdi,
} from './saglayici'
import { MotorHatasi, type Gorsel, type KonusmaMesaji, type MotorYanit } from './types'

const AD: SaglayiciAdi = 'anthropic'

/** `sistem-prompt.ts` sabit öneki bu işaretle ayırıyor. */
const ONBELLEK_SINIRI = '<!--ONBELLEK-SINIRI-->'

/**
 * Sistem promptunu iki bloğa çevirir ve sabit öneke `cache_control` koyar.
 * İşaret yoksa (eski çağrı yolu) tek blok döner — davranış değişmez.
 */
function sistemBloklari(sistemPrompt: string): Anthropic.TextBlockParam[] {
  const i = sistemPrompt.indexOf(ONBELLEK_SINIRI)
  if (i === -1) return [{ type: 'text', text: sistemPrompt }]

  const sabit = sistemPrompt.slice(0, i).trimEnd()
  const degisken = sistemPrompt.slice(i + ONBELLEK_SINIRI.length).trimStart()

  return [
    {
      type: 'text',
      text: sabit,
      cache_control: { type: 'ephemeral', ttl: '1h' },
    } as Anthropic.TextBlockParam,
    { type: 'text', text: degisken },
  ]
}

function mesajlariKur(
  konusma: KonusmaMesaji[],
  gorseller: Gorsel[],
): Anthropic.MessageParam[] {
  const mesajlar: Anthropic.MessageParam[] = konusma.map((mesaj) => ({
    role: mesaj.rol === 'musteri' ? ('user' as const) : ('assistant' as const),
    content: mesaj.metin,
  }))

  if (gorseller.length > 0) {
    const sonIndeks = mesajlar.map((m) => m.role).lastIndexOf('user')
    const hedef = sonIndeks === -1 ? mesajlar.length - 1 : sonIndeks
    const mevcut = mesajlar[hedef]
    if (mevcut) {
      const gorselBloklari: Anthropic.ImageBlockParam[] = gorseller.map((g) => ({
        type: 'image',
        source: {
          type: 'base64',
          media_type: g.mimeTur as Anthropic.Base64ImageSource['media_type'],
          data: g.base64,
        },
      }))
      mesajlar[hedef] = {
        role: mevcut.role,
        content: [
          ...gorselBloklari,
          { type: 'text', text: typeof mevcut.content === 'string' ? mevcut.content : '' },
        ],
      }
    }
  }

  return mesajlar
}

export function anthropicSaglayici(modelEzme?: string): Saglayici {
  const model = modelAdiCoz(AD, modelEzme)

  return {
    ad: AD,
    model,

    anahtarKontrolu() {
      anahtarAl('ANTHROPIC_API_KEY', AD)
    },

    async yanitla(sistemPrompt, konusma, gorseller = []): Promise<MotorYanit> {
      const istemci = new Anthropic({ apiKey: anahtarAl('ANTHROPIC_API_KEY', AD) })

      // 529 "Overloaded" ve 429 geçici hatalardır; müşteri bekliyorken tek
      // denemede pes etmek onu cevapsız bırakır (openai.ts'te de aynı desen).
      // ⚠ Ayrıştırma da bu döngünün İÇİNDE: model bazen şemaya uyan ama
      // `mesajlar` dizisi BOŞ bir JSON döndürüyor (12 Ağustos regresyonunda
      // yakalandı). Eskiden bu, döngü bittikten sonra patlıyor ve müşteriyi
      // cevapsız bırakıyordu; artık geçici hata sayılıp tekrar deneniyor.
      let sonuc: MotorYanit | null = null
      let sonHata: unknown = null

      for (let deneme = 0; deneme < 4; deneme += 1) {
        if (deneme > 0) await new Promise((r) => setTimeout(r, 1_500 * 2 ** (deneme - 1)))
        try {
          const yanit = await istemci.messages.create({
            model,
            // 1400 yetmiyordu: ürünleri özellik maddeleriyle yazma kuralı
            // (12 Ağustos) cevabı uzattı, JSON ortadan kesilip "cevap JSON değil"
            // hatası veriyordu.
            // 3000 de yetmedi: ürünleri özellik maddeleriyle yazınca komple PPF
            // listesi tek başına ~1500 jeton tutuyor, JSON ortadan kesilip
            // "cevap JSON değil" hatası veriyordu (12 Ağustos).
            max_tokens: Number(process.env.MOTOR_MAX_TOKENS ?? 5000),
            // Prompt önbelleği: sabit önek (kimlik + ton + fiyat tablosu,
            // ~9.800 jeton) her müşteride aynı olduğu için önbelleğe alınıyor.
            // 1 saatlik TTL, Eryaman'ın hacmine (saatte ~2 mesaj) uygun — 5
            // dakikalık varsayılan bu trafikte hiç tutmuyordu.
            // Önbellekli girdi $0.20/1M (%90 indirim): aylık ~3.050₺ → ~600₺.
            system: sistemBloklari(sistemPrompt),
            messages: mesajlariKur(konusma, gorseller),
            output_config: {
              format: {
                type: 'json_schema',
                schema: YANIT_SEMASI as unknown as Record<string, unknown>,
              },
            },
          })

          if (yanit.stop_reason === 'refusal') {
            throw new MotorHatasi(AD, 'model isteği reddetti (stop_reason: refusal)')
          }

          const metin = yanit.content
            .map((blok) => (blok.type === 'text' ? blok.text : ''))
            .join('')
            .trim()
          if (metin === '') {
            throw new Error(`boş cevap geldi (stop_reason: ${yanit.stop_reason})`)
          }

          let nesne: unknown
          try {
            nesne = JSON.parse(metin)
          } catch {
            throw new Error(`cevap JSON değil: ${metin.slice(0, 200)}`)
          }

          const yapili = ciktiyiCoz(nesne)

          sonuc = {
            metin: yapili.mesajlar.join('\n'),
            yapili,
            kullanim: {
              saglayici: AD,
              model,
              girdiJeton: yanit.usage.input_tokens,
              ciktiJeton: yanit.usage.output_tokens,
              // Anthropic önbellekli jetonu input_tokens'a DAHİL ETMEZ, ayrı sayar.
              // Ölçmezsek maliyet hesabı gerçeği 5 kat yanlış gösterir.
              onbellekOkuma: yanit.usage.cache_read_input_tokens ?? 0,
              onbellekYazma: yanit.usage.cache_creation_input_tokens ?? 0,
            },
          }
          break
        } catch (e) {
          sonHata = e
          // Model reddi kalıcıdır, tekrar denemek aynı sonucu verir.
          if (e instanceof MotorHatasi) throw e
          const durum = (e as { status?: number })?.status
          // Kalıcı HTTP hatalarında (kimlik, bakiye, geçersiz istek) beklemek çözmez.
          // Durum kodu olmayanlar (boş cevap / bozuk JSON) tekrar denenir.
          if (durum !== undefined && durum !== 429 && durum !== 529 && durum < 500) throw e
        }
      }

      if (!sonuc) {
        throw new MotorHatasi(
          AD,
          `istek başarısız: ${sonHata instanceof Error ? sonHata.message : 'bilinmeyen hata'}`,
        )
      }

      return sonuc
    },
  }
}
