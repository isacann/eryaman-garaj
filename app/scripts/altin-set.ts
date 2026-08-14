// Altın seti koşturur ve raporu app/_altin-set/ altına yazar.
//
//   npm run altin-set                      # MOTOR_SAGLAYICI'ya göre
//   npm run altin-set -- --saglayici=sahte # anahtarsız uçtan uca deneme
//   npm run altin-set -- --saglayici=anthropic --model=claude-haiku-4-5
//   npm run altin-set -- --limit=3         # sadece ilk 3 vaka
//
// Anahtar yoksa net hata verir, sessizce boş rapor üretmez.

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { altinSetiKostur } from '../src/lib/motor/altin-set'
import { saglayiciAl } from '../src/lib/motor'
import { AnahtarYokHatasi } from '../src/lib/motor/saglayici'

/**
 * .env.local'i process.env'e yükler. Next dev sunucusu bunu kendi yapıyor ama
 * bu betik doğrudan node altında koşuyor. Kabuktaki değişken dosyayı ezer.
 */
function envYukle(): void {
  const yol = path.join(process.cwd(), '.env.local')
  if (!existsSync(yol)) return
  for (const satir of readFileSync(yol, 'utf8').split(/\r?\n/)) {
    const temiz = satir.trim()
    if (temiz === '' || temiz.startsWith('#')) continue
    const ayrac = temiz.indexOf('=')
    if (ayrac === -1) continue
    const ad = temiz.slice(0, ayrac).trim()
    if (process.env[ad] !== undefined) continue
    process.env[ad] = temiz.slice(ayrac + 1).trim()
  }
}

function bayrakAl(ad: string): string | undefined {
  const onek = `--${ad}=`
  const bulunan = process.argv.slice(2).find((a) => a.startsWith(onek))
  return bulunan?.slice(onek.length)
}

async function main() {
  envYukle()

  const saglayiciAdi = bayrakAl('saglayici')
  const model = bayrakAl('model')
  const limitHam = bayrakAl('limit')
  const limit = limitHam ? Number.parseInt(limitHam, 10) : undefined

  const saglayici = saglayiciAl(saglayiciAdi, model)

  const sonuc = await altinSetiKostur({
    saglayici,
    limit: Number.isFinite(limit) ? limit : undefined,
    gunluk: (satir) => console.log(satir),
  })

  const toplamBayrak = Object.values(sonuc.bayrakSayilari).reduce((a, b) => a + b, 0)
  console.log('')
  console.log(`rapor: ${sonuc.raporYolu}`)
  console.log(`tur: ${sonuc.toplamTur} · hatalı tur: ${sonuc.hataliTur} · bayrak: ${toplamBayrak}`)

  // Hatalı tur varsa çıkış kodu sıfır olmasın; bayrak bilgi amaçlı, koşuyu düşürmez.
  if (sonuc.hataliTur > 0) process.exitCode = 1
}

main().catch((hata) => {
  if (hata instanceof AnahtarYokHatasi) {
    console.error(`\n${hata.message}\n`)
    process.exit(2)
  }
  console.error(hata)
  process.exit(1)
})
