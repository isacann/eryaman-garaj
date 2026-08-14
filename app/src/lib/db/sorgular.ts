// Panelin okuma sorguları. Oturumlu istemciyle çalışır, RLS geçerlidir.
// Join yerine ayrı sorgu + bellekte eşleme: tipler elle yazıldığı için daha güvenli.

import 'server-only'

import { supabaseSunucu } from '@/lib/supabase/sunucu'
import type {
  AppointmentRequest,
  Contact,
  Conversation,
  Message,
  Settings,
} from './types'

/**
 * Liste satırında mesajın tamamı gerekmiyor. medya_url'i dışarıda bırakıyoruz:
 * test konsolundan gelen fotoğraflar orada gömülü veri (data:) olarak duruyor,
 * yüz satırlık listeyi boşuna megabaytlarca şişirmesin.
 */
export type SonMesaj = Pick<Message, 'id' | 'conversation_id' | 'metin' | 'created_at'>

export type KonusmaSatiri = {
  konusma: Conversation
  kisi: Contact | null
  sonMesaj: SonMesaj | null
}

export async function konusmalariGetir(limit = 100): Promise<KonusmaSatiri[]> {
  const db = await supabaseSunucu()

  const { data: konusmalar, error } = await db
    .from('conversations')
    .select('*')
    .order('son_mesaj_at', { ascending: false, nullsFirst: false })
    .limit(limit)
  if (error) throw new Error(`konuşmalar okunamadı: ${error.message}`)
  if (!konusmalar || konusmalar.length === 0) return []

  const kisiIdleri = [...new Set(konusmalar.map((k) => k.contact_id))]
  const konusmaIdleri = konusmalar.map((k) => k.id)

  const [{ data: kisiler }, { data: mesajlar }] = await Promise.all([
    db.from('contacts').select('*').in('id', kisiIdleri),
    db
      .from('messages')
      .select('id, conversation_id, metin, created_at')
      .in('conversation_id', konusmaIdleri)
      .order('created_at', { ascending: false })
      .limit(500),
  ])

  const kisiHarita = new Map((kisiler ?? []).map((k) => [k.id, k]))
  const sonMesajHarita = new Map<string, SonMesaj>()
  for (const m of mesajlar ?? []) {
    if (!sonMesajHarita.has(m.conversation_id)) sonMesajHarita.set(m.conversation_id, m)
  }

  return konusmalar.map((konusma) => ({
    konusma,
    kisi: kisiHarita.get(konusma.contact_id) ?? null,
    sonMesaj: sonMesajHarita.get(konusma.id) ?? null,
  }))
}

export async function konusmaGetir(
  id: string,
): Promise<{ konusma: Conversation; kisi: Contact | null; mesajlar: Message[] } | null> {
  const db = await supabaseSunucu()

  const { data: konusma } = await db.from('conversations').select('*').eq('id', id).maybeSingle()
  if (!konusma) return null

  const [{ data: kisi }, { data: mesajlar }] = await Promise.all([
    db.from('contacts').select('*').eq('id', konusma.contact_id).maybeSingle(),
    db
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true }),
  ])

  return { konusma, kisi: kisi ?? null, mesajlar: mesajlar ?? [] }
}

export type RandevuSatiri = {
  talep: AppointmentRequest
  kisi: Contact | null
  konusma: Conversation | null
}

export async function randevulariGetir(): Promise<RandevuSatiri[]> {
  const db = await supabaseSunucu()

  const { data: talepler, error } = await db
    .from('appointment_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw new Error(`randevu talepleri okunamadı: ${error.message}`)
  if (!talepler || talepler.length === 0) return []

  const { data: konusmalar } = await db
    .from('conversations')
    .select('*')
    .in('id', [...new Set(talepler.map((t) => t.conversation_id))])

  const kisiIdleri = [...new Set((konusmalar ?? []).map((k) => k.contact_id))]
  const { data: kisiler } = kisiIdleri.length
    ? await db.from('contacts').select('*').in('id', kisiIdleri)
    : { data: [] }

  const konusmaHarita = new Map((konusmalar ?? []).map((k) => [k.id, k]))
  const kisiHarita = new Map((kisiler ?? []).map((k) => [k.id, k]))

  return talepler.map((talep) => {
    const konusma = konusmaHarita.get(talep.conversation_id) ?? null
    return {
      talep,
      konusma,
      kisi: konusma ? (kisiHarita.get(konusma.contact_id) ?? null) : null,
    }
  })
}

export async function ayarlariGetir(): Promise<Settings | null> {
  const db = await supabaseSunucu()
  const { data } = await db.from('settings').select('*').eq('id', 1).maybeSingle()
  return data ?? null
}
