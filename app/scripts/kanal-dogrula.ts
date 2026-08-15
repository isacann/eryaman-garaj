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

/** Gerçek Instagram yükünün iskeleti. */
function igYuk(olay: Record<string, unknown>, nesne = 'instagram') {
  return {
    object: nesne,
    entry: [
      {
        id: '17841400000000000',
        messaging: [
          {
            sender: { id: 'IGSID-MUSTERI' },
            recipient: { id: '17841400000000000' },
            timestamp: 1786000000000,
            ...olay,
          },
        ],
      },
    ],
  }
}

const IG_VAKALAR: Vaka[] = [
  {
    ad: 'Düz DM',
    neden: 'En sık biçim; çözülemezse hiçbir Instagram mesajı işlenmez.',
    yuk: igYuk({ message: { mid: 'MID1', text: 'cam filmi fiyatı' } }),
    bekleniyor: 1,
    kontrol: (m) => {
      if (m.kanal !== 'instagram') return `kanal yanlış: ${m.kanal}`
      if (m.metin !== 'cam filmi fiyatı') return `metin yanlış: ${m.metin}`
      if (m.kanalKimlik !== 'IGSID-MUSTERI') return `kimlik yanlış: ${m.kanalKimlik}`
      if (m.hariciId !== 'MID1') return `harici id yanlış: ${m.hariciId}`
      return null
    },
  },
  {
    ad: '🔴 Kendi gönderdiğimiz mesaj (is_echo)',
    neden:
      'WhatsApp fromMe filtresinin Instagram karşılığı. Elenmezse bot kendi cevabına cevap yazar, SONSUZ DÖNGÜ.',
    yuk: igYuk({
      sender: { id: '17841400000000000' },
      recipient: { id: 'IGSID-MUSTERI' },
      message: { mid: 'MID2', text: 'Merhabalar, fiyat listemiz...', is_echo: true },
    }),
    bekleniyor: 0,
  },
  {
    ad: '🔴 Okundu bildirimi',
    neden: 'Mesaj değil; işlenirse boş kayıt açılır ve bot sebepsiz cevap yazar.',
    yuk: igYuk({ read: { mid: 'MID3' } }),
    bekleniyor: 0,
  },
  {
    ad: '🔴 Tepki (reaction)',
    neden: 'Müşteri kalp bıraktı diye bot cevap yazmamalı.',
    yuk: igYuk({ reaction: { mid: 'MID4', action: 'react', emoji: '❤️' } }),
    bekleniyor: 0,
  },
  {
    ad: '🔴 Silinmiş mesaj',
    neden: 'Müşteri mesajını sildiyse içerik yok.',
    yuk: igYuk({ message: { mid: 'MID5', is_deleted: true } }),
    bekleniyor: 0,
  },
  {
    ad: '🔴 Yorum olayı (changes)',
    neden: 'Instagram yorumları KAPSAM DIŞI (Bölüm 3), yalnızca DM işlenir.',
    yuk: { object: 'instagram', entry: [{ id: '1784', changes: [{ field: 'comments' }] }] },
    bekleniyor: 0,
  },
  {
    ad: '🔴 Başka ürünün yükü (object=page)',
    neden: 'Messenger/Facebook olayı Instagram rotasına düşerse işlenmemeli.',
    yuk: igYuk({ message: { mid: 'MID6', text: 'selam' } }, 'page'),
    bekleniyor: 0,
  },
  {
    ad: 'Fotoğraf eki',
    neden: 'Müşteri aracının fotoğrafını atıyor; bot bakıp not düşecek.',
    yuk: igYuk({
      message: {
        mid: 'MID7',
        attachments: [{ type: 'image', payload: { url: 'https://x/arac.jpg' } }],
      },
    }),
    bekleniyor: 1,
    kontrol: (m) =>
      m.medyaUrl === 'https://x/arac.jpg' ? null : `medya adresi yanlış: ${m.medyaUrl}`,
  },
  {
    ad: 'Reklamdan gelen DM (ads_context_data)',
    neden:
      'Reklamdan gelen müşteri "merhaba" yazsa bile hangi hizmet için geldiği bilinmeli (kampanya eşleşmesi buna bakıyor).',
    yuk: igYuk({
      message: {
        mid: 'MID8',
        text: 'merhaba',
        referral: {
          source: 'ADS',
          ad_id: '120210000000',
          ads_context_data: { ad_title: 'Cam Filmi Kampanyası' },
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
    ad: 'Zaman damgası milisaniye çözülüyor',
    neden:
      'Instagram ms, WhatsApp saniye veriyor. Karıştırılırsa mesaj 1970 tarihine düşer ve sıralama bozulur.',
    yuk: igYuk({ message: { mid: 'MID9', text: 'selam' }, timestamp: 1786000000000 }),
    bekleniyor: 1,
    kontrol: (m) =>
      m.zaman.startsWith('2026-') ? null : `zaman yanlış çözüldü: ${m.zaman}`,
  },
]

async function main() {
  envYukle()
  const { whatsappKanal } = await import('../src/lib/channels/whatsapp')
  const { instagramKanal } = await import('../src/lib/channels/instagram')

  let gecen = 0
  const dusenler: string[] = []

  function vakalariKosur(baslik: string, vakalar: Vaka[], coz: (y: unknown) => GelenMesaj[]) {
    console.log(`\n${baslik}`)
    console.log('─'.repeat(72))

    for (const vaka of vakalar) {
      let sonuc: GelenMesaj[]
      try {
        sonuc = coz(vaka.yuk)
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
  }

  vakalariKosur(
    'Evolution (WhatsApp) kanal çözücüsü — bakiyesiz sınav',
    VAKALAR,
    (y) => whatsappKanal.gelenMesajiCoz(y),
  )
  vakalariKosur('Instagram (Meta) kanal çözücüsü', IG_VAKALAR, (y) =>
    instagramKanal.gelenMesajiCoz(y),
  )

  // ── Giden ekip mesajı çözücüsü (Fatih Bey, 15 Ağustos: "Biz mesaja cevap
  // verdikten sonra bot devreden çıksın"). gelenMesajiCoz'un TAM TERSİ filtresi.
  //
  // ⚠ En tehlikeli hata burada "fazla yakalamak": bu çözücü bir müşteri
  // mesajını giden sanarsa yazışma yanlışlıkla devre geçer ve bot bir daha hiç
  // yazmaz. O yüzden fromMe=false olan HER şey elenmeli.
  console.log('\nGiden ekip mesajı çözücüsü — botu susturan yol')
  console.log('─'.repeat(72))

  const gidenVakalari: { ad: string; neden: string; yuk: unknown; bekleniyor: number }[] = [
    {
      ad: 'Ekip telefondan yazdı (fromMe) → yakalanır',
      neden: 'Asıl hedef: Fatih Bey telefondan cevap yazınca bot susmalı.',
      yuk: yuk({
        key: { remoteJid: '905317227480@s.whatsapp.net', fromMe: true, id: 'OUT1' },
        message: { conversation: 'Merhaba, hemen dönüş sağlıyorum' },
      }),
      bekleniyor: 1,
    },
    {
      ad: '🔴 Müşteri mesajı (fromMe=false) → yakalanmaz',
      neden: 'Yakalanırsa müşteri yazdıkça yazışma devre geçer, bot hiç cevap vermez.',
      yuk: yuk({
        key: { remoteJid: '905317227480@s.whatsapp.net', fromMe: false, id: 'IN1' },
        message: { conversation: 'PPF fiyatı nedir' },
      }),
      bekleniyor: 0,
    },
    {
      ad: '🔴 Kimliksiz giden mesaj → yakalanmaz',
      neden: 'Kimlik yoksa bot mesajından ayırt edilemez; şüphede işlem yapılmaz.',
      yuk: yuk({
        key: { remoteJid: '905317227480@s.whatsapp.net', fromMe: true },
        message: { conversation: 'kimliksiz' },
      }),
      bekleniyor: 0,
    },
    {
      ad: '🔴 Gruba giden mesaj → yakalanmaz',
      neden: 'Grup yazışması müşteri sohbeti değil.',
      yuk: yuk({
        key: { remoteJid: '120363001234567890@g.us', fromMe: true, id: 'OUT2' },
        message: { conversation: 'gruba yazdım' },
      }),
      bekleniyor: 0,
    },
    {
      ad: '🔴 Mesaj olmayan olay → yakalanmaz',
      neden: 'Evolution 40+ olay tipi yolluyor; sadece messages.upsert işlenir.',
      yuk: yuk(
        {
          key: { remoteJid: '905317227480@s.whatsapp.net', fromMe: true, id: 'OUT3' },
          message: { conversation: 'x' },
        },
        'CONNECTION_UPDATE',
      ),
      bekleniyor: 0,
    },
  ]

  for (const v of gidenVakalari) {
    let sonuc
    try {
      sonuc = whatsappKanal.gidenEkipMesajiCoz?.(v.yuk) ?? []
    } catch (e) {
      dusenler.push(`${v.ad} — çözücü patladı`)
      console.log(`✗ ${v.ad}\n    çözücü patladı: ${e instanceof Error ? e.message : e}`)
      continue
    }
    if (sonuc.length !== v.bekleniyor) {
      dusenler.push(`${v.ad} — ${v.bekleniyor} bekleniyordu, ${sonuc.length} çıktı`)
      console.log(`✗ ${v.ad}\n    ${v.bekleniyor} bekleniyordu, ${sonuc.length} çıktı`)
      console.log(`    neden önemli: ${v.neden}`)
      continue
    }
    gecen++
    console.log(`✓ ${v.ad}`)
  }

  // İki çözücü asla aynı mesajı döndürmemeli — biri müşteri, biri işletme.
  const ortakYuk = yuk({
    key: { remoteJid: '905317227480@s.whatsapp.net', fromMe: true, id: 'OUT9' },
    message: { conversation: 'aynı yük' },
  })
  const gelenSayi = whatsappKanal.gelenMesajiCoz(ortakYuk).length
  const gidenSayi = whatsappKanal.gidenEkipMesajiCoz?.(ortakYuk).length ?? 0
  if (gelenSayi === 0 && gidenSayi === 1) {
    gecen++
    console.log('✓ Aynı yükte iki çözücü çakışmıyor (gelen 0, giden 1)')
  } else {
    dusenler.push(`çözücü çakışması — gelen ${gelenSayi}, giden ${gidenSayi}`)
    console.log(`✗ Çözücü çakışması: gelen ${gelenSayi}, giden ${gidenSayi} (gelen 0 olmalı)`)
  }

  const toplam = VAKALAR.length + IG_VAKALAR.length + gidenVakalari.length + 1
  console.log('─'.repeat(72))
  console.log(`\n${gecen}/${toplam} vaka doğru çözüldü\n`)

  if (dusenler.length > 0) {
    console.log('Düşenler:')
    for (const d of dusenler) console.log(`  • ${d}`)
    console.log('')
    process.exit(1)
  }
}

void main()
