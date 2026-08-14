// Sağlayıcı soyutlaması.
//
// KURAL: Model adı iş mantığına gömülmez. Motorun hiçbir yeri "gemini" ya da
// "claude" bilmez; sadece bu arayüzü çağırır. Hangi sağlayıcı ve hangi model
// kullanılacağı ORTAM DEĞİŞKENİNDEN gelir:
//
//   MOTOR_SAGLAYICI = openai | gemini | gemini-lite | anthropic | sahte
//   MOTOR_MODEL     = model adını elle ezmek için (opsiyonel)
//
// Model yükseltmesi tek satırlık ortam değişikliğidir, kod değişikliği değil.

import type { Gorsel, KonusmaMesaji, MotorYanit } from './types'

export type SaglayiciAdi = 'openai' | 'gemini' | 'gemini-lite' | 'anthropic' | 'sahte'

export const SAGLAYICI_ADLARI: SaglayiciAdi[] = [
  'openai',
  'gemini',
  'gemini-lite',
  'anthropic',
  'sahte',
]

/** Sağlayıcı değişince tek değişecek yer burası. */
export const VARSAYILAN_MODELLER: Record<SaglayiciAdi, string> = {
  // gpt-5.4-mini: hesapta doğrulandı, yapılandırılmış çıktı + görsel destekliyor.
  // Daha güçlüsü için MOTOR_MODEL=gpt-5.5 yeterli, kod değişmez.
  openai: 'gpt-5.4-mini',
  gemini: 'gemini-3.6-flash',
  'gemini-lite': 'gemini-3.5-flash-lite',
  anthropic: 'claude-haiku-4-5',
  sahte: 'sahte-v1',
}

export interface Saglayici {
  readonly ad: SaglayiciAdi
  readonly model: string

  /**
   * Gerekli anahtar var mı diye bakar, yoksa AnahtarYokHatasi fırlatır.
   * İlk istekte patlamak yerine baştan patlamak için: uzun bir koşunun
   * ortasında 30 tane aynı hatayı görmek işe yaramıyor.
   */
  anahtarKontrolu(): void

  /**
   * Bir tur cevap üretir.
   * Yapılandırılmış çıktıyı sağlayıcının kendi şema desteğiyle alır,
   * ham metinden regex ile JSON ayıklamaz.
   */
  yanitla(
    sistemPrompt: string,
    konusma: KonusmaMesaji[],
    gorseller?: Gorsel[],
  ): Promise<MotorYanit>
}

export class AnahtarYokHatasi extends Error {
  constructor(
    public readonly degisken: string,
    public readonly saglayici: SaglayiciAdi,
  ) {
    super(
      `${saglayici} sağlayıcısı için ${degisken} ortam değişkeni gerekli ama tanımlı değil. ` +
        `Anahtarı ../.secrets.env dosyasına ${degisken}=... olarak ekle, sonra "npm run env" çalıştır. ` +
        `Anahtarsız denemek için MOTOR_SAGLAYICI=sahte kullan.`,
    )
    this.name = 'AnahtarYokHatasi'
  }
}

export function anahtarAl(degisken: string, saglayici: SaglayiciAdi): string {
  const deger = process.env[degisken]
  if (!deger || deger.trim() === '') throw new AnahtarYokHatasi(degisken, saglayici)
  return deger.trim()
}

export function saglayiciAdiCoz(ham?: string | null): SaglayiciAdi {
  const ad = (ham ?? process.env.MOTOR_SAGLAYICI ?? 'gemini').trim() as SaglayiciAdi
  if (!SAGLAYICI_ADLARI.includes(ad)) {
    throw new Error(
      `Bilinmeyen MOTOR_SAGLAYICI: "${ad}". Geçerli değerler: ${SAGLAYICI_ADLARI.join(', ')}`,
    )
  }
  return ad
}

export function modelAdiCoz(ad: SaglayiciAdi, ezme?: string | null): string {
  const secilen = (ezme ?? process.env.MOTOR_MODEL ?? '').trim()
  return secilen !== '' ? secilen : VARSAYILAN_MODELLER[ad]
}
