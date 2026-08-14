// OpenAI sağlayıcısı. Chat Completions + Structured Outputs.
//
// Yapılandırılmış çıktı response_format.json_schema ile ZORLANIYOR (strict: true),
// yani cevap şemaya uyan geçerli JSON olarak geliyor, metinden ayıklanmıyor.
//
// SDK kullanmıyoruz: tek uç noktaya tek istek atıyoruz, fetch yeterli ve
// projeye bir bağımlılık daha girmiyor.
//
// Anahtar: OPENAI_API_KEY

import { ciktiyiCoz, YANIT_SEMASI } from './sema'
import { anahtarAl, modelAdiCoz, type Saglayici, type SaglayiciAdi } from './saglayici'
import { MotorHatasi, type Gorsel, type KonusmaMesaji, type MotorYanit } from './types'

const AD: SaglayiciAdi = 'openai'
const UC_NOKTA = 'https://api.openai.com/v1/chat/completions'

/** Model yanıt vermezse müşteri sonsuza kadar beklemesin. */
const ZAMAN_ASIMI_MS = 60_000

/**
 * Geçici hatada bir kez daha dene.
 * 31 çağrılık altın set koşusunda 1 istek zaman aşımına uğradı (%3). Üretimde
 * bu, müşterinin cevapsız kalması demek — tek bir tekrar bunu neredeyse
 * tamamen kapatıyor. Kalıcı hatalarda (400, 401) tekrar denenmez.
 */
const TEKRAR_SAYISI = 3
const TEKRAR_BEKLEME_MS = 1_500

function tekrarDenenirMi(durum: number | null, govde = ''): boolean {
  // Ağ hatası / zaman aşımı (durum yok) ya da geçici sunucu hataları.
  if (durum === null) return true
  // 429 iki farklı şey olabilir: dakikalık hız sınırı (geçici, beklenir) ya da
  // bakiyenin bitmesi (kalıcı, beklemek işe yaramaz — 11 Ağustos dersi).
  if (durum === 429) {
    return !/insufficient_quota|credit_balance_exhausted|no credits remaining/i.test(govde)
  }
  return durum === 408 || durum === 409 || durum >= 500
}

/**
 * 429 gövdesinde OpenAI "Please try again in 690ms" diye net süre veriyor.
 * Onu okuyup beklemek, sabit gecikmeyle kör kör denemekten çok daha isabetli:
 * TPM sınırında sabit 1,5 sn bazen erken, bazen gereksiz uzun oluyordu.
 */
function beklemeSuresiCoz(govde: string, deneme: number): number {
  const ms = govde.match(/try again in (\d+)ms/i)
  if (ms?.[1]) return Number(ms[1]) + 250
  const sn = govde.match(/try again in ([\d.]+)s/i)
  if (sn?.[1]) return Math.ceil(Number(sn[1]) * 1000) + 250
  // Üstel geri çekilme: 1,5 → 3 → 6 sn.
  return TEKRAR_BEKLEME_MS * 2 ** deneme
}

type IcerikParcasi =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

type Mesaj = {
  role: 'system' | 'user' | 'assistant'
  content: string | IcerikParcasi[]
}

function mesajlariKur(
  sistemPrompt: string,
  konusma: KonusmaMesaji[],
  gorseller: Gorsel[],
): Mesaj[] {
  const mesajlar: Mesaj[] = [
    // Önbellek sınırı işareti yalnızca Anthropic'te blok ayırmaya yarıyor;
    // buradan temizleniyor ki modele görünmesin. (OpenAI otomatik önbelleklidir,
    // sabit önek zaten aynı olduğu için ayrıca işaretlemek gerekmiyor.)
    { role: 'system', content: sistemPrompt.replace('<!--ONBELLEK-SINIRI-->', '').trim() },
    ...konusma.map((m) => ({
      role: (m.rol === 'musteri' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.metin,
    })),
  ]

  if (gorseller.length === 0) return mesajlar

  // Fotoğraflar son müşteri mesajına iliştirilir; model onları o turun parçası
  // olarak görür (fotoğraf analizi, KAPSAM karar 2).
  const sonIndeks = mesajlar.map((m) => m.role).lastIndexOf('user')
  const hedef = sonIndeks === -1 ? mesajlar.length - 1 : sonIndeks
  const mevcut = mesajlar[hedef]
  if (!mevcut) return mesajlar

  mesajlar[hedef] = {
    role: mevcut.role,
    content: [
      { type: 'text', text: typeof mevcut.content === 'string' ? mevcut.content : '' },
      ...gorseller.map(
        (g): IcerikParcasi => ({
          type: 'image_url',
          image_url: { url: `data:${g.mimeTur};base64,${g.base64}` },
        }),
      ),
    ],
  }

  return mesajlar
}

/**
 * OpenAI strict structured outputs iki şey dayatıyor:
 *   - her nesnede additionalProperties: false
 *   - required, properties'in TAMAMINI içermeli
 * Şemamız zaten böyle kurulu ama iç içe nesneler için garantiye alıyoruz.
 */
function semayiKatilastir(sema: unknown): unknown {
  if (Array.isArray(sema)) return sema.map(semayiKatilastir)
  if (typeof sema !== 'object' || sema === null) return sema

  const kaynak = sema as Record<string, unknown>
  const cikti: Record<string, unknown> = {}
  for (const [anahtar, deger] of Object.entries(kaynak)) {
    cikti[anahtar] = semayiKatilastir(deger)
  }

  if (cikti.type === 'object' && cikti.properties) {
    cikti.additionalProperties = false
    cikti.required = Object.keys(cikti.properties as Record<string, unknown>)
  }

  return cikti
}

export function openaiSaglayici(modelEzme?: string): Saglayici {
  const model = modelAdiCoz(AD, modelEzme)

  return {
    ad: AD,
    model,

    anahtarKontrolu() {
      anahtarAl('OPENAI_API_KEY', AD)
    },

    async yanitla(sistemPrompt, konusma, gorseller = []): Promise<MotorYanit> {
      const anahtar = anahtarAl('OPENAI_API_KEY', AD)

      const govdeJson = JSON.stringify({
        model,
        messages: mesajlariKur(sistemPrompt, konusma, gorseller),
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'eryaman_yanit',
            strict: true,
            schema: semayiKatilastir(YANIT_SEMASI),
          },
        },
      })

      let sonuc: MotorYanit | null = null
      let sonHata = ''
      let sonrakiBeklemeMs = TEKRAR_BEKLEME_MS

      for (let deneme = 0; deneme <= TEKRAR_SAYISI; deneme += 1) {
        if (deneme > 0) await new Promise((r) => setTimeout(r, sonrakiBeklemeMs))

        let durum: number | null = null
        try {
          const yanit = await fetch(UC_NOKTA, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              authorization: `Bearer ${anahtar}`,
            },
            body: govdeJson,
            signal: AbortSignal.timeout(ZAMAN_ASIMI_MS),
          })

          if (yanit.ok) {
            // ⚠ Ayrıştırma döngünün İÇİNDE: model bazen şemaya uyan ama
            // `mesajlar` dizisi BOŞ bir JSON döndürüyor. Döngü dışında
            // patlarsa müşteri cevapsız kalır (12 Ağustos, anthropic.ts'te
            // canlı yakalandı).
            try {
              sonuc = yanitiCoz(await yanit.json())
              break
            } catch (e) {
              if (e instanceof MotorHatasi) throw e
              sonHata = e instanceof Error ? e.message : 'cevap çözülemedi'
              sonrakiBeklemeMs = TEKRAR_BEKLEME_MS * 2 ** deneme
              continue
            }
          }

          durum = yanit.status
          const govde = await yanit.text()
          sonHata = `HTTP ${yanit.status}: ${govde.slice(0, 300)}`
          sonrakiBeklemeMs = beklemeSuresiCoz(govde, deneme)
          if (!tekrarDenenirMi(durum, govde)) break
          continue
        } catch (e) {
          sonHata = `istek başarısız: ${e instanceof Error ? e.message : 'bilinmeyen hata'}`
          sonrakiBeklemeMs = TEKRAR_BEKLEME_MS * 2 ** deneme
        }

        if (!tekrarDenenirMi(durum)) break
      }

      if (!sonuc) throw new MotorHatasi(AD, sonHata)

      return sonuc

      function yanitiCoz(ham: unknown): MotorYanit {
        const yuk = ham as {
          choices?: {
            message?: { content?: string; refusal?: string }
            finish_reason?: string
          }[]
          usage?: {
            prompt_tokens?: number
            completion_tokens?: number
            prompt_tokens_details?: { cached_tokens?: number }
          }
        }

        const secim = yuk.choices?.[0]
        if (secim?.message?.refusal) {
          // Model reddi kalıcıdır; tekrar denemek aynı sonucu verir.
          throw new MotorHatasi(AD, `model isteği reddetti: ${secim.message.refusal}`)
        }

        const metin = secim?.message?.content?.trim() ?? ''
        if (metin === '') {
          throw new Error(`boş cevap geldi (finish_reason: ${secim?.finish_reason})`)
        }

        let nesne: unknown
        try {
          nesne = JSON.parse(metin)
        } catch {
          throw new Error(`cevap JSON değil: ${metin.slice(0, 200)}`)
        }

        const yapili = ciktiyiCoz(nesne)

        return {
          metin: yapili.mesajlar.join('\n'),
          yapili,
          kullanim: {
            saglayici: AD,
            model,
            // ⚠ OpenAI'de cached_tokens prompt_tokens'a DAHİLDİR (Anthropic'in
            // tersine). Maliyet hesabında girdiden düşülmesi gerekir.
            girdiJeton: yuk.usage?.prompt_tokens ?? 0,
            ciktiJeton: yuk.usage?.completion_tokens ?? 0,
            onbellekOkuma: yuk.usage?.prompt_tokens_details?.cached_tokens ?? 0,
            onbellekYazma: 0,
          },
        }
      }
    },
  }
}
