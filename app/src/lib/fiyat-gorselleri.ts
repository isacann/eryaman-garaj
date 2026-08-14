// Fiyat listesi görselleri.
//
// Arşivde işletmenin en sık davranışlarından biri "Fiyat listemizi
// yönlendiriyorum" (39 kez) ve gönderilen şey bu görsellerden biri.
//
// Dosyalar kaynakta ../fiyat-listesi/ altında durur; derleme öncesi
// scripts/fiyat-esitle.mjs bunları public/fiyat-listesi/ altına kopyalar,
// çünkü Meta görseli herkese açık bir https adresinden çekiyor.
//
// NOT: Bu görselleri şimdilik yalnızca EKİP gönderir, bot kendiliğinden
// göndermez. Sebep, KAPSAM karar 2: "fiyatla açma YASAK". Görselde bütün
// rakamlar var; botun onu yanlış anda göndermesi bu yasağı doğrudan deler ve
// metin denetimi (motor/denetim.ts) görsel gönderimini yakalayamaz. Botun
// otomatik göndermesi ayrı bir kapsam kararı ister.

export type FiyatGorseli = {
  anahtar: string
  ad: string
  dosya: string
  /** Görselle birlikte giden kısa açıklama. */
  altYazi: string
}

export const FIYAT_GORSELLERI: FiyatGorseli[] = [
  {
    anahtar: 'ppf',
    ad: 'PPF fiyat listesi',
    dosya: 'ppf-genel.png',
    altYazi: 'Fiyat listemizi yönlendiriyorum.',
  },
  {
    anahtar: 'cam-filmi',
    ad: 'Cam filmi fiyat listesi',
    dosya: 'cam-filmi.png',
    altYazi: 'Cam filmi fiyat listemizi yönlendiriyorum.',
  },
  {
    anahtar: 'mikron',
    ad: 'Mikron tablosu',
    dosya: 'ppf-mikron-tablosu.png',
    altYazi: 'Ürünlerimizin kalınlık ve garanti tablosu.',
  },
]

export function gorselBul(anahtar: string): FiyatGorseli | null {
  return FIYAT_GORSELLERI.find((g) => g.anahtar === anahtar) ?? null
}

/** Görselin herkese açık adresi. Meta bu adresten çekecek. */
export function gorselAdresi(dosya: string, panelKok: string): string {
  return `${panelKok.replace(/\/+$/, '')}/fiyat-listesi/${dosya}`
}
