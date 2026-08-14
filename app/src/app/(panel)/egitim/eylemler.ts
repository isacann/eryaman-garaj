'use server'

import { revalidatePath } from 'next/cache'

import { supabaseServis, supabaseSunucu } from '@/lib/supabase/sunucu'
import type { BotEgitim, EgitimTuru } from '@/lib/db/types'

export type EgitimSonucu = { tamam: boolean; mesaj: string }

/**
 * Tek kayıt için üst sınır.
 *
 * Fatih Bey'in bir dokümanı olduğu gibi yapıştırması beklenen kullanım; ama
 * sınırsız bırakmak her mesajın maliyetini büyütür ve uzun promptta model
 * kuralları kaçırmaya başlar. 4.000 karakter ~2-3 sayfa metin.
 */
const EN_FAZLA_KARAKTER = 4_000

const TURLER: EgitimTuru[] = ['bilgi', 'davranis', 'reklam']

async function oturumVarMi(): Promise<boolean> {
  const db = await supabaseSunucu()
  const {
    data: { user },
  } = await db.auth.getUser()
  return Boolean(user)
}

function yenile(): void {
  revalidatePath('/egitim')
}

export async function egitimEkle(girdi: {
  tur: string
  baslik: string
  icerik: string
  anahtar?: string | null
  gecerliBitis?: string | null
}): Promise<EgitimSonucu> {
  if (!(await oturumVarMi())) return { tamam: false, mesaj: 'Oturum yok.' }

  const tur = girdi.tur as EgitimTuru
  if (!TURLER.includes(tur)) return { tamam: false, mesaj: 'Geçersiz tür.' }

  const baslik = girdi.baslik.trim()
  const icerik = girdi.icerik.trim()
  const anahtar = girdi.anahtar?.trim() || null

  if (!baslik) return { tamam: false, mesaj: 'Başlık boş olamaz.' }
  if (!icerik) return { tamam: false, mesaj: 'İçerik boş olamaz.' }
  if (icerik.length > EN_FAZLA_KARAKTER) {
    return {
      tamam: false,
      mesaj: `İçerik çok uzun (${icerik.length} karakter). En fazla ${EN_FAZLA_KARAKTER} karakter — uzun metni parçalara bölerek ekleyin.`,
    }
  }
  // Reklam kaydı anahtarsız işe yaramaz: hangi reklamdan gelene anlatılacağı
  // belli olmaz ve kampanya hiçbir konuşmada görünmez.
  if (tur === 'reklam' && !anahtar) {
    return {
      tamam: false,
      mesaj: 'Reklam kampanyası için eşleşme anahtarı gerekli (reklam kimliği ya da başlıkta geçen kelime).',
    }
  }

  const gecerliBitis = girdi.gecerliBitis?.trim() || null
  if (gecerliBitis && !/^\d{4}-\d{2}-\d{2}$/.test(gecerliBitis)) {
    return { tamam: false, mesaj: 'Tarih biçimi hatalı.' }
  }

  const db = supabaseServis()
  const { error } = await db
    .from('bot_egitim')
    .insert({ tur, baslik, icerik, anahtar, gecerli_bitis: gecerliBitis })
  if (error) return { tamam: false, mesaj: `Kaydedilemedi: ${error.message}` }

  yenile()
  return {
    tamam: true,
    mesaj: gecerliBitis
      ? `Eklendi. Bot ${gecerliBitis} tarihine kadar bu kampanyayı anlatacak, sonra kendiliğinden bırakacak.`
      : 'Eklendi. Bot bundan sonraki cevaplarında kullanacak.',
  }
}

export async function egitimDurumDegistir(
  id: string,
  aktif: boolean,
): Promise<EgitimSonucu> {
  if (!(await oturumVarMi())) return { tamam: false, mesaj: 'Oturum yok.' }

  const db = supabaseServis()
  const { error } = await db.from('bot_egitim').update({ aktif }).eq('id', id)
  if (error) return { tamam: false, mesaj: `Güncellenemedi: ${error.message}` }

  yenile()
  return { tamam: true, mesaj: aktif ? 'Yeniden açıldı.' : 'Kapatıldı, bot artık kullanmayacak.' }
}

export async function egitimSil(id: string): Promise<EgitimSonucu> {
  if (!(await oturumVarMi())) return { tamam: false, mesaj: 'Oturum yok.' }

  const db = supabaseServis()
  const { error } = await db.from('bot_egitim').delete().eq('id', id)
  if (error) return { tamam: false, mesaj: `Silinemedi: ${error.message}` }

  yenile()
  return { tamam: true, mesaj: 'Silindi.' }
}

/** Sayfanın listesi. Tablo yoksa boş döner — panel yine açılsın. */
export async function egitimListesi(): Promise<BotEgitim[]> {
  const db = supabaseServis()
  const { data, error } = await db
    .from('bot_egitim')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.warn('[egitim] liste okunamadı:', error.message)
    return []
  }
  return data ?? []
}
