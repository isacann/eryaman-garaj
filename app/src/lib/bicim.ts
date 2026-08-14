// Tarih ve metin biçimleme. Saat dilimi sabit: Europe/Istanbul.
// Sunucu ve tarayıcı aynı sonucu üretsin diye timeZone açıkça veriliyor.

const TZ = 'Europe/Istanbul'

const saatBicim = new Intl.DateTimeFormat('tr-TR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TZ,
})

const gunBicim = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'short',
  timeZone: TZ,
})

const tamBicim = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TZ,
})

function gunAnahtari(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d)
}

/** Bugünse saat, değilse gün. Liste satırları için. */
export function kisaZaman(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return gunAnahtari(d) === gunAnahtari(new Date()) ? saatBicim.format(d) : gunBicim.format(d)
}

export function saat(iso: string): string {
  return saatBicim.format(new Date(iso))
}

export function tamZaman(iso: string | null): string {
  if (!iso) return '—'
  return tamBicim.format(new Date(iso))
}

/** 24 saatlik Meta penceresinden kalan süre. Bittiyse null. */
export function pencereKalan(bitisIso: string | null): string | null {
  if (!bitisIso) return null
  const fark = new Date(bitisIso).getTime() - Date.now()
  if (fark <= 0) return null
  const saatler = Math.floor(fark / 3600_000)
  if (saatler >= 1) return `${saatler} sa`
  return `${Math.max(1, Math.floor(fark / 60_000))} dk`
}

export function kirp(metin: string | null, uzunluk = 68): string {
  if (!metin) return ''
  const tek = metin.replace(/\s+/g, ' ').trim()
  return tek.length > uzunluk ? `${tek.slice(0, uzunluk - 1)}…` : tek
}

/**
 * Test konsolu kimliğinin öneki (bkz. TEST_KIMLIK_ONEK, channels/test.ts).
 * Burada elle yazılı çünkü bu dosya tarayıcıda da çalışıyor, kanal modülü
 * sunucuya bağlı.
 */
const KONSOL_ONEK = 'konsol-'

export function kisiAdi(ad: string | null, kanalKimlik: string): string {
  const isim = ad?.trim()
  if (isim) return isim
  // Konsol oturumu bir uuid; listede ham haliyle durunca okunmuyor.
  if (kanalKimlik.startsWith(KONSOL_ONEK)) {
    return `Test konsolu ${kanalKimlik.slice(KONSOL_ONEK.length, KONSOL_ONEK.length + 4)}`
  }
  return kanalKimlik
}

export function basHarfler(isim: string): string {
  const parcalar = isim.trim().split(/\s+/).filter(Boolean)
  if (parcalar.length === 0) return '?'
  if (parcalar.length === 1) return parcalar[0]!.slice(0, 2).toUpperCase()
  return (parcalar[0]![0]! + parcalar[1]![0]!).toUpperCase()
}
