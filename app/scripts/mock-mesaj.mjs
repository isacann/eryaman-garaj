// Sahte kanaldan mesaj yollar (geliştirme). Sunucu ayakta olmalı: npm run dev
// Çalıştır: npm run mock:gonder -- "905551112233" "Test Müşteri" "PPF fiyatı nedir?"
//
// Bu TEST verisidir. Panelde kanal rozeti "Test" görünür. Temizlemek için:
//   npm run mock:temizle

const [kimlik, ad, ...metinParcalari] = process.argv.slice(2)
const metin = metinParcalari.join(' ')
const adres = process.env.PANEL_ADRES ?? 'http://localhost:3000'

if (!kimlik || !metin) {
  console.error('Kullanım: npm run mock:gonder -- <kimlik> <ad> <metin>')
  process.exit(1)
}

const res = await fetch(`${adres}/api/mock/gelen`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ kimlik, ad: ad || null, metin }),
})

const govde = await res.text()
console.log(res.status, govde)
if (!res.ok) process.exit(1)
