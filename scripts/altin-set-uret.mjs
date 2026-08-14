// Gercek DM arsivinden "altin set" uretir: musteri sorusu + Fatih Bey'in gercek cevabi.
// Bot bu sorulara ne diyor, gercek cevapla yan yana konacak.
// Kullanim: node scripts/altin-set-uret.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const arsiv = JSON.parse(fs.readFileSync(path.join(root, 'arsiv/instagram-dm.json'), 'utf8'))

// Arayuz kalintilarini ele (isim tekrari, "sana yanit verdi" vb.)
const cop = (t, ad) =>
  t === ad ||
  /sana yanıt verdi$|gördü$|hikayesini paylaştı$|Hikayesinde senden bahsetti/i.test(t) ||
  /^[a-z0-9._]+$/i.test(t) && t.length < 20 && t === t.toLowerCase()

const temiz = arsiv
  .map((s) => ({ ...s, mesajlar: s.mesajlar.filter((m) => !cop(m.metin, s.ad)) }))
  .filter((s) => {
    const ms = s.mesajlar.filter((m) => m.yon === 'musteri')
    const eg = s.mesajlar.filter((m) => m.yon === 'isletme')
    return ms.length >= 1 && eg.length >= 1 && s.mesajlar.length >= 3
  })

// Kategoriler: her biri botun farkli bir davranisini sinar
const kategoriler = [
  { ad: 'net-fiyat', test: (s) => s.mesajlar.some((m) => m.yon === 'isletme' && /[0-9][0-9.]*\s*₺/.test(m.metin)), hedef: 6 },
  { ad: 'fiyat-listesi', test: (s) => s.mesajlar.some((m) => m.yon === 'isletme' && /fiyat listemizi/i.test(m.metin)), hedef: 3 },
  { ad: 'numara-iste-devir', test: (s) => s.mesajlar.some((m) => m.yon === 'isletme' && /iletişim numaranızı/i.test(m.metin)), hedef: 3 },
  { ad: 'arac-kapsam-sorma', test: (s) => s.mesajlar.some((m) => m.yon === 'isletme' && /marka\/modeli|kaç cam|kaç parça|hangi/i.test(m.metin)), hedef: 3 },
  { ad: 'adres-sure-taksit', test: (s) => s.mesajlar.some((m) => m.yon === 'musteri' && /nerede|adres|kaç gün|süre|taksit|kart/i.test(m.metin)), hedef: 3 },
  { ad: 'pazarlik', test: (s) => s.mesajlar.some((m) => m.yon === 'musteri' && /indirim|pazarlık|son fiyat|olur mu/i.test(m.metin)), hedef: 2 },
]

const secilen = []
const alinan = new Set()
for (const k of kategoriler) {
  let sayac = 0
  for (const s of temiz) {
    if (sayac >= k.hedef) break
    if (alinan.has(s.ad)) continue
    if (!k.test(s)) continue
    alinan.add(s.ad)
    sayac++
    secilen.push({
      kategori: k.ad,
      kaynak: s.ad,
      // Bota verilecek girdi: sadece musteri tarafi + varsa isletmenin ilk sorusu
      konusma: s.mesajlar.map((m) => ({ kim: m.yon === 'isletme' ? 'isletme' : 'musteri', metin: m.metin })),
      // Karsilastirma olcutu: isletmenin gercekte verdigi cevaplar
      gercek_cevaplar: s.mesajlar.filter((m) => m.yon === 'isletme').map((m) => m.metin),
    })
  }
}

fs.writeFileSync(path.join(root, 'altin-set.json'), JSON.stringify(secilen, null, 2), 'utf8')

const md = secilen
  .map((s, i) => {
    const konusma = s.konusma.map((m) => `${m.kim === 'isletme' ? 'ERYAMAN GARAJ' : 'MÜŞTERİ'}: ${m.metin.replace(/\n+/g, ' / ')}`).join('\n')
    return `### ${i + 1}. [${s.kategori}] ${s.kaynak}\n\n${konusma}\n`
  })
  .join('\n')
fs.writeFileSync(
  path.join(root, 'ALTIN-SET.md'),
  `# Altın Set — botun sınav kağıdı\n\nGerçek Instagram DM arşivinden seçilmiş ${secilen.length} konuşma.\nHer biri botun farklı bir davranışını sınar. Botun cevabı, Fatih Bey'in o gün verdiği gerçek cevapla yan yana konur.\n\n${md}`,
  'utf8',
)

console.log(`altin-set.json + ALTIN-SET.md yazildi: ${secilen.length} konusma`)
for (const k of kategoriler) {
  console.log(`  ${k.ad.padEnd(20)} ${secilen.filter((s) => s.kategori === k.ad).length}/${k.hedef}`)
}
