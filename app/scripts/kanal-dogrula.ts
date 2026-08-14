// 🆓 BAKİYE GEREKMEZ — Evolution (WhatsApp) webhook çözücüsünün sınavı.
//
// Koş: npm run kanal:dogrula
//
// NEDEN VAR: kanal katmanı sistemin en sessiz kırılan yeri. Burada bir hata
// olduğunda sistem hata vermez — sadece müşteri mesajı hiç gelmez ya da bot
// cevaplamaması gereken bir şeye cevap yazar. İkisi de canlıda fark edilene
// kadar gerçek para kaybettirir.
//
// En kritik vaka `fromMe`: Evolution kendi gönderdiğimiz mesajı da webhook'a
// geri yolluyor. Elenmezse bot kendi cevabını müşteri mesajı sanıp kendine
// cevap yazar ve sonsuz döngüye girer — her turu para harcayarak.

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

// ⚠ `whatsapp.ts` dolaylı olarak `lib/env.ts`'i çekiyor ve o modül yüklenirken
// Supabase değişkenlerini ZORUNLU tutuyor. import'lar hoisted olduğu için
// envYukle() önce koşsa bile geç kalırdı — bu yüzden kanal DİNAMİK import
// ediliyor (aşağıda, main içinde). Tip tarafı derlemede siliniyor, sorun değil.
import type { GelenMesaj } from '../src/lib/channels/types'

function envYukle(): void {
  const yol = path.join(process.cwd(), '.env.local')
  if (!existsSync(yol)) return
  for (const satir of readFileSync(yol, 'utf8').split(/\r?\n/)) {
    const t = satir.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i > 0 && !process.env[t.slice(0, i).trim()]) {
      process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
    }
  }
}

type Vaka = {
  ad: string
  neden: string
  yuk: unknown
  bekleniyor: number
  kontrol?: (m: GelenMesaj) => string | null
}

/** Gerçek Evolution yükünün iskeleti; her vaka üstüne kendi farkını koyuyor. */
function yuk(veri: Record<string, unknown>, olay = 'MESSAGES_UPSERT') {
  return {
    event: olay,
    instance: 'eryaman',
    apikey: 'test-anahtar',
    data: {
      key: { remoteJid: '905317227480@s.whatsapp.net', fromMe: false, id: 'MSG1' },
      pushName: 'İsa Nurdoğdu',
      messageType: 'conversation',
      messageTimestamp: 1786000000,
      ...veri,
    },
  }
}

const VAKALAR: Vaka[] = [
  {
    ad: 'Düz metin mesajı',
    neden: 'En sık gelen biçim; çözülemezse hiçbir müşteri mesajı işlenmez.',
    yuk: yuk({ message: { conversation: 'ppf fiyatı nedir' } }),
    bekleniyor: 1,
    kontrol: (m) => {
      if (m.metin !== 'ppf fiyatı nedir') return `metin yanlış: ${m.metin}`
      if (m.kanalKimlik !== '905317227480') return `numara yanlış: ${m.kanalKimlik}`
      if (m.ad !== 'İsa Nurdoğdu') return `ad yanlış: ${m.ad}`
      if (m.hariciId !== 'MSG1') return `harici id yanlış: ${m.hariciId}`
      return null
    },
  },
  {
    ad: '🔴 Kendi gönderdiğimiz mesaj (fromMe)',
    neden:
      'Bot kendi cevabını müşteri mesajı sanarsa kendine cevap yazar ve SONSUZ DÖNGÜYE girer.',
    yuk: yuk({
      key: { remoteJid: '905317227480@s.whatsapp.net', fromMe: true, id: 'MSG2' },
      message: { conversation: 'Merhabalar İsa bey, fiyat listemizi yönlendiriyorum' },
    }),
    bekleniyor: 0,
  },
  {
    ad: '🔴 Fatih Bey telefondan elle yazdı (fromMe)',
    neden: 'Ekip cevabı da fromMe gelir; müşteri mesajı sayılırsa bot araya girer.',
    yuk: yuk({
      key: { remoteJid: '905317227480@s.whatsapp.net', fromMe: true, id: 'MSG3' },
      message: { conversation: 'Tabi hemen bakıyorum' },
    }),
    bekleniyor: 0,
  },
  {
    ad: 'Grup mesajı (@g.us)',
    neden: 'Bot gruplara asla cevap yazmamalı.',
    yuk: yuk({
      key: { remoteJid: '120363001234567890@g.us', fromMe: false, id: 'MSG4' },
      message: { conversation: 'selam millet' },
    }),
    bekleniyor: 0,
  },
  {
    ad: 'Durum güncellemesi (status@broadcast)',
    neden: 'Durum paylaşımı müşteri yazışması değil.',
    yuk: yuk({
      key: { remoteJid: 'status@broadcast', fromMe: false, id: 'MSG5' },
      message: { conversation: 'durumum' },
    }),
    bekleniyor: 0,
  },
  {
    ad: 'Mesaj olmayan olay (connection.update)',
    neden: 'Evolution 40+ olay yolluyor; sadece mesaj olanı işlenmeli.',
    yuk: { event: 'CONNECTION_UPDATE', instance: 'eryaman', data: { state: 'open' } },
    bekleniyor: 0,
  },
  {
    ad: 'Olay adı küçük harf + nokta (messages.upsert)',
    neden: 'Evolution sürümüne göre olay adı biçim değiştiriyor; ikisi de tanınmalı.',
    yuk: yuk({ message: { conversation: 'cam filmi' } }, 'messages.upsert'),
    bekleniyor: 1,
  },
  {
    ad: 'Alıntılı/uzun metin (extendedTextMessage)',
    neden: 'Müşteri bir mesajı alıntılayıp yazdığında biçim değişiyor.',
    yuk: yuk({
      messageType: 'extendedTextMessage',
      message: { extendedTextMessage: { text: 'peki komple ne kadar' } },
    }),
    bekleniyor: 1,
    kontrol: (m) => (m.metin === 'peki komple ne kadar' ? null : `metin yanlış: ${m.metin}`),
  },
  {
    ad: 'Fotoğraf + alt yazı',
    neden: 'Müşteri aracının fotoğrafını alt yazıyla atıyor (sahada sık).',
    yuk: yuk({
      messageType: 'imageMessage',
      message: { imageMessage: { caption: 'aracım bu, fiyat alabilir miyim' } },
    }),
    bekleniyor: 1,
    kontrol: (m) =>
      m.metin === 'aracım bu, fiyat alabilir miyim' ? null : `metin yanlış: ${m.metin}`,
  },
  {
    ad: 'Alt yazısız fotoğraf',
    neden: 'Metin yok ama mesaj var; sessizce yutulursa müşteri cevapsız kalır.',
    yuk: yuk({ messageType: 'imageMessage', message: { imageMessage: { url: 'https://x/y.jpg' } } }),
    bekleniyor: 1,
    kontrol: (m) => (m.metin === null ? null : `metin null olmalıydı: ${m.metin}`),
  },
  {
    ad: 'Reklamdan gelen mesaj (externalAdReply)',
    neden:
      'Reklamdan gelen müşteri "merhaba" yazsa bile hangi hizmet için geldiği bilinmeli (bot_egitim kampanya eşleşmesi buna bakıyor).',
    yuk: yuk({
      messageType: 'extendedTextMessage',
      message: {
        extendedTextMessage: {
          text: 'merhaba',
          contextInfo: {
            externalAdReply: {
              title: 'Cam Filmi Kampanyası',
              body: '4.500₺den başlayan fiyatlarla',
              sourceId: '120210000000',
            },
          },
        },
      },
    }),
    bekleniyor: 1,
    kontrol: (m) => {
      if (!m.reklam) return 'reklam bilgisi çözülmedi'
      if (m.reklam.baslik !== 'Cam Filmi Kampanyası') return `başlık yanlış: ${m.reklam.baslik}`
      if (m.reklam.adId !== '120210000000') return `ad id yanlış: ${m.reklam.adId}`
      return null
    },
  },
  {
    ad: 'Boş / bozuk yük',
    neden: 'Çözücü patlarsa webhook 500 döner ve Evolution mesajı tekrar tekrar yollar.',
    yuk: null,
    bekleniyor: 0,
  },
  {
    ad: 'Mesaj gövdesi olmayan upsert',
    neden: 'Silinen/düzenlenen mesaj bildirimlerinde gövde gelmeyebiliyor.',
    yuk: yuk({ message: undefined }),
    bekleniyor: 0,
  },
]

async function main() {
  envYukle()
  const { whatsappKanal } = await import('../src/lib/channels/whatsapp')

  let gecen = 0
  const dusenler: string[] = []

  console.log('\nEvolution (WhatsApp) kanal çözücüsü — bakiyesiz sınav\n')
  console.log('─'.repeat(72))

  for (const vaka of VAKALAR) {
    let sonuc: GelenMesaj[]
    try {
      sonuc = whatsappKanal.gelenMesajiCoz(vaka.yuk)
    } catch (e) {
      dusenler.push(`${vaka.ad} — ÇÖZÜCÜ PATLADI: ${e instanceof Error ? e.message : e}`)
      console.log(`✗ ${vaka.ad}\n    çözücü patladı: ${e instanceof Error ? e.message : e}`)
      continue
    }

    if (sonuc.length !== vaka.bekleniyor) {
      dusenler.push(`${vaka.ad} — ${vaka.bekleniyor} mesaj bekleniyordu, ${sonuc.length} çıktı`)
      console.log(`✗ ${vaka.ad}`)
      console.log(`    ${vaka.bekleniyor} mesaj bekleniyordu, ${sonuc.length} çıktı`)
      console.log(`    neden önemli: ${vaka.neden}`)
      continue
    }

    const hata = vaka.kontrol && sonuc[0] ? vaka.kontrol(sonuc[0]) : null
    if (hata) {
      dusenler.push(`${vaka.ad} — ${hata}`)
      console.log(`✗ ${vaka.ad}\n    ${hata}\n    neden önemli: ${vaka.neden}`)
      continue
    }

    gecen++
    console.log(`✓ ${vaka.ad}`)
  }

  console.log('─'.repeat(72))
  console.log(`\n${gecen}/${VAKALAR.length} vaka doğru çözüldü\n`)

  if (dusenler.length > 0) {
    console.log('Düşenler:')
    for (const d of dusenler) console.log(`  • ${d}`)
    console.log('')
    process.exit(1)
  }
}

void main()
