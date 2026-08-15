// Bota komut satırından konuşma oynatır. Test ajanları bunu kullanır.
//
// Kullanım (her argüman bir müşteri mesajı, sırayla):
//   npx tsx scripts/sohbet.ts "Merhaba ppf fiyatı nedir" "Bmw 320i" "komple"
//
// Seçenekler:
//   --ad=İbrahim     müşterinin adı (panelde girilmiş gibi)
//   --json           çıktıyı JSON olarak ver (yapılandırılmış alanlar dahil)
//
// Her turda bot cevabı + kırmızı bayraklar basılır. Bayrak = kural ihlali.

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { saglayiciAl, yanitUret } from '../src/lib/motor'
import { bayraklariBul, ilkTurdaFiyatSerbestMi } from '../src/lib/motor/denetim'
import { fiyatBilgisiAl } from '../src/lib/motor/fiyat'
import type { KonusmaMesaji } from '../src/lib/motor/types'

function envYukle(): void {
  const yol = path.join(process.cwd(), '.env.local')
  if (!existsSync(yol)) return
  for (const satir of readFileSync(yol, 'utf8').split(/\r?\n/)) {
    const temiz = satir.trim()
    if (!temiz || temiz.startsWith('#')) continue
    const i = temiz.indexOf('=')
    if (i === -1) continue
    const ad = temiz.slice(0, i).trim()
    if (!process.env[ad]) process.env[ad] = temiz.slice(i + 1).trim()
  }
}
envYukle()

const argv = process.argv.slice(2)
const jsonMu = argv.includes('--json')
const adBayragi = argv.find((a) => a.startsWith('--ad='))
const kisiAdi = adBayragi ? adBayragi.slice('--ad='.length) : undefined
// --donen: dönen müşteri senaryosu (geçmiş var, uzun ara verilmiş).
// --gecmis="metin|rol;..." ile eski konuşma enjekte edilebilir.
const donenMu = argv.includes('--donen')
const mesajlar = argv.filter((a) => !a.startsWith('--'))

if (mesajlar.length === 0) {
  console.error('En az bir müşteri mesajı ver. Örnek:')
  console.error('  npx tsx scripts/sohbet.ts "Merhaba ppf fiyatı nedir" "Bmw 320i"')
  process.exit(1)
}

async function main() {
  const saglayici = saglayiciAl()
  saglayici.anahtarKontrolu()
  const fiyat = fiyatBilgisiAl()

  const konusma: KonusmaMesaji[] = []
  const turlar: unknown[] = []

  for (const [i, musteriMetni] of mesajlar.entries()) {
    konusma.push({ rol: 'musteri', metin: musteriMetni })

    const ilkCevapMi = i === 0
    // yanitUret üzerinden: üretimde bot.ts bu yolu kullanıyor ve zorunlu-parça
    // düzeltme turu burada devreye giriyor. Sağlayıcıyı doğrudan çağırmak
    // gerçek davranışı test etmiyordu.
    const yanit = await yanitUret(
      { konusma, kisiAdi, simdi: new Date(), uzunAradanSonraMi: donenMu },
      saglayici,
    )
    konusma.push({ rol: 'bot', metin: yanit.metin })

    const bayraklar = bayraklariBul(yanit.metin, {
      ilkCevapMi,
      izinliRakamlar: fiyat.izinliRakamlar,
      teyitBekleyenIsler: fiyat.teyitBekleyenIsler,
      fiyatGorseliGonderildiMi: yanit.yapili.fiyat_gorseli !== null,
      fiyatVerilebilirMi: yanit.yapili.fiyat_verilebilir_mi,
      ilkTurdaFiyatSerbestMi: ilkTurdaFiyatSerbestMi(yanit.yapili),
      kalemFiyatlari: fiyat.kalemFiyatlari,
    })

    if (jsonMu) {
      turlar.push({
        musteri: musteriMetni,
        bot: yanit.yapili.mesajlar,
        yapili: yanit.yapili,
        bayraklar,
      })
    } else {
      console.log(`\n[MÜŞTERİ] ${musteriMetni}`)
      for (const m of yanit.yapili.mesajlar) console.log(`[BOT] ${m}`)
      if (yanit.yapili.fiyat_gorseli) {
        console.log(`[BOT] (fiyat listesi görseli: ${yanit.yapili.fiyat_gorseli})`)
      }
      const y = yanit.yapili
      console.log(
        `      · niyet=${y.niyet} arac=${y.arac ?? '-'} kapsam=${y.kapsam ?? '-'} ` +
          `fiyat_verilebilir=${y.fiyat_verilebilir_mi} devir=${y.devir_gerekli_mi} guven=${y.guven}`,
      )
      // Randevu alanları ayrı satırda: hatırlatma bunlara bağlı, koşarken
      // dolup dolmadığı görünmezse özellik sessizce bozulabilir.
      if (y.randevu_talebi || y.randevu_zaman) {
        console.log(
          `      📅 randevu_talebi="${y.randevu_talebi ?? '-'}" randevu_zaman=${y.randevu_zaman ?? 'BOŞ'}`,
        )
      }
      if (bayraklar.length > 0) {
        for (const b of bayraklar) console.log(`      🚩 ${b.tur}: ${b.aciklama}`)
      }
    }
  }

  if (jsonMu) console.log(JSON.stringify(turlar, null, 2))
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
