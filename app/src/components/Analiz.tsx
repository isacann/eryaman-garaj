// Botun yapılandırılmış çıktısını gösteren açılır kutu.
//
// Aynı bileşen iki yerde kullanılır: test konsolunda her bot cevabının altında,
// panelde bot mesajının altında. Cevabın nasıl doğduğu görünür olsun diye:
// niyet ne anlaşıldı, araç ve kapsam netleşti mi, fiyat verilebilir miydi,
// devir gerekiyor mu, güven ne.

import type { DevirSebebi, Kullanim, Niyet, YapiliCikti } from '@/lib/motor'

const NIYET_ETIKET: Record<Niyet, string> = {
  selam: 'Selam',
  'fiyat-genel': 'Genel fiyat sorusu',
  'fiyat-net': 'Net fiyat sorusu',
  'hizmet-bilgi': 'Hizmet bilgisi',
  randevu: 'Randevu',
  adres: 'Adres',
  sure: 'Süre',
  odeme: 'Ödeme',
  pazarlik: 'Pazarlık',
  sikayet: 'Şikâyet',
  'insan-istiyor': 'İnsan istiyor',
  takip: 'Takip',
  diger: 'Diğer',
}

const DEVIR_ETIKET: Record<DevirSebebi, string> = {
  'pazarlik-indirim': 'Pazarlık / indirim',
  'liste-disi-is': 'Listede olmayan iş',
  'coklu-arac': 'Birden fazla araç',
  sikayet: 'Şikâyet',
  'insan-istedi': 'İnsanla görüşmek istedi',
  'emin-degil': 'Bot emin değil',
}

const FIYAT_GORSEL_ETIKET: Record<string, string> = {
  ppf: 'PPF fiyat listesi',
  'cam-filmi': 'Cam filmi listesi',
  mikron: 'Mikron tablosu',
}

function Satir({ etiket, deger }: { etiket: string; deger: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-cizgi py-1.5 last:border-b-0">
      <dt className="shrink-0 text-[11px] text-metin-silik">{etiket}</dt>
      <dd className="text-right text-[12px]">{deger}</dd>
    </div>
  )
}

function Evet({ deger }: { deger: boolean }) {
  return (
    <span className={deger ? 'text-amber' : 'text-metin-soluk'}>{deger ? 'Evet' : 'Hayır'}</span>
  )
}

export default function Analiz({
  yapili,
  kullanim,
}: {
  yapili: YapiliCikti
  kullanim?: Kullanim | null
}) {
  return (
    <details className="mt-2 rounded-lg border border-cizgi bg-yuzey">
      <summary className="cursor-pointer list-none px-3 py-2 text-[11px] text-metin-soluk select-none hover:text-metin">
        Botun analizi · {NIYET_ETIKET[yapili.niyet] ?? yapili.niyet}
        {yapili.devir_gerekli_mi && <span className="text-amber"> · devir</span>}
      </summary>

      <dl className="px-3 pb-2">
        <Satir etiket="Niyet" deger={NIYET_ETIKET[yapili.niyet] ?? yapili.niyet} />
        <Satir etiket="Araç" deger={yapili.arac ?? '—'} />
        <Satir etiket="Kapsam" deger={yapili.kapsam ?? '—'} />
        <Satir etiket="Fiyat verilebilir mi" deger={<Evet deger={yapili.fiyat_verilebilir_mi} />} />
        <Satir etiket="Devir gerekli mi" deger={<Evet deger={yapili.devir_gerekli_mi} />} />
        <Satir
          etiket="Devir sebebi"
          deger={yapili.devir_sebebi ? (DEVIR_ETIKET[yapili.devir_sebebi] ?? yapili.devir_sebebi) : '—'}
        />
        <Satir etiket="Randevu talebi" deger={yapili.randevu_talebi ?? '—'} />
        <Satir
          etiket="Fiyat görseli"
          deger={
            yapili.fiyat_gorseli
              ? (FIYAT_GORSEL_ETIKET[yapili.fiyat_gorseli] ?? yapili.fiyat_gorseli)
              : '—'
          }
        />
        <Satir etiket="Fotoğraf notu" deger={yapili.gorsel_notu ?? '—'} />
        <Satir
          etiket="Güven"
          deger={
            <span className={yapili.guven < 0.5 ? 'text-amber' : undefined}>
              {yapili.guven.toFixed(2)}
            </span>
          }
        />
        {kullanim && (
          <Satir
            etiket="Model"
            deger={
              <span className="font-mono text-[11px] text-metin-silik">
                {kullanim.model} · {kullanim.girdiJeton}+{kullanim.ciktiJeton} jeton
              </span>
            }
          />
        )}
      </dl>
    </details>
  )
}
