// Hata kaydı — Vercel'in kendi logu yerine Supabase'e.
//
// NEDEN: Vercel Hobby planında çalışma zamanı logları ~1 saat sonra siliniyor.
// Fatih Bey "bot dün akşam cevap vermemiş" dediğinde bakacak yerimiz kalmıyordu.
// Buradaki kayıt activity_log'da 60 gün yaşıyor (eski_verileri_temizle onu
// 2 ayda bir süpürüyor), panelden ve SQL'den okunabiliyor.
//
// ⚠ KURAL: bu fonksiyon ASLA hata fırlatmaz. Log yazamamak yüzünden müşteriye
// cevap gitmemesi, logsuz kalmaktan çok daha kötü. Her şey yutulur.
//
// ⚠ Sır yazmayın. payload panelde görünür; jeton/anahtar buraya girmemeli.

import { supabaseServis } from '@/lib/supabase/sunucu'

/** Hata metnini tipten bağımsız okunur hale getirir. */
function okunurHata(deger: unknown): string {
  if (deger instanceof Error) return deger.message
  if (typeof deger === 'string') return deger
  try {
    return JSON.stringify(deger)
  } catch {
    return String(deger)
  }
}

/**
 * Bir hatayı hem konsola hem activity_log'a yazar.
 *
 * @param kaynak Nerede oldu — `wa-webhook`, `bot`, `motor` gibi kısa etiket.
 * @param mesaj  Ne oldu, insan diliyle.
 * @param ayrinti Hata nesnesi ya da ek bağlam. Sır içermemeli.
 */
export async function hataKaydet(
  kaynak: string,
  mesaj: string,
  ayrinti?: unknown,
  konusmaId?: string | null,
): Promise<void> {
  // Konsol yine de yazılır: yerel geliştirmede ve ilk 1 saat içinde en hızlı yol.
  console.error(`[${kaynak}] ${mesaj}`, ayrinti ?? '')

  try {
    const db = supabaseServis()
    await db.from('activity_log').insert({
      aktor: 'sistem',
      tip: 'hata',
      payload: {
        kaynak,
        mesaj,
        ...(ayrinti === undefined ? {} : { ayrinti: okunurHata(ayrinti).slice(0, 2000) }),
        ...(konusmaId ? { konusmaId } : {}),
      },
    })
  } catch {
    // Veritabanı da erişilemiyorsa yapacak bir şey yok; konsola zaten yazıldı.
  }
}
