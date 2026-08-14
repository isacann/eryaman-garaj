// Sahte sağlayıcı: anahtarsız uçtan uca test için.
//
// Model çağırmaz, sabit cevap döner. İşi kaliteyi ölçmek değil, boru hattının
// (prompt üretimi → sağlayıcı → yapılandırılmış çıktı → denetim → rapor)
// çalıştığını göstermek. Rakam içermez, dolayısıyla fiyat denetimlerinden
// temiz geçer; bu beklenen davranıştır, başarı ölçüsü değildir.
//
// Anahtar istemez.

import {
  modelAdiCoz,
  type Saglayici,
  type SaglayiciAdi,
} from './saglayici'
import type { MotorYanit, YapiliCikti } from './types'

const AD: SaglayiciAdi = 'sahte'

const ILK_TUR: string[] = [
  'Merhabalar',
  'Hoşgeldiniz. Aracınızın marka/modeli nedir? Memnuniyetle yardımcı olalım sizlere.',
]

const SONRAKI_TUR: string[] = [
  'Anladım, not aldım.',
  'Kapsamı netleştirelim: kaç parça olacak, aracınızın üzerinde hâlihazırda uygulama var mı?',
]

/**
 * Senaryo modu: sağlayıcının SIRAYLA döneceği cevaplar önceden verilir.
 *
 * Neden var: bakiye bittiğinde "düzeltme turu gerçekten çalışıyor mu" sorusu
 * cevapsız kalıyordu. Bu modda ilk çağrıya Fatih Bey'in ekranında gördüğü
 * BOZUK cevabı, ikinci çağrıya (düzeltme turuna) düzgün cevabı verdiriyoruz;
 * böylece eksik tespiti → düzeltme turu → son çıktı zinciri uçtan uca,
 * model çağırmadan ve para harcamadan sınanabiliyor.
 *
 * Kullanım: `sahteSenaryoKur([...])`, sonra `sahteSenaryoDurumu()`.
 */
type SahteCevap = { mesajlar: string[]; yapili?: Partial<YapiliCikti> }

let senaryo: SahteCevap[] | null = null
let cagriSayaci = 0

export function sahteSenaryoKur(cevaplar: SahteCevap[]): void {
  senaryo = cevaplar
  cagriSayaci = 0
}

export function sahteSenaryoDurumu(): { cagri: number; kaldi: number } {
  return { cagri: cagriSayaci, kaldi: senaryo ? senaryo.length - cagriSayaci : 0 }
}

export function sahteSenaryoTemizle(): void {
  senaryo = null
  cagriSayaci = 0
}

export function sahteSaglayici(modelEzme?: string): Saglayici {
  const model = modelAdiCoz(AD, modelEzme)

  return {
    ad: AD,
    model,

    anahtarKontrolu() {
      // Sahte sağlayıcı anahtar istemez.
    },

    async yanitla(sistemPrompt, konusma, gorseller = []): Promise<MotorYanit> {
      // Senaryo kuruluysa sıradaki hazır cevabı ver (son cevabı tekrarlar).
      if (senaryo && senaryo.length > 0) {
        const adim = senaryo[Math.min(cagriSayaci, senaryo.length - 1)]!
        cagriSayaci += 1
        const yapiliSenaryo: YapiliCikti = {
          mesajlar: adim.mesajlar,
          niyet: 'fiyat-net',
          arac: null,
          kapsam: 'komple PPF',
          fiyat_verilebilir_mi: true,
          devir_gerekli_mi: false,
          devir_sebebi: null,
          randevu_talebi: null,
          gorsel_notu: null,
          fiyat_gorseli: null,
          fiyat_listesi: null,
          guven: 0.9,
          ...adim.yapili,
        } as YapiliCikti

        return {
          metin: yapiliSenaryo.mesajlar.join('\n'),
          yapili: yapiliSenaryo,
          kullanim: { saglayici: AD, model, girdiJeton: 0, ciktiJeton: 0 },
        }
      }

      const botTuruVarMi = konusma.some((m) => m.rol === 'bot')
      const mesajlar = botTuruVarMi ? SONRAKI_TUR : ILK_TUR

      const yapili: YapiliCikti = {
        mesajlar,
        niyet: botTuruVarMi ? 'diger' : 'selam',
        arac: null,
        kapsam: null,
        fiyat_verilebilir_mi: false,
        // Sahte sağlayıcı hiç fiyat vermez, dolayısıyla görsel de göndermez.
        fiyat_gorseli: null,
        fiyat_listesi: null,
        devir_gerekli_mi: false,
        devir_sebebi: null,
        randevu_talebi: null,
        gorsel_notu: gorseller.length > 0 ? 'Fotoğraf alındı (sahte sağlayıcı analiz etmez).' : null,
        guven: 0.5,
      }

      return {
        metin: mesajlar.join('\n'),
        yapili,
        kullanim: {
          saglayici: AD,
          model,
          // Sahte sağlayıcı jeton harcamaz; prompt uzunluğu yine de görünsün diye
          // kaba bir ölçü veriyoruz (4 karakter ~ 1 jeton).
          girdiJeton: Math.ceil(sistemPrompt.length / 4),
          ciktiJeton: Math.ceil(mesajlar.join(' ').length / 4),
        },
      }
    },
  }
}
