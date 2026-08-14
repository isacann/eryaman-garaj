// Gemini'nin küçük modeli. Aynı istek biçimi, farklı varsayılan model.
//
// Neden ayrı dosya: sağlayıcı seçimi ortam değişkeninden geliyor
// (MOTOR_SAGLAYICI=gemini-lite) ve maliyet kararı model adını iş mantığına
// gömmeden verilebilsin diye.

import { geminiSaglayiciOlustur } from './gemini'
import type { Saglayici } from './saglayici'

export function geminiLiteSaglayici(modelEzme?: string): Saglayici {
  return geminiSaglayiciOlustur('gemini-lite', modelEzme)
}
