// Fiyat listesini uygulama diziniyle eşitler.
//
// NEDEN: fiyatın tek kaynağı ../FIYAT-LISTESI.md, uygulama dizininin DIŞINDA.
// Vercel'e sadece app/ klasörü çıkıyor, dolayısıyla üst dizindeki dosya
// yayında yok. Bot fiyatsız kalmasın diye derlemeden önce bir kopya
// app/FIYAT-LISTESI.md'ye alınır (motorun aradığı üçüncü yol orası).
//
// Kaynak hâlâ tek: üst dizindeki dosya. Buradaki kopya ÜRETİLİR, elle
// düzenlenmez. Fiyat değişince ../FIYAT-LISTESI.md güncellenir, sonraki
// derlemede kopya kendiliğinden tazelenir.
//
// Çalıştır: npm run fiyat:esitle (prebuild ile otomatik çalışır)

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const kok = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const kaynak = path.join(kok, '..', 'FIYAT-LISTESI.md')
const hedef = path.join(kok, 'FIYAT-LISTESI.md')

// Fiyat listesi GÖRSELLERİ de aynı sebeple kopyalanır: müşteriye gönderilen şey
// çoğu zaman bu görsel ("Fiyat listemizi yönlendiriyorum", arşivde 39 kez) ve
// Meta görseli herkese açık bir https adresinden çekiyor. public/ altına
// konunca panel adresi üzerinden servis edilir.
const GORSELLER = ['ppf-genel.png', 'cam-filmi.png', 'ppf-mikron-tablosu.png']
const gorselKaynak = path.join(kok, '..', 'fiyat-listesi')
const gorselHedef = path.join(kok, 'public', 'fiyat-listesi')

if (existsSync(gorselKaynak)) {
  mkdirSync(gorselHedef, { recursive: true })
  let sayi = 0
  for (const ad of GORSELLER) {
    const src = path.join(gorselKaynak, ad)
    if (!existsSync(src)) continue
    copyFileSync(src, path.join(gorselHedef, ad))
    sayi += 1
  }
  console.log(`✓ fiyat görselleri eşitlendi: ${sayi} dosya`)
} else if (existsSync(gorselHedef)) {
  console.log('· üst dizindeki görseller yok, mevcut kopyalar kullanılıyor')
}

const BASLIK =
  '<!-- ÜRETİLEN KOPYA. Elle düzenleme. Kaynak: ../FIYAT-LISTESI.md, ' +
  'eşitleyen: scripts/fiyat-esitle.mjs -->\n'

if (existsSync(kaynak)) {
  const icerik = readFileSync(kaynak, 'utf8')
  writeFileSync(hedef, BASLIK + icerik, 'utf8')
  console.log(`✓ fiyat listesi eşitlendi: ${path.relative(kok, hedef)}`)
} else if (existsSync(hedef)) {
  // Vercel'in derleme sunucusunda üst dizin yok; yüklenen kopya kullanılır.
  console.log('· üst dizindeki fiyat listesi yok, mevcut kopya kullanılıyor')
} else {
  console.error(
    'FIYAT-LISTESI.md hiçbir yerde yok. Bot fiyat bilgisi olmadan çalışamaz.\n' +
      `Beklenen: ${kaynak}`,
  )
  process.exit(1)
}

// Kopya bozulmadı mı: motorun aradığı başlıklar duruyor mu.
const kopya = readFileSync(hedef, 'utf8')
for (const baslik of ['## 1. ', '## 3. ', '## 4. ']) {
  if (!kopya.includes(`\n${baslik}`)) {
    console.error(`Kopyada "${baslik}" başlığı yok, biçim değişmiş. Motor bunu okuyamaz.`)
    process.exit(1)
  }
}
