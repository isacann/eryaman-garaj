'use server'

import { revalidatePath } from 'next/cache'
import { sonChatIdYakala, telegramGonder } from '@/lib/bildirim'
import { telegramJetonu } from '@/lib/env'
import { supabaseServis, supabaseSunucu } from '@/lib/supabase/sunucu'
import type { Json } from '@/lib/db/types'

export type AyarSonucu = { tamam: boolean; mesaj: string }

async function oturumVarMi(): Promise<boolean> {
  const db = await supabaseSunucu()
  const {
    data: { user },
  } = await db.auth.getUser()
  return Boolean(user)
}

/**
 * Telegram bağlantısını kurar: bota en son kim yazdıysa onun sohbet kimliğini
 * alıp ayarlara yazar.
 *
 * Kurulum akışı (KAPSAM Bölüm 7): Fatih Bey bota /start yazar, buraya basar.
 * Kimliği elle sorup yazdırmaktan çok daha az hata yapılan yol.
 */
export async function telegramBagla(): Promise<AyarSonucu> {
  if (!(await oturumVarMi())) return { tamam: false, mesaj: 'Oturum yok.' }

  if (!telegramJetonu()) {
    return {
      tamam: false,
      mesaj: 'Telegram bot jetonu tanımlı değil. Kurulumu Operiqo yapar.',
    }
  }

  const yakalanan = await sonChatIdYakala()
  if (!yakalanan.basarili) return { tamam: false, mesaj: yakalanan.hata }

  const db = supabaseServis()
  const { error } = await db
    .from('settings')
    .update({ telegram_chat_id: yakalanan.chatId, telegram_aktif: true })
    .eq('id', 1)
  if (error) return { tamam: false, mesaj: `Kaydedilemedi: ${error.message}` }

  await db.from('activity_log').insert({
    aktor: 'ekip',
    tip: 'telegram_baglandi',
    payload: { ad: yakalanan.ad } as Json,
  })

  revalidatePath('/ayarlar')
  return {
    tamam: true,
    mesaj: `Bağlandı: ${yakalanan.ad ?? yakalanan.chatId}. Test mesajı gönderip doğrulayın.`,
  }
}

/** Bildirimlerin gerçekten ulaştığını kanıtlar. */
export async function telegramTest(): Promise<AyarSonucu> {
  if (!(await oturumVarMi())) return { tamam: false, mesaj: 'Oturum yok.' }

  const db = supabaseServis()
  const { data } = await db
    .from('settings')
    .select('telegram_chat_id')
    .eq('id', 1)
    .maybeSingle()

  const chatId = data?.telegram_chat_id?.trim()
  if (!chatId) return { tamam: false, mesaj: 'Önce Telegram bağlantısını kurun.' }

  const sonuc = await telegramGonder(
    chatId,
    '✅ <b>Eryaman Garaj paneli</b>\n\nBildirimler çalışıyor. Randevu talebi, devir ve sıcak müşteri haberleri buraya düşecek.',
  )

  if (!sonuc.basarili) return { tamam: false, mesaj: `Gönderilemedi: ${sonuc.hata}` }
  return { tamam: true, mesaj: 'Test mesajı gönderildi, Telegram\'ı kontrol edin.' }
}

export async function ayarlariKaydet(
  _oncekiDurum: AyarSonucu | null,
  form: FormData,
): Promise<AyarSonucu> {
  const db = await supabaseSunucu()

  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return { tamam: false, mesaj: 'Oturum yok.' }

  const baslangic = String(form.get('baslangic') ?? '')
  const bitis = String(form.get('bitis') ?? '')
  const saatDeseni = /^\d{2}:\d{2}$/
  if (!saatDeseni.test(baslangic) || !saatDeseni.test(bitis)) {
    return { tamam: false, mesaj: 'Saat biçimi geçersiz.' }
  }

  const { error } = await db
    .from('settings')
    .update({
      calisma_saati_baslangic: baslangic,
      calisma_saati_bitis: bitis,
      bot_aktif: form.get('bot_aktif') === 'on',
      takip_aktif: form.get('takip_aktif') === 'on',
      sablon_takip_aktif: form.get('sablon_takip_aktif') === 'on',
      telegram_aktif: form.get('telegram_aktif') === 'on',
    })
    .eq('id', 1)

  if (error) return { tamam: false, mesaj: `Kaydedilemedi: ${error.message}` }

  await db.from('activity_log').insert({
    aktor: 'ekip',
    tip: 'ayar_degisti',
    payload: { baslangic, bitis },
  })

  revalidatePath('/ayarlar')
  return { tamam: true, mesaj: 'Kaydedildi.' }
}
