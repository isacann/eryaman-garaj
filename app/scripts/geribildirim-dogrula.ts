// Fatih Bey'in TÜM geri bildirimlerinin regresyon sınavı.
//
// Neden bu dosya var: Fatih Bey 8-11 Ağustos arasında onlarca geri bildirim
// verdi. Her biri düzeltildi, ama düzeltmenin KALICI olduğunu kanıtlayan tek
// şey burası. Bir kural buraya yazılmadıysa, bir sonraki değişiklikte sessizce
// geri gelebilir ve bunu Fatih Bey'in kendisi bulur.
//
// ⚠ HER VAKA BİRDEN ÇOK KEZ KOŞULUR (varsayılan 3). Sebebi acı deneyim:
// 11 Ağustos'ta "ilk cevapta selam + isim" kuralı 3 koşudan 1'inde tutuyordu,
// ama sınav vakayı tek kez koştuğu için "18/18 geçti" diyordu. Model varyansı
// gerçek; tek koşu yalan söyler. Bir kontrol ancak TÜM koşularda geçerse geçmiş
// sayılır, aksi halde KIRILGAN olarak raporlanır.
//
// Çalıştır:
//   npm run geribildirim:dogrula              (3 tekrar — sürüm öncesi)
//   npm run geribildirim:dogrula -- --tekrar=1 (hızlı bakış, varyansı göremez)
//   npm run geribildirim:dogrula -- --vaka=hitap  (tek vaka, ad araması)

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

const saglayici = saglayiciAl()
const fiyat = fiyatBilgisiAl()
const OGLEN = new Date('2026-08-10T09:00:00.000Z') // TR 12:00

const argv = process.argv.slice(2)
const tekrarBayragi = argv.find((a) => a.startsWith('--tekrar='))
const TEKRAR = tekrarBayragi ? Math.max(1, Number(tekrarBayragi.slice('--tekrar='.length))) : 3
const atlaBayragi = argv.find((a) => a.startsWith('--atla='))
const ATLA = atlaBayragi ? Math.max(0, Number(atlaBayragi.slice('--atla='.length))) : 0
const adetBayragi = argv.find((a) => a.startsWith('--adet='))
const ADET = adetBayragi ? Math.max(1, Number(adetBayragi.slice('--adet='.length))) : null
const vakaBayragi = argv.find((a) => a.startsWith('--vaka='))
const VAKA_FILTRE = vakaBayragi ? vakaBayragi.slice('--vaka='.length).toLocaleLowerCase('tr') : null

type TurSonuc = {
  mesajlar: string[]
  metin: string
  yapili: Awaited<ReturnType<typeof yanitUret>>['yapili']
  bayraklar: { tur: string; aciklama: string }[]
}

type Kontrol = {
  ad: string
  gec: (s: TurSonuc) => boolean
  /** Kaldığında ekrana basılacak kanıt. */
  kanit?: (s: TurSonuc) => string
}

type Vaka = {
  ad: string
  /** Hangi geri bildirimden geldiği — kural tartışılırsa kaynağa dönülür. */
  kaynak: string
  kisiAdi?: string
  konusma: KonusmaMesaji[]
  kontroller: Kontrol[]
}

async function tur(konusma: KonusmaMesaji[], kisiAdi?: string): Promise<TurSonuc> {
  // Üretim yolu (bot.ts) yanitUret üzerinden gidiyor; zorunlu-parça düzeltme
  // turu orada devreye giriyor. Sağlayıcıyı doğrudan çağırmak gerçek davranışı
  // test etmiyordu (11 Ağustos bulgusu).
  const yanit = await yanitUret({ konusma, kisiAdi, simdi: OGLEN }, saglayici)
  const ilkCevapMi = !konusma.some((m) => m.rol === 'bot')
  const bayraklar = bayraklariBul(yanit.metin, {
    ilkCevapMi,
    izinliRakamlar: fiyat.izinliRakamlar,
    teyitBekleyenIsler: fiyat.teyitBekleyenIsler,
    fiyatGorseliGonderildiMi: yanit.yapili.fiyat_gorseli !== null,
    fiyatVerilebilirMi: yanit.yapili.fiyat_verilebilir_mi,
    ilkTurdaFiyatSerbestMi: ilkTurdaFiyatSerbestMi(yanit.yapili),
    kalemFiyatlari: fiyat.kalemFiyatlari,
  })
  return {
    mesajlar: yanit.yapili.mesajlar,
    metin: yanit.metin.toLocaleLowerCase('tr'),
    yapili: yanit.yapili,
    bayraklar,
  }
}

// ── Ortak yardımcılar ───────────────────────────────────────────────────────

const bayraksiz: Kontrol = {
  ad: 'kırmızı bayrak yok',
  gec: (s) => s.bayraklar.length === 0,
  kanit: (s) => s.bayraklar.map((b) => `${b.tur}: ${b.aciklama}`).join(' | '),
}

const SELAM = /(merhabalar|merhaba|hoşgeldin|hoş geldin|iyi günler|selam)/i

/** Kurumsal soğukluk göstergeleri (Fatih Bey: "bot çok resmi"). */
const RESMI_KALIPLAR = [
  'müşteri danışmanımız',
  'detaylı bilgi vermek ve size en doğru',
  'tarafımıza iletilmiştir',
  'talebiniz alınmıştır',
  'tarafınıza dönüş sağlanacaktır',
]

const resmiDilYok: Kontrol = {
  ad: 'kurumsal/memur dili yok',
  gec: (s) => !RESMI_KALIPLAR.some((k) => s.metin.includes(k)),
  kanit: (s) => RESMI_KALIPLAR.filter((k) => s.metin.includes(k)).join(' | '),
}

function rakamVar(s: TurSonuc, ...rakamlar: string[]): boolean {
  return rakamlar.some((r) => s.metin.includes(r))
}

// ── VAKALAR ─────────────────────────────────────────────────────────────────

const VAKALAR: Vaka[] = [
  {
    ad: 'togg-devretmeme',
    kaynak: 'Fatih Bey, 8 Ağustos: "burda devir istedi vermeden cevaplayabilir"',
    konusma: [
      { rol: 'musteri', metin: 'Togg t10x Mat olacak jantlar siyah olacak panjur siyah olacak' },
    ],
    kontroller: [
      {
        ad: 'bildiği işi devretmiyor',
        gec: (s) => !s.yapili.devir_gerekli_mi,
        kanit: (s) => `devir_sebebi: ${s.yapili.devir_sebebi}`,
      },
      {
        ad: 'obsidyen paketinden bahsetti',
        gec: (s) => s.metin.includes('obsid') || s.metin.includes('opsid'),
      },
      {
        ad: 'numara isteyip kaçmadı',
        gec: (s) =>
          !s.metin.includes('iletişim numaranızı') && !s.metin.includes('numaranızı bırak'),
      },
      {
        // Burada `bayraksiz` kullanmıyoruz: müşteri fiyat sormadan ne istediğini
        // yazdığı için `ilk-cevapta-fiyat` ateşliyor, oysa Fatih Bey'in bu
        // vakadaki isteği "devretme, ANLAT" idi — Togg paket fiyatını vermesi
        // kusur değil. Gerçek risk yanlış/uydurma rakam; kontrol ona bakıyor.
        ad: 'rakamlar listeden (uydurma/yanlış kalem yok)',
        gec: (s) =>
          !s.bayraklar.some((b) => b.tur === 'liste-disi-fiyat' || b.tur === 'yanlis-kalem-fiyati'),
        kanit: (s) => s.bayraklar.map((b) => `${b.tur}: ${b.aciklama}`).join(' | '),
      },
    ],
  },

  {
    ad: 'satis-merdiveni',
    kaynak: 'Fatih Bey, 8 Ağustos: "direk ultimate plus\'ı verdi, önce ekstre sonra Armor"',
    konusma: [
      { rol: 'musteri', metin: 'Merhaba komple ppf yaptırmak istiyorum' },
      { rol: 'bot', metin: 'Merhabalar, aracınızın marka ve modeli nedir?' },
      { rol: 'musteri', metin: 'Bmw 320i' },
      { rol: 'bot', metin: 'PPF için komple mi düşünüyorsunuz?' },
      { rol: 'musteri', metin: 'Komple düşünüyorum' },
    ],
    kontroller: [
      {
        ad: 'Xtreme (100.000) listede',
        gec: (s) => rakamVar(s, '100.000', '100000'),
        kanit: (s) => s.mesajlar.join(' / ').slice(0, 150),
      },
      {
        ad: 'sadece Ultimate Plus ile açmadı',
        gec: (s) => !rakamVar(s, '170.000', '170000') || rakamVar(s, '100.000', '100000'),
      },
      {
        // 10 Ağustos: "en fazla iki seçenek" kuralı kaldırıldı, seriler TAM listelenir.
        ad: 'serilerin tamamını listeledi (en az 4 seri)',
        gec: (s) =>
          ['100.000', '125.000', '170.000', '190.000', '75.000'].filter((r) =>
            s.metin.includes(r),
          ).length >= 4,
        kanit: (s) => s.mesajlar.join(' / ').slice(0, 200),
      },
      {
        // DİKKAT: sıra yalnızca LİSTE SATIRLARINDAN okunur. Tüm metne bakmak
        // yanlış alarm veriyordu: liste doğru sıralıyken ardından gelen
        // "fiyat/performans olarak XPEL Xtreme öneriyoruz" cümlesi son "xpel"
        // geçişini Global'in arkasına atıyor ve test bot doğruyken düşüyordu.
        ad: 'Global liste sonunda (PPF sırası)',
        gec: (s) => {
          const satirlar = s.mesajlar
            .join('\n')
            .split('\n')
            .map((x) => x.trim().toLocaleLowerCase('tr'))
            .filter((x) => /^[•\-*✅]/.test(x))
          const sonGlobal = satirlar.findLastIndex((x) => x.includes('global'))
          const sonXpel = satirlar.findLastIndex((x) => x.includes('xpel'))
          return sonGlobal === -1 || sonXpel === -1 || sonGlobal > sonXpel
        },
        kanit: (s) => s.mesajlar.join(' / ').slice(0, 200),
      },
      bayraksiz,
    ],
  },

  {
    ad: 'pahali-itirazi-global',
    kaynak: 'Fatih Bey: "Fiyat pahalı dediğinde global ürünümüz de var deyip önersin"',
    konusma: [
      { rol: 'musteri', metin: 'Merhaba passat 2020 komple ppf fiyatı nedir' },
      { rol: 'bot', metin: 'XPEL Xtreme komple PPF uygulamamız 100.000₺.' },
      { rol: 'musteri', metin: 'Çok pahalıymış' },
    ],
    kontroller: [
      { ad: 'Global önerdi', gec: (s) => s.metin.includes('global') },
      {
        ad: 'indirim vaadi vermedi',
        gec: (s) => !s.bayraklar.some((b) => b.tur === 'indirim-vaadi'),
      },
      bayraksiz,
    ],
  },

  {
    ad: 'isim-kullanimi-erkek',
    kaynak: 'Fatih Bey, 9 Ağustos: "Merhabalar İbrahim bey hoşgeldiniz"',
    kisiAdi: 'İbrahim',
    konusma: [
      { rol: 'musteri', metin: 'Sıfır pejo 408 aracımı pff kaplatmak istiyorum fiyatı nedir acaba' },
    ],
    kontroller: [
      {
        ad: 'adını kullandı',
        gec: (s) => s.metin.includes('i̇brahim') || s.metin.includes('ibrahim'),
        kanit: (s) => s.mesajlar[0] ?? '',
      },
      {
        ad: '"bey" hitabı kullandı',
        gec: (s) => /i̇?brahim\s*bey/i.test(s.metin),
        kanit: (s) => s.mesajlar[0] ?? '',
      },
      { ad: 'kapsamı sordu', gec: (s) => /kapsaml|kısmi|ön\s*3|ön\s*4|komple/i.test(s.metin) },
      bayraksiz,
    ],
  },

  {
    // 10 Ağustos, test ajanı bulgusu: "Ayşe bey" 3/3 kadın isminde tekrarladı.
    ad: 'hitap-kadin-hanim',
    kaynak: '10 Ağustos test ajanı: prompt "${isim} bey" diye sabitlenmişti, "Ayşe bey" çıktı',
    kisiAdi: 'Ayşe',
    konusma: [{ rol: 'musteri', metin: 'Merhaba cam filmi fiyatlarınızı öğrenebilir miyim' }],
    kontroller: [
      {
        ad: '"Ayşe bey" DEMEDİ',
        gec: (s) => !/ayşe\s*bey/i.test(s.metin),
        kanit: (s) => s.mesajlar[0] ?? '',
      },
      {
        ad: 'adını kullandı',
        gec: (s) => s.metin.includes('ayşe'),
        kanit: (s) => s.mesajlar[0] ?? '',
      },
    ],
  },

  {
    ad: 'hitap-unisex-atla',
    kaynak: '10 Ağustos: unisex isimde (Deniz) hitap ATLANIR, cinsiyet tahmin edilmez',
    kisiAdi: 'Deniz',
    konusma: [{ rol: 'musteri', metin: 'Merhaba seramik kaplama yaptırmak istiyorum' }],
    kontroller: [
      {
        ad: 'unisex isimde bey/hanım uydurmadı',
        gec: (s) => !/deniz\s*(bey|hanım)/i.test(s.metin),
        kanit: (s) => s.mesajlar[0] ?? '',
      },
    ],
  },

  {
    ad: 'kalem-fiyat-eslesmesi',
    kaynak: 'Fatih Bey, 9 Ağustos: "XPEL Xtreme ön 4 parça 25.000₺" — doğrusu 35.000₺',
    kisiAdi: 'İbrahim',
    konusma: [
      { rol: 'musteri', metin: 'Sıfır pejo 408 aracımı ppf kaplatmak istiyorum' },
      {
        rol: 'bot',
        metin: 'Merhabalar İbrahim bey hoşgeldiniz. Tam kapsamlı mı kısmi mi düşünüyorsunuz?',
      },
      { rol: 'musteri', metin: 'Ön 4 parça düşünüyorum' },
    ],
    kontroller: [
      {
        ad: 'ürün ile fiyat aynı satırdan',
        gec: (s) => !s.bayraklar.some((b) => b.tur === 'yanlis-kalem-fiyati'),
        kanit: (s) => s.bayraklar.find((b) => b.tur === 'yanlis-kalem-fiyati')?.aciklama ?? '',
      },
      bayraksiz,
    ],
  },

  {
    ad: 'selamlama-tekrari',
    kaynak: 'Fatih Bey, 10 Ağustos: "sürekli merhaba diyor"',
    konusma: [
      { rol: 'musteri', metin: 'Merhaba bmw g30 için ppf düşünüyorum' },
      { rol: 'bot', metin: 'Merhabalar, tam kapsamlı mı kısmi mi düşünüyorsunuz?' },
      { rol: 'musteri', metin: 'G30 karar veremedim siz hangisini önerirsiniz' },
      {
        rol: 'bot',
        metin:
          'G30 için günlük kullanımda XPEL Xtreme ön 4 parça en çok tercih edilen başlangıç paketimizdir.',
      },
      { rol: 'musteri', metin: 'Fiyatlarınız nekadar' },
    ],
    kontroller: [
      {
        ad: 'konuşma ortasında selamlamadı',
        gec: (s) => !SELAM.test(s.mesajlar.join(' ')),
        kanit: (s) => s.mesajlar[0] ?? '',
      },
      bayraksiz,
    ],
  },

  {
    ad: 'sadece-selam-arac-sorma',
    kaynak: 'Fatih Bey, 10 Ağustos: sadece selam verilince araç sorma, "nasıl yardımcı olabiliriz"',
    kisiAdi: 'Kerim',
    konusma: [{ rol: 'musteri', metin: 'Merhaba' }],
    kontroller: [
      {
        ad: 'araç marka/model sormadı',
        gec: (s) => !/marka|model|aracınız ne/i.test(s.metin),
        kanit: (s) => s.mesajlar.join(' / '),
      },
      {
        ad: 'açık uçlu karşıladı',
        gec: (s) => /yardımcı|nasıl|hangi konuda|buyrun/i.test(s.metin),
        kanit: (s) => s.mesajlar.join(' / '),
      },
      { ad: 'rakam vermedi', gec: (s) => !/\d{2}\.\d{3}/.test(s.metin) },
    ],
  },

  {
    ad: 'togg-paketi-sizmasin',
    kaynak: '10 Ağustos test ajanı: Kia sahibine Togg\'a özel ekstralar dahilmiş gibi sayıldı',
    konusma: [
      { rol: 'musteri', metin: 'Kia sportage komple ppf fiyatı nedir' },
      { rol: 'bot', metin: 'Komple mi düşünüyorsunuz?' },
      { rol: 'musteri', metin: 'Evet komple' },
    ],
    kontroller: [
      {
        ad: 'Togg\'a özel koltuk koruma sızmadı',
        gec: (s) => !s.metin.includes('koltuk koruma'),
        kanit: (s) => s.mesajlar.join(' / ').slice(0, 200),
      },
      {
        ad: 'obsidyen/Togg paketi geçmedi',
        gec: (s) => !s.metin.includes('obsid') && !s.metin.includes('togg'),
        kanit: (s) => s.mesajlar.join(' / ').slice(0, 200),
      },
    ],
  },

  {
    ad: 'sigorta-kasko-devir',
    kaynak: '10 Ağustos test ajanı: kasko/sigorta hakkında kaynaksız iddia üretti',
    konusma: [
      { rol: 'musteri', metin: 'PPF yaptırırsam kasko primim düşer mi, sigorta karşılıyor mu' },
    ],
    kontroller: [
      {
        ad: 'kasko/sigorta konusunda iddia uydurmadı',
        gec: (s) =>
          s.yapili.devir_gerekli_mi ||
          /emin değil|net bilgi|yetkili|görüşüp|dönüş yap/i.test(s.metin),
        kanit: (s) => s.mesajlar.join(' / ').slice(0, 220),
      },
    ],
  },

  {
    ad: 'cam-filmi-sirasi',
    kaynak: '10 Ağustos: cam filminde XPEL önce, Global sonra (PPF\'in tersi)',
    konusma: [
      { rol: 'musteri', metin: 'Toyota corolla sedan cam filmi fiyatı nedir' },
      { rol: 'bot', metin: 'Hangi camlar için düşünüyorsunuz?' },
      { rol: 'musteri', metin: 'Ön cam hariç 5 cam komple' },
    ],
    kontroller: [
      {
        ad: 'XPEL Global\'den önce geçti',
        gec: (s) => {
          const x = s.metin.indexOf('xpel')
          const g = s.metin.indexOf('global')
          return x === -1 || g === -1 || x < g
        },
        kanit: (s) => s.mesajlar.join(' / ').slice(0, 200),
      },
      bayraksiz,
    ],
  },

  {
    ad: 'aritmetik-yapma',
    kaynak: '10 Ağustos test ajanı: "cam filmi + PPF toplam 46.000₺" diye kendi topladı',
    konusma: [
      { rol: 'musteri', metin: 'Bmw 320i için ön 4 parça ppf ve 5 cam komple cam filmi istiyorum' },
      { rol: 'bot', metin: 'Tamamdır, ikisini de değerlendirelim.' },
      { rol: 'musteri', metin: 'İkisi birlikte ne kadar tutar' },
    ],
    kontroller: [
      {
        // Yasak olan TOPLAMAK, "toplam" kelimesini kullanmak değil. Eski kontrol
        // salt kelimeye bakıyordu ve "ayrı ayrı fiyatlanır, toplam vermiyoruz"
        // gibi DOĞRU cevapları düşürüyordu. Riskli olan: toplam sözcüğünün hemen
        // ardından bir rakam gelmesi. Uydurma rakamı zaten `bayraksiz` yakalıyor.
        ad: 'kendi topladığı tutarı söylemedi',
        gec: (s) => !/(toplam|toplamda|genel toplam|hepsi birlikte)[^.!?]{0,40}?\d{1,3}[.,]\d{3}/i.test(s.metin),
        kanit: (s) => s.mesajlar.join(' / ').slice(0, 220),
      },
      bayraksiz,
    ],
  },

  {
    ad: 'mat-kismi-yapilmiyor',
    kaynak: 'Fatih Bey, 11 Ağustos: "Mat kısmi yapılmıyor"',
    konusma: [
      { rol: 'musteri', metin: 'Bmw 320i kaputa mat ppf yaptırmak istiyorum fiyatı nedir' },
    ],
    kontroller: [
      {
        ad: 'kısmi mat için rakam uydurmadı',
        gec: (s) => !s.bayraklar.some((b) => b.tur === 'uydurma-fiyat'),
        kanit: (s) => s.bayraklar.find((b) => b.tur === 'uydurma-fiyat')?.aciklama ?? '',
      },
      {
        // Artık "devrederim" değil, net cevap: yapılmıyor.
        ad: 'kısmi mat yapılmadığını söyledi',
        gec: (s) =>
          /(sadece|yalnızca).{0,30}komple|komple.{0,30}(uyguluyoruz|yapıyoruz)|kısmi.{0,40}(yapmıyoruz|yapılmıyor|uygulamıyoruz|mümkün değil)/i.test(
            s.metin,
          ),
        kanit: (s) => s.mesajlar.join(' / ').slice(0, 240),
      },
    ],
  },

  {
    ad: 'aracsiz-fiyat-verilir',
    kaynak: 'Fatih Bey, 11 Ağustos: "standart fiyatlandırma" — araç sorulmadan fiyat verilir',
    kisiAdi: 'Okan',
    konusma: [{ rol: 'musteri', metin: 'Komple ppf fiyatı ne kadar' }],
    kontroller: [
      {
        ad: 'araç sormadan fiyatı verdi',
        gec: (s) => rakamVar(s, '100.000', '125.000', '75.000', '170.000', '190.000'),
        kanit: (s) => s.mesajlar.join(' / ').slice(0, 240),
      },
      {
        ad: 'fiyat yerine araç sorup geçiştirmedi',
        gec: (s) =>
          rakamVar(s, '100.000', '75.000') ||
          !/marka.{0,20}model|aracınız nedir/i.test(s.metin),
        kanit: (s) => s.mesajlar.join(' / ').slice(0, 240),
      },
    ],
  },

  // ── 11 Ağustos: Fatih Bey'in üçüncü tur testi ─────────────────────────────

  {
    ad: 'ilk-cevap-selam-isim',
    kaynak: 'Fatih Bey, 11 Ağustos: "tonunu ayarlayamadık, daha samimi iletebilir"',
    kisiAdi: 'Cemal',
    konusma: [{ rol: 'musteri', metin: 'Toyota corolla  sedan cam filmi için fiyat verebilirmisin' }],
    kontroller: [
      {
        ad: 'ilk mesajda selamladı',
        gec: (s) => SELAM.test(s.mesajlar[0] ?? ''),
        kanit: (s) => s.mesajlar[0] ?? '',
      },
      {
        ad: 'ilk mesajda adını kullandı',
        gec: (s) => (s.mesajlar[0] ?? '').toLocaleLowerCase('tr').includes('cemal'),
        kanit: (s) => s.mesajlar[0] ?? '',
      },
      {
        ad: 'kuru "Tamamdır" ile açmadı',
        gec: (s) => !/^tamamdır/i.test((s.mesajlar[0] ?? '').trim()),
        kanit: (s) => s.mesajlar[0] ?? '',
      },
      resmiDilYok,
    ],
  },

  {
    ad: 'fiyat-listesi-afallamasin',
    kaynak: 'Fatih Bey, 11 Ağustos: "en sonda afallıyor biraz"',
    kisiAdi: 'Furkan',
    konusma: [
      { rol: 'musteri', metin: 'Merhaba 2026 bmw g20 için komple ppf düşünüyorum' },
      { rol: 'bot', metin: 'Merhabalar Furkan bey, komple PPF için değerlendirelim.' },
      { rol: 'musteri', metin: 'Bayiden teslim almadım henüz ayın 15 inde teslim alacagım' },
      { rol: 'bot', metin: 'Tamamdır, teslim sonrası uygulama planlayabiliriz.' },
      { rol: 'musteri', metin: 'Fiyat araştırıyorum 3M , stek , endura bunlardanda fiyat topluyorum' },
    ],
    kontroller: [
      {
        ad: 'ürünleri sayıp fiyatsız bırakmadı',
        gec: (s) => rakamVar(s, '100.000', '125.000', '75.000', '170.000', '190.000'),
        kanit: (s) => s.mesajlar.join(' / ').slice(0, 220),
      },
    ],
  },

  {
    ad: 'liste-tekrarlamasin',
    kaynak: 'Fatih Bey, 11 Ağustos: "2 kere aynı cevabı verdi"',
    konusma: [
      { rol: 'musteri', metin: 'Merhaba bmw g30 için ppf kaplama düşünüyorum' },
      { rol: 'bot', metin: 'Merhabalar, komple mi kısmi mi düşünüyorsunuz?' },
      { rol: 'musteri', metin: 'Komple olsun' },
      {
        rol: 'bot',
        metin:
          'Komple kaplamada seçeneklerimiz:\n• XPEL Xtreme PPF – 5 yıl garanti: 100.000₺\n• XPEL EXO Armor – 7 yıl garanti: 125.000₺\n• XPEL Ultimate Plus – 10 yıl garanti: 170.000₺\n• XPEL Ultimate Fusion – 10 yıl garanti: 190.000₺\n• Global PPF – 5 yıl garanti: 75.000₺',
      },
      { rol: 'musteri', metin: 'Şu an kullanıyorum 7.000 km' },
    ],
    kontroller: [
      {
        ad: 'fiyat listesini baştan tekrarlamadı',
        gec: (s) =>
          ['100.000', '125.000', '170.000', '190.000', '75.000'].filter((r) =>
            s.metin.includes(r),
          ).length < 3,
        kanit: (s) => s.mesajlar.join(' / ').slice(0, 220),
      },
      {
        ad: 'konuşmayı ilerletti',
        gec: (s) => s.mesajlar.join(' ').trim().length > 0,
      },
    ],
  },

  {
    // ⭐ Fatih Bey'in 12 Ağustos şikâyetlerinin HEPSİNİ tek konuşmada sınar.
    // Tek tek geçmek yetmiyor: model bir turda selamlamayı, sonraki turda
    // araç sorusunu kaçırabilir. Bu vaka "hepsi AYNI ANDA tutuyor mu" sorusunu
    // cevaplar — kredi geldiğinde ilk koşulacak vaka budur.
    ad: 'fatih-12-agustos-tam-tur',
    kaynak: 'Fatih Bey 12 Ağustos: 5 şikâyetin tamamı, tek konuşmada',
    kisiAdi: 'Enis',
    konusma: [
      { rol: 'musteri', metin: 'T10F oltu mat ppf ve kromlar siyah kaplanacak' },
      {
        rol: 'bot',
        metin:
          'Merhabalar Enis bey, hoşgeldiniz 😊 T10F için mat PPF ve krom detayların siyaha dönüşümü çok şık duruyor.',
      },
      { rol: 'musteri', metin: 'Bmw G20 için de komple ppf fiyatı nedir' },
      {
        rol: 'bot',
        metin:
          'Komple PPF seçeneklerimiz:\nXPEL Xtreme – 100.000₺\n• 190 mikron, 5 yıl garanti\nGlobal PPF – 75.000₺\n• 190 mikron, 5 yıl garanti',
      },
      { rol: 'musteri', metin: 'Peki yarın için boşlugunuz var mı' },
    ],
    kontroller: [
      {
        ad: 'randevuda telefon istedi',
        gec: (s) => /numara|telefon/i.test(s.metin),
        kanit: (s) => s.mesajlar.join(' / ').slice(0, 180),
      },
      {
        ad: 'bildiği aracı tekrar sormadı',
        gec: (s) => !/marka.{0,15}model|aracınız(ın|ı)?\s*(ne|hangi|da|de)\b|model\s*yılı/i.test(s.metin),
        kanit: (s) => s.mesajlar.join(' / ').slice(0, 180),
      },
      {
        ad: 'mat kısıtlamasını tekrar etmedi',
        gec: (s) =>
          !/(yalnızca|sadece)[^.\n]{0,20}komple[^.\n]{0,30}(yapıl|uygulan)/i.test(s.metin),
        kanit: (s) => s.mesajlar.join(' / ').slice(0, 180),
      },
      {
        ad: 'kısmi seçenek sunmadı',
        gec: (s) =>
          !/(kaput|ön\s*3|ön\s*4)[^.\n]{0,70}(yönlendir|paylaş|sun|ilet)/i.test(s.metin),
        kanit: (s) => s.mesajlar.join(' / ').slice(0, 180),
      },
      {
        ad: 'fiyat listesini tekrarlamadı',
        gec: (s) => ['100.000', '75.000'].filter((r) => s.metin.includes(r)).length < 2,
        kanit: (s) => s.mesajlar.join(' / ').slice(0, 180),
      },
      {
        ad: 'konuşma ortasında selamlamadı',
        gec: (s) => !SELAM.test(s.mesajlar.join(' ')),
        kanit: (s) => s.mesajlar[0] ?? '',
      },
      resmiDilYok,
    ],
  },

  {
    ad: 'ton-insan-gibi',
    kaynak:
      'Fatih Bey, 12 Ağustos: "Tonlamaya bakar mısın, GPT\'de cidden karşısında bir insan var gibi"',
    kisiAdi: 'Furkan',
    konusma: [
      {
        rol: 'musteri',
        metin:
          'Aracım yarın bayiden çıkıyor komple ppf kapatmayı düşünüyorum fiyatlariniz ne durumda hangi ürünleri kullanıyorsunuz bilgi verir misiniz',
      },
    ],
    kontroller: [
      {
        // Kuru "Tamamdır, fiyat listemizi yönlendiriyorum." ile açmak yasak.
        ad: 'kuru kalıpla açmadı',
        gec: (s) =>
          !/^(tamamdır|tabi+|peki|olur)[^.!?]{0,70}(yönlendiriyorum|paylaşıyorum|ileteyim)[.!]?$/i.test(
            (s.mesajlar[0] ?? '').trim(),
          ),
        kanit: (s) => s.mesajlar[0] ?? '',
      },
      {
        // Müşteri "yarın bayiden çıkıyor" dedi — buna değinmeli.
        ad: 'müşterinin durumuna değindi (sıfır araç / zamanlama)',
        gec: (s) =>
          /hayırlı olsun|ideal zaman|sıfır|teslim alınır alınmaz|ilk kilometre|yeni aracınız/i.test(
            s.metin,
          ),
        kanit: (s) => s.mesajlar.slice(0, 2).join(' / ').slice(0, 200),
      },
      {
        ad: 'ürünleri özellikleriyle yazdı (çıplak liste değil)',
        gec: (s) => /mikron|tpu|self[- ]?healing|kendini onar/i.test(s.metin),
        kanit: (s) => s.mesajlar.join(' / ').slice(0, 200),
      },
      resmiDilYok,
    ],
  },

  {
    ad: 'gereksiz-mat-kisiti',
    kaynak: 'Fatih Bey, 12 Ağustos: "yalnızca mat ppf için komple yapıyoruz demesine gerek yok"',
    kisiAdi: 'Enis',
    konusma: [{ rol: 'musteri', metin: 'T10F oltu mat ppf ve kromlar siyah kaplanacak' }],
    kontroller: [
      {
        ad: 'mat kısıtlamasını kendiliğinden söylemedi',
        gec: (s) =>
          !/mat[^.\n]{0,40}(yalnızca|sadece)[^.\n]{0,20}komple|(yalnızca|sadece)[^.\n]{0,20}komple[^.\n]{0,30}(yapıl|uygulan)/i.test(
            s.metin,
          ),
        kanit: (s) => s.mesajlar.join(' / ').slice(0, 220),
      },
    ],
  },

  {
    ad: 'randevu-telefon-iste',
    kaynak: 'Fatih Bey, 12 Ağustos: "iletişim numarasını istesin, size hemen dönüş sağlıyoruz desin"',
    kisiAdi: 'Enis',
    konusma: [
      { rol: 'musteri', metin: 'Bmw G20 komple ppf fiyatı nedir' },
      { rol: 'bot', metin: 'Komple PPF seçeneklerimiz: XPEL Xtreme 100.000₺, Global PPF 75.000₺.' },
      { rol: 'musteri', metin: 'Peki yarın için boşlugunuz var mı' },
    ],
    kontroller: [
      {
        ad: 'iletişim numarası istedi',
        gec: (s) => /numara|telefon/i.test(s.metin),
        kanit: (s) => s.mesajlar.join(' / ').slice(0, 200),
      },
      {
        ad: 'dönüş sözü verdi',
        gec: (s) => /dönüş|geri döneriz|hemen döneriz|ulaşalım/i.test(s.metin),
        kanit: (s) => s.mesajlar.join(' / ').slice(0, 200),
      },
      {
        ad: 'bildiği aracı tekrar sormadı',
        gec: (s) => !/aracınızı da yaz|marka.{0,15}model|aracınız nedir/i.test(s.metin),
        kanit: (s) => s.mesajlar.join(' / ').slice(0, 200),
      },
    ],
  },

  {
    ad: 'kompleye-kismi-sunma',
    kaynak: 'Fatih Bey, 12 Ağustos: "komple olana 4 parça sunuyor"',
    kisiAdi: 'Enis',
    konusma: [
      { rol: 'musteri', metin: 'Bmw G20 komple ppf düşünüyorum' },
      {
        rol: 'bot',
        metin:
          'Komple kaplamada seçeneklerimiz:\n• XPEL Xtreme PPF – 5 yıl garanti: 100.000₺\n• Global PPF – 5 yıl garanti: 75.000₺',
      },
      { rol: 'musteri', metin: 'Global serisi için öneriniz nedir' },
    ],
    kontroller: [
      {
        ad: 'kısmi (kaput/ön3/ön4) seçenek sunmadı',
        gec: (s) =>
          !/(kaput|ön\s*3|ön\s*4)[^.\n]{0,60}(yönlendirebilir|paylaşabilir|sunabilir|iletebilir)/i.test(
            s.metin,
          ),
        kanit: (s) => s.mesajlar.join(' / ').slice(0, 220),
      },
    ],
  },

  {
    ad: 'fiyat-listesi-tek-mesaj',
    kaynak:
      'Fatih Bey, 11 Ağustos: "parça parça yazıyor, fiyat listesi bölümünü tek atsın"',
    kisiAdi: 'Okan',
    konusma: [{ rol: 'musteri', metin: 'Komple ppf fiyatı ne kadar' }],
    kontroller: [
      {
        // Her madde ayrı baloncuk hâlinde gidince WhatsApp'ta 5 mesaj oluyordu.
        ad: 'liste maddeleri ayrı baloncuklara bölünmedi',
        gec: (s) =>
          s.mesajlar.filter((m) => /^\s*(•|✅|▪|·|-|\*)\s*\S/.test(m) && !m.includes('\n'))
            .length === 0,
        kanit: (s) => `${s.mesajlar.length} baloncuk: ${s.mesajlar.join(' || ').slice(0, 200)}`,
      },
      {
        ad: 'fiyatlar tek baloncukta toplandı',
        gec: (s) => s.mesajlar.filter((m) => rakamVar({ ...s, metin: m }, '100.000')).length <= 1,
        kanit: (s) => s.mesajlar.join(' || ').slice(0, 200),
      },
    ],
  },

  {
    ad: 'istenmeyen-kalem-fiyati',
    kaynak:
      'Fatih Bey, 11 Ağustos: "5 cam diye belirtmiş, ayriyetten ön 2 cam filmi fiyatı vermesine gerek yok"',
    kisiAdi: 'Halim',
    konusma: [
      { rol: 'musteri', metin: 'Cam Filmi Kampanyanız hakkında bilgi alabilirmiyim' },
      {
        rol: 'bot',
        metin: 'Merhabalar Halim bey, hoşgeldiniz. Aracınızı ve kaç cam düşündüğünüzü yazar mısınız?',
      },
      { rol: 'musteri', metin: 'Ön hariç hepsi civic fc5 arka kelebeklerde var' },
    ],
    kontroller: [
      {
        // "ön 2 cam" zaten 5 cam kompleye dahil; ayrıca fiyatlamak yanlış bilgi.
        ad: 'ön 2 cam filmini ayrıca fiyatlamadı',
        gec: (s) => !s.mesajlar.some((m) => /ön\s*2\s*cam/i.test(m) && /4[.,]500/.test(m)),
        kanit: (s) => s.mesajlar.join(' / ').slice(0, 240),
      },
      {
        ad: 'istenen kapsamın fiyatlarını verdi',
        gec: (s) => rakamVar(s, '11.000', '10.000', '7.500'),
        kanit: (s) => s.mesajlar.join(' / ').slice(0, 200),
      },
    ],
  },

  {
    ad: 'cam-filmi-liste-tekrari',
    kaynak: 'Fatih Bey, 11 Ağustos: "burda gene sapıtıyor tekrar fiyat veriyor"',
    kisiAdi: 'Halim',
    konusma: [
      { rol: 'musteri', metin: 'Cam Filmi Kampanyanız hakkında bilgi alabilirmiyim' },
      { rol: 'bot', metin: 'Merhabalar Halim bey, hoşgeldiniz. Aracınız ve kaç cam?' },
      { rol: 'musteri', metin: 'Ön hariç hepsi civic fc5' },
      {
        rol: 'bot',
        metin:
          'Civic FC5 için ön cam hariç 5 cam komple:\n• XPEL HP Serisi: 11.000₺\n• Global QDP Ceramic: 10.000₺\n• Global HP Black: 7.500₺\nİsterseniz ön cam için de seçenekleri paylaşayım.',
      },
      { rol: 'musteri', metin: 'Ön cam istemiyorum' },
    ],
    kontroller: [
      {
        ad: 'aynı listeyi baştan tekrarlamadı',
        gec: (s) => ['11.000', '10.000', '7.500'].filter((r) => s.metin.includes(r)).length < 3,
        kanit: (s) => s.mesajlar.join(' / ').slice(0, 240),
      },
    ],
  },

  {
    ad: 'detayli-temizlik-dahil-degil',
    kaynak: 'Fatih Bey, 11 Ağustos: "Detaylı temizlik olmayacak"',
    kisiAdi: 'Samed',
    konusma: [
      { rol: 'musteri', metin: 'T10X ppf fiyatı verirmisin' },
      { rol: 'bot', metin: 'Merhabalar Samed bey, komple mi düşünüyorsunuz?' },
      { rol: 'musteri', metin: 'Komple' },
    ],
    kontroller: [
      {
        ad: 'detaylı temizliği pakete dahil saymadı',
        gec: (s) => !/detaylı temizlik/i.test(s.metin),
        kanit: (s) => s.mesajlar.join(' / ').slice(0, 240),
      },
    ],
  },
]

// ── Koşucu ──────────────────────────────────────────────────────────────────

type KontrolSonucu = { ad: string; gecen: number; kanitlar: string[] }

async function main() {
  const suzulmus = VAKA_FILTRE
    ? VAKALAR.filter((v) => v.ad.toLocaleLowerCase('tr').includes(VAKA_FILTRE))
    : VAKALAR

  // Tam koşu 20+ dakika sürüyor ve uzun süren işler ortamda kesilebiliyor;
  // dilimleyerek koşulunca kesilen parça baştan alınmaz.
  //   --atla=7 --adet=7   → 8-14. vakalar
  const secilen = suzulmus.slice(ATLA, ADET === null ? undefined : ATLA + ADET)

  if (secilen.length === 0) {
    console.error(`"${VAKA_FILTRE}" ile eşleşen vaka yok. Vakalar:`)
    for (const v of VAKALAR) console.error(`  - ${v.ad}`)
    process.exit(1)
  }

  const toplamCagri = secilen.length * TEKRAR
  console.log(`\nFatih Bey geri bildirim regresyon sınavı`)
  console.log(`${secilen.length} vaka × ${TEKRAR} tekrar = ${toplamCagri} konuşma turu`)
  console.log(`model: ${saglayici.ad} / ${saglayici.model}\n`)

  const kirilgan: { vaka: string; kontrol: string; gecen: number; kanit: string }[] = []
  const dusen: { vaka: string; kontrol: string; kanit: string }[] = []
  let toplamKontrol = 0
  let tamGecen = 0

  for (const vaka of secilen) {
    const sonuclar = new Map<string, KontrolSonucu>()
    for (const k of vaka.kontroller) {
      sonuclar.set(k.ad, { ad: k.ad, gecen: 0, kanitlar: [] })
    }

    let ornekCevap = ''
    for (let i = 0; i < TEKRAR; i += 1) {
      // ⚠ Tek koşunun patlaması TÜM sınavı düşürmemeli: 12 Ağustos'ta model
      // boş `mesajlar` döndürdü ve 27 vakalık koşu ilk vakada çöktü — para
      // yandı, sonuç alınamadı. Hata artık düşen kontrol olarak sayılıyor.
      let s: TurSonuc
      try {
        s = await tur(vaka.konusma, vaka.kisiAdi)
      } catch (e) {
        const mesaj = e instanceof Error ? e.message : 'bilinmeyen hata'
        console.log(`  ⚠ ${vaka.ad} koşu ${i + 1} HATA: ${mesaj}`)
        for (const k of vaka.kontroller) {
          const kayit = sonuclar.get(k.ad)
          if (kayit && !kayit.kanitlar.includes(`hata: ${mesaj}`)) {
            kayit.kanitlar.push(`hata: ${mesaj}`)
          }
        }
        continue
      }
      if (i === 0) ornekCevap = s.mesajlar.join(' / ').slice(0, 150)

      for (const k of vaka.kontroller) {
        const kayit = sonuclar.get(k.ad)
        if (!kayit) continue
        if (k.gec(s)) {
          kayit.gecen += 1
        } else {
          const kanit = k.kanit?.(s) ?? s.mesajlar.join(' / ').slice(0, 150)
          if (kanit && !kayit.kanitlar.includes(kanit)) kayit.kanitlar.push(kanit)
        }
      }
    }

    console.log(`${vaka.ad}`)
    console.log(`   ${vaka.kaynak}`)
    console.log(`   örnek: ${ornekCevap}`)

    for (const k of vaka.kontroller) {
      const r = sonuclar.get(k.ad)
      if (!r) continue
      toplamKontrol += 1
      const kanit = r.kanitlar[0] ?? ''
      if (r.gecen === TEKRAR) {
        tamGecen += 1
        console.log(`  ✓ ${r.ad} (${r.gecen}/${TEKRAR})`)
      } else if (r.gecen === 0) {
        dusen.push({ vaka: vaka.ad, kontrol: r.ad, kanit })
        console.log(`  ✗ ${r.ad} (0/${TEKRAR})${kanit ? ` — ${kanit}` : ''}`)
      } else {
        kirilgan.push({ vaka: vaka.ad, kontrol: r.ad, gecen: r.gecen, kanit })
        console.log(`  ⚠ ${r.ad} (${r.gecen}/${TEKRAR} KIRILGAN)${kanit ? ` — ${kanit}` : ''}`)
      }
    }
    console.log('')
  }

  console.log('─'.repeat(70))
  console.log(`${tamGecen}/${toplamKontrol} kontrol TÜM koşularda geçti`)

  if (kirilgan.length > 0) {
    console.log(`\n⚠ KIRILGAN (${kirilgan.length}) — bazen geçiyor, bazen düşüyor.`)
    console.log('  Bunlar en tehlikelileri: tek koşuluk sınav bunları "geçti" sanır,')
    console.log('  Fatih Bey ise er geç düşen koşuya denk gelir.')
    for (const k of kirilgan) {
      console.log(`  - ${k.vaka} / ${k.kontrol} (${k.gecen}/${TEKRAR})`)
      if (k.kanit) console.log(`      ${k.kanit}`)
    }
  }

  if (dusen.length > 0) {
    console.log(`\n✗ DÜŞEN (${dusen.length}) — hiçbir koşuda geçmedi:`)
    for (const d of dusen) {
      console.log(`  - ${d.vaka} / ${d.kontrol}`)
      if (d.kanit) console.log(`      ${d.kanit}`)
    }
  }

  if (kirilgan.length === 0 && dusen.length === 0) {
    console.log('\nFatih Bey\'in bildirdiği kusurların hiçbiri geri gelmedi.')
  }

  process.exit(kirilgan.length + dusen.length > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
