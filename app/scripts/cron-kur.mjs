// Supabase pg_cron ile /api/cron rotasını 5 dakikada bir tetikler.
// Çalıştır: npm run cron:kur
//
// NEDEN BURADA: Vercel Hobby planında cron günde yalnızca bir kez çalışabiliyor,
// daha sık bir ifade dağıtımı hata veriyor. Takip merdiveni (3. saat) ve 15
// dakika devir kuralı günde tek tetiklemeyle işlemez. Supabase zaten altyapımız,
// pg_cron ücretsiz katmanda mevcut.
//
// Durumu görmek için:  npm run cron:kur -- --durum
// Kaldırmak için:      npm run cron:kur -- --kaldir

import { loadSecrets } from './_env.mjs'

const env = loadSecrets()
const bayraklar = process.argv.slice(2)
const IS_ADI = 'eryaman-zamanlanmis-isler'
// İkinci iş: veri temizliği. HTTP'ye çıkmaz, doğrudan SQL fonksiyonunu çağırır —
// pg_cron zaten veritabanının içinde, araya Vercel koymanın anlamı yok.
const TEMIZLIK_ADI = 'eryaman-veri-temizligi'

if (!env.CRON_SECRET) {
  throw new Error('.secrets.env içinde CRON_SECRET yok. Önce onu üret.')
}

const panelAdres = (env.NEXT_PUBLIC_PANEL_ADRES ?? '').replace(/\/+$/, '')
if (!panelAdres.startsWith('https://')) {
  throw new Error(
    `.secrets.env içindeki NEXT_PUBLIC_PANEL_ADRES https ile başlamalı (şu an: "${panelAdres}").`,
  )
}

async function sql(query) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${env.SUPABASE_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.SUPABASE_MGMT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    },
  )
  const metin = await res.text()
  if (!res.ok) throw new Error(`SQL hata ${res.status}: ${metin}`)
  try {
    return JSON.parse(metin)
  } catch {
    return metin
  }
}

// Tek tırnak kaçışı: pg_cron komutu SQL metni içinde metin olarak taşınıyor.
const kacir = (s) => String(s).replace(/'/g, "''")

async function durum() {
  const isler = await sql(
    `select jobid, jobname, schedule, active from cron.job order by jobid;`,
  )
  console.log('pg_cron işleri:', JSON.stringify(isler, null, 2))

  const son = await sql(
    `select j.jobname, d.status, d.return_message, d.start_time
       from cron.job_run_details d
       join cron.job j on j.jobid = d.jobid
      where j.jobname in ('${kacir(IS_ADI)}', '${kacir(TEMIZLIK_ADI)}')
      order by d.start_time desc limit 8;`,
  )
  console.log('son çalışmalar:', JSON.stringify(son, null, 2))
}

async function kaldir() {
  await sql(`select cron.unschedule('${kacir(IS_ADI)}');`)
  await sql(`select cron.unschedule('${kacir(TEMIZLIK_ADI)}');`)
  console.log('✓ cron işleri kaldırıldı')
}

/** Aynı isimde iş varsa düşür — bu script defalarca çalıştırılabilir olmalı. */
async function isiDusur(ad) {
  await sql(`
    do $$
    begin
      if exists (select 1 from cron.job where jobname = '${kacir(ad)}') then
        perform cron.unschedule('${kacir(ad)}');
      end if;
    end;
    $$;
  `)
}

async function kur() {
  console.log('→ eklentiler kuruluyor (pg_cron, pg_net)')
  await sql(`
    create extension if not exists pg_cron;
    create extension if not exists pg_net;
  `)

  await isiDusur(IS_ADI)
  await isiDusur(TEMIZLIK_ADI)

  const hedef = `${panelAdres}/api/cron`
  console.log(`→ iş kuruluyor: ${hedef} (5 dakikada bir)`)

  // net.http_get asenkron çalışır: pg_cron isteği kuyruğa atar ve hemen döner,
  // yani cevabı beklemez. Bizim için doğru davranış — rota kendi içinde loglar.
  await sql(`
    select cron.schedule(
      '${kacir(IS_ADI)}',
      '*/5 * * * *',
      $job$
        select net.http_get(
          url := '${kacir(hedef)}',
          headers := jsonb_build_object('Authorization', 'Bearer ${kacir(env.CRON_SECRET)}'),
          timeout_milliseconds := 30000
        );
      $job$
    );
  `)

  // İkinci iş: veri temizliği, 2 ayda bir (ayın 1'i, 02:00 UTC = 05:00 TR).
  // Saat kasıtlı: bot 01:00-08:00 arası uyuyor, silme işi kimseyi bekletmez.
  console.log('→ temizlik işi kuruluyor (2 ayda bir, ayın 1\'i 05:00 TR)')
  await sql(`
    select cron.schedule(
      '${kacir(TEMIZLIK_ADI)}',
      '0 2 1 */2 *',
      $job$ select public.eski_verileri_temizle(); $job$
    );
  `)

  console.log('✓ cron kuruldu')
  console.log('')
  console.log('Doğrulama: npm run cron:kur -- --durum')
  console.log('Temizlik provası (SAYAR, SİLMEZ):')
  console.log('  select public.eski_verileri_temizle(kuru => true);')
  console.log('UYARI: CRON_SECRET Vercel ortam değişkenlerinde de tanımlı olmalı,')
  console.log('       yoksa rota 401 döner (npm run yayinla bunu yapıyor).')
}

if (bayraklar.includes('--durum')) await durum()
else if (bayraklar.includes('--kaldir')) await kaldir()
else await kur()
