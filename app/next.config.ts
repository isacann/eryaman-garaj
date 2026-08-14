import path from 'node:path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Üst dizinlerdeki lockfile'lar kök sanılmasın diye kökü açıkça veriyoruz.
  outputFileTracingRoot: path.join(__dirname),

  experimental: {
    // Test konsolundan araç fotoğrafı geliyor. Fotoğraf tarayıcıda küçültülüyor
    // ama varsayılan 1 MB sınırı yoğun bir karede yetmeyebiliyor.
    serverActions: { bodySizeLimit: '3mb' },
  },

  // Botun fiyat kaynağı bir markdown dosyası, kod değil. Next bunu izlerken
  // göremez; sunucusuz pakete elle koyuluyor. Kopyayı prebuild üretiyor
  // (scripts/fiyat-esitle.mjs), kaynağı hâlâ ../FIYAT-LISTESI.md.
  outputFileTracingIncludes: {
    '/**': ['./FIYAT-LISTESI.md'],
  },
}

export default nextConfig
