'use server'

import { revalidatePath } from 'next/cache'
import { randevuHatirlatmasiPlanla } from '@/lib/takip'
import { supabaseServis, supabaseSunucu } from '@/lib/supabase/sunucu'
import type { Json } from '@/lib/db/types'

export type RandevuSonucu = { tamam: boolean; mesaj: string }

async function oturumVarMi(): Promise<boolean> {
  const db = await supabaseSunucu()
  const {
    data: { user },
  } = await db.auth.getUser()
  return Boolean(user)
}

/**
 * Randevu saatini elle düzeltir ve hatırlatmayı yeni zamana taşır.
 *
 * Neden gerekli: bot "cumartesi öğleden sonra" gibi bir ifadeyi 14:00'e
 * çeviriyor, ama gerçek saat ekiple konuşulup değişebiliyor. Hatırlatma bu
 * alana bağlı olduğu için düzeltme aynı anda kuyruğa da işlenmeli — yoksa
 * müşteriye eski saat hatırlatılır.
 *
 * `yerelZaman` biçimi datetime-local çıktısı: "2026-08-20T14:00".
 * Türkiye saati varsayılıyor (sabit UTC+3, yaz saati yok).
 */
export async function randevuZamaniGuncelle(
  talepId: string,
  yerelZaman: string,
): Promise<RandevuSonucu> {
  if (!(await oturumVarMi())) return { tamam: false, mesaj: 'Oturum yok.' }

  const kalip = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(yerelZaman.trim())
  if (!kalip) return { tamam: false, mesaj: 'Tarih biçimi okunamadı.' }

  const an = new Date(`${kalip[1]}-${kalip[2]}-${kalip[3]}T${kalip[4]}:${kalip[5]}:00+03:00`)
  if (Number.isNaN(an.getTime())) return { tamam: false, mesaj: 'Geçersiz tarih.' }

  const db = supabaseServis()
  const { data: talep, error } = await db
    .from('appointment_requests')
    .update({ randevu_at: an.toISOString(), durum: 'onaylandi' })
    .eq('id', talepId)
    .select('conversation_id')
    .maybeSingle()

  if (error || !talep) {
    return { tamam: false, mesaj: `Kaydedilemedi: ${error?.message ?? 'talep bulunamadı'}` }
  }

  // Hatırlatma yeni zamana göre yeniden kurulur. Geçmişe ya da 24 saatten
  // yakına alındıysa planlayıcı kendisi kurmuyor — sessizce doğru davranış.
  await randevuHatirlatmasiPlanla(talep.conversation_id, an.toISOString())

  await db.from('activity_log').insert({
    aktor: 'ekip',
    tip: 'randevu_guncellendi',
    payload: { talep_id: talepId, randevu_at: an.toISOString() } as Json,
  })

  revalidatePath('/randevular')
  return { tamam: true, mesaj: 'Randevu güncellendi, hatırlatma yeni saate taşındı.' }
}

/**
 * Randevuyu iptal eder ve bekleyen hatırlatmayı düşürür.
 * İptal edilen randevu için "yarın görüşüyoruz" mesajı gitmesi en kötü sonuç.
 */
export async function randevuIptalEt(talepId: string): Promise<RandevuSonucu> {
  if (!(await oturumVarMi())) return { tamam: false, mesaj: 'Oturum yok.' }

  const db = supabaseServis()
  const { data: talep, error } = await db
    .from('appointment_requests')
    .update({ durum: 'iptal' })
    .eq('id', talepId)
    .select('conversation_id')
    .maybeSingle()

  if (error || !talep) {
    return { tamam: false, mesaj: `İptal edilemedi: ${error?.message ?? 'talep bulunamadı'}` }
  }

  await randevuHatirlatmasiPlanla(talep.conversation_id, null)

  await db.from('activity_log').insert({
    aktor: 'ekip',
    tip: 'randevu_iptal',
    payload: { talep_id: talepId } as Json,
  })

  revalidatePath('/randevular')
  return { tamam: true, mesaj: 'Randevu iptal edildi, hatırlatma gönderilmeyecek.' }
}
