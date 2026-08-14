'use server'

// Devir akışı (KAPSAM karar 4).
//
// Ekip panelden bir cevap yazdığı anda konuşma devre geçer ve BOT SUSAR.
// Susma kararı insanın: botun kendi "devir gerekli" bayrağı sadece işaret
// düşürür, konuşmayı kapatmaz (bkz. src/lib/bot.ts).
//
// 15 dakika kuralı (KAPSAM karar 4) devir_at damgasından sayılır ve cron
// tarafından işletilir (bkz. src/app/api/cron/route.ts). Ekip buradan yazdığı
// anda kural gereksizleşir: sayaç temizlenir, bekleyen takipler iptal edilir.

import { revalidatePath } from 'next/cache'
import { panelAdresi } from '@/lib/env'
import { gorselAdresi, gorselBul } from '@/lib/fiyat-gorselleri'
import { gidenMedyaGonder, gidenMesajGonder } from '@/lib/mesajlar'
import { supabaseServis, supabaseSunucu } from '@/lib/supabase/sunucu'
import { takipleriIptalEt } from '@/lib/takip'
import type { Json } from '@/lib/db/types'

/** Konuşma meta'sından 15 dk kuralının sayaçlarını siler. */
async function devirSayaclariniTemizle(konusmaId: string): Promise<void> {
  const db = supabaseServis()
  const { data } = await db
    .from('conversations')
    .select('meta')
    .eq('id', konusmaId)
    .maybeSingle()

  const meta = (data?.meta ?? {}) as Record<string, unknown>
  if (!meta.devir_bayrak_at && !meta.devir_hatirlatma_at) return

  const kalan = { ...meta }
  delete kalan.devir_bayrak_at
  delete kalan.devir_hatirlatma_at
  await db.from('conversations').update({ meta: kalan as Json }).eq('id', konusmaId)
}

export type EylemSonucu = { tamam: boolean; mesaj: string }

async function oturumVarMi(): Promise<boolean> {
  const db = await supabaseSunucu()
  const {
    data: { user },
  } = await db.auth.getUser()
  return Boolean(user)
}

/** Ekip cevabı: konuşma devre geçer, mesaj "ekip" imzasıyla gider. */
export async function ekipCevapGonder(
  konusmaId: string,
  metin: string,
): Promise<EylemSonucu> {
  if (!(await oturumVarMi())) return { tamam: false, mesaj: 'Oturum yok.' }

  const yazi = metin.trim()
  if (!yazi) return { tamam: false, mesaj: 'Boş mesaj gönderilmez.' }

  const db = supabaseServis()
  const { data: konusma } = await db
    .from('conversations')
    .select('id, durum, devir_at')
    .eq('id', konusmaId)
    .maybeSingle()
  if (!konusma) return { tamam: false, mesaj: 'Yazışma bulunamadı.' }

  // Devir damgası ilk devralmada atılır, sonraki mesajlarda tazelenmez.
  if (konusma.durum !== 'devir') {
    await db
      .from('conversations')
      .update({ durum: 'devir', devir_at: new Date().toISOString() })
      .eq('id', konusmaId)

    await db.from('activity_log').insert({
      aktor: 'ekip',
      tip: 'devir',
      payload: { konusma_id: konusmaId } as Json,
    })
  }

  try {
    await gidenMesajGonder(konusmaId, yazi, 'ekip')
  } catch (e) {
    return { tamam: false, mesaj: e instanceof Error ? e.message : 'Mesaj gönderilemedi.' }
  }

  // Ekip devraldı: bot ne takip yazar ne de "birazdan dönecek" der.
  await Promise.all([
    takipleriIptalEt(konusmaId, 'ekip-devraldi'),
    devirSayaclariniTemizle(konusmaId),
  ])

  revalidatePath(`/sohbet/${konusmaId}`)
  revalidatePath('/')
  return { tamam: true, mesaj: 'Gönderildi.' }
}

/**
 * Fiyat listesi görselini gönderir. Ekip eylemi — bot bunu kendiliğinden
 * yapmaz (bkz. src/lib/fiyat-gorselleri.ts, "fiyatla açma yasağı").
 *
 * Görsel göndermek de bir cevaptır: yazışma devre geçer, bot susar.
 */
export async function fiyatGorseliGonder(
  konusmaId: string,
  anahtar: string,
): Promise<EylemSonucu> {
  if (!(await oturumVarMi())) return { tamam: false, mesaj: 'Oturum yok.' }

  const gorsel = gorselBul(anahtar)
  if (!gorsel) return { tamam: false, mesaj: 'Görsel bulunamadı.' }

  const adres = gorselAdresi(gorsel.dosya, panelAdresi())
  if (!adres.startsWith('https://')) {
    return {
      tamam: false,
      mesaj:
        'Görsel adresi https değil. Meta görseli ancak herkese açık https adresinden çeker.',
    }
  }

  const db = supabaseServis()
  const { data: konusma } = await db
    .from('conversations')
    .select('id, durum')
    .eq('id', konusmaId)
    .maybeSingle()
  if (!konusma) return { tamam: false, mesaj: 'Yazışma bulunamadı.' }

  if (konusma.durum !== 'devir') {
    await db
      .from('conversations')
      .update({ durum: 'devir', devir_at: new Date().toISOString() })
      .eq('id', konusmaId)
  }

  try {
    await gidenMedyaGonder(konusmaId, adres, gorsel.altYazi, 'ekip')
  } catch (e) {
    return { tamam: false, mesaj: e instanceof Error ? e.message : 'Görsel gönderilemedi.' }
  }

  await Promise.all([
    takipleriIptalEt(konusmaId, 'ekip-devraldi'),
    devirSayaclariniTemizle(konusmaId),
  ])

  revalidatePath(`/sohbet/${konusmaId}`)
  revalidatePath('/')
  return { tamam: true, mesaj: `${gorsel.ad} gönderildi.` }
}

/** Konuşmayı bota geri verir; bot bir sonraki müşteri mesajından itibaren yazar. */
export async function botaGeriVer(konusmaId: string): Promise<EylemSonucu> {
  if (!(await oturumVarMi())) return { tamam: false, mesaj: 'Oturum yok.' }

  const db = supabaseServis()
  const { error } = await db
    .from('conversations')
    .update({ durum: 'bot', devir_at: null })
    .eq('id', konusmaId)
  if (error) return { tamam: false, mesaj: `Değiştirilemedi: ${error.message}` }

  await devirSayaclariniTemizle(konusmaId)

  await db.from('activity_log').insert({
    aktor: 'ekip',
    tip: 'bota_geri_verildi',
    payload: { konusma_id: konusmaId } as Json,
  })

  revalidatePath(`/sohbet/${konusmaId}`)
  revalidatePath('/')
  return { tamam: true, mesaj: 'Bot devraldı.' }
}
