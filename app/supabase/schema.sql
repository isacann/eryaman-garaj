-- Eryaman Garaj — yapay zeka yanıt sistemi, veritabanı şeması
-- Kaynak: KAPSAM.md Bölüm 7 (mimari) + Bölüm 4 (kilitlenen kararlar)
-- Tek dosya, tekrar çalıştırılabilir (idempotent). Çalıştır: node scripts/provision.mjs
--
-- KURAL (panel projesinden alınan ders): durum/tip alanları CHECK'siz TEXT.
-- Yeni bir durum değeri eklemek migration gerektirmesin. İzin verilen değerler
-- kolon yorumlarında yazılı, uygulama tarafında src/lib/db/types.ts'te tiplenir.
--
-- ROL MODELİ (KAPSAM karar 10): tek kullanıcı, tek yetki, rol ayrımı yok.
-- RLS açık; oturum açmış her kullanıcı her şeyi görür ve yazar.
-- Sunucu tarafı (webhook, cron) service_role ile bağlanır, RLS'i baypas eder.

-- ---------------------------------------------------------------------------
-- Yardımcılar
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- contacts — yazışan kişi
-- ---------------------------------------------------------------------------

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  kanal text not null,                       -- whatsapp | instagram | mock | test
  kanal_kimlik text not null,                -- WhatsApp telefon (wa_id) ya da Instagram scoped user id
  ad text,
  telefon text,
  instagram_kullanici text,
  notlar text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.contacts.kanal is 'whatsapp | instagram | mock (betik testi) | test (paneldeki test konsolu)';
comment on column public.contacts.kanal_kimlik is 'Kanalın kişiye verdiği kimlik. Kanal ile birlikte tekil.';

create unique index if not exists contacts_kanal_kimlik_key
  on public.contacts (kanal, kanal_kimlik);

drop trigger if exists contacts_updated_at on public.contacts;
create trigger contacts_updated_at before update on public.contacts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- conversations — konuşma
-- ---------------------------------------------------------------------------

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  kanal text not null,                       -- whatsapp | instagram | mock | test
  durum text not null default 'bot',         -- bot | devir | kapali
  son_mesaj_at timestamptz,
  pencere_bitis_at timestamptz,              -- Meta 24 saat müşteri hizmetleri penceresinin bitişi
  devir_at timestamptz,                      -- devre çıkıldığı an (karar 4: 15 dk kuralı buradan sayılır)
  okundu_at timestamptz,                     -- panelde en son ne zaman okundu
  bot_tur_at timestamptz,                    -- çalışan bot turunun kilidi (null = boş); bkz. lib/gelen-tur.ts
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Mevcut kurulumlar için: `create table if not exists` var olan tabloya kolon
-- eklemiyor, o yüzden sonradan gelen her kolon ayrıca yazılır (15 Ağustos 2026).
alter table public.conversations add column if not exists bot_tur_at timestamptz;

comment on column public.conversations.durum is 'bot = yapay zeka cevaplıyor | devir = ekip devraldı, bot susar | kapali';
comment on column public.conversations.bot_tur_at is 'Bir konuşmada aynı anda tek bot turu çalışsın diye kilit. Müşteri arka arkaya yazdığında iki tur paralel başlıyor ve ikisi de baştan selamlıyordu (15 Ağustos 2026). 90 sn sonra kendiliğinden düşer.';
comment on column public.conversations.pencere_bitis_at is 'Müşterinin son mesajı + 24 saat. Sonrasında sadece onaylı şablon gider (ücretli).';

create index if not exists conversations_son_mesaj_idx
  on public.conversations (son_mesaj_at desc nulls last);
create index if not exists conversations_contact_idx
  on public.conversations (contact_id);
create index if not exists conversations_durum_idx
  on public.conversations (durum);

drop trigger if exists conversations_updated_at on public.conversations;
create trigger conversations_updated_at before update on public.conversations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- messages — mesaj
-- ---------------------------------------------------------------------------

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  yon text not null,                         -- gelen | giden
  gonderen text not null,                    -- musteri | bot | ekip
  metin text,
  medya_url text,
  harici_id text,                            -- Meta'nın mesaj kimliği (tekrar işlemeyi önler)
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on column public.messages.yon is 'gelen = müşteriden bize | giden = bizden müşteriye';
comment on column public.messages.gonderen is 'musteri | bot | ekip';
comment on column public.messages.harici_id is 'Meta mesaj id. Webhook tekrar gelirse aynı mesaj iki kez yazılmasın.';

create index if not exists messages_conversation_idx
  on public.messages (conversation_id, created_at);
create unique index if not exists messages_harici_id_key
  on public.messages (harici_id) where harici_id is not null;

-- ---------------------------------------------------------------------------
-- appointment_requests — randevu talebi
-- KAPSAM karar 3: bot uygun saati konuşur, talep panele düşer, ekip teyit eder.
-- Otomatik randevu/rezervasyon sisteminin kendisi KAPSAM DIŞI (Bölüm 3).
-- ---------------------------------------------------------------------------

create table if not exists public.appointment_requests (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  istenen_zaman_metin text,                  -- müşterinin kendi kelimeleriyle: "yarın öğleden sonra"
  randevu_at timestamptz,                    -- çözümlenmiş kesin an; hatırlatma buna göre kurulur
  arac text,                                 -- marka/model/yıl
  hizmet text,                               -- ppf | cam filmi | detaylı bakım vb. serbest metin
  durum text not null default 'bekliyor',    -- bekliyor | onaylandi | iptal
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 14 Ağustos 2026, Fatih Bey isteği: bot net gün/saat sorsun, randevu ekip
-- onayını BEKLEMEDEN panele düşsün, randevudan önce müşteriye hatırlatma gitsin.
-- Bunun için serbest metnin yanına çözümlenmiş bir zaman damgası gerekiyor:
-- "haftaya salı" üzerine zamanlama kurulamaz.
alter table public.appointment_requests add column if not exists randevu_at timestamptz;

comment on column public.appointment_requests.durum is 'bekliyor | onaylandi | iptal. Bot artık doğrudan onaylandi yazıyor (14 Ağustos kararı: ekip onayı beklenmiyor); ekip panelden iptal edebilir ya da zamanı düzeltebilir.';
comment on column public.appointment_requests.istenen_zaman_metin is 'Müşterinin kendi ifadesi ("yarın öğleden sonra"). Kesin an randevu_at kolonunda.';
comment on column public.appointment_requests.randevu_at is 'Botun çözümlediği kesin an. NULL ise zaman netleşmemiştir; hatırlatma kurulmaz, talep yine de panele düşer.';

-- Hatırlatma kuyruğu bu indeksi kullanıyor: yaklaşan ve iptal edilmemiş randevular.
create index if not exists appointment_requests_randevu_at_idx
  on public.appointment_requests (randevu_at)
  where randevu_at is not null;

create index if not exists appointment_requests_durum_idx
  on public.appointment_requests (durum, created_at desc);
create index if not exists appointment_requests_conversation_idx
  on public.appointment_requests (conversation_id);

drop trigger if exists appointment_requests_updated_at on public.appointment_requests;
create trigger appointment_requests_updated_at before update on public.appointment_requests
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- followups — takip kuyruğu
-- KAPSAM karar 6: 3. saat (pencere içi) → 20. saat (pencere içi) → 24 saat sonrası şablon.
-- ---------------------------------------------------------------------------

create table if not exists public.followups (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  basamak text not null,                     -- 3saat | 20saat | sablon
  planlanan_at timestamptz not null,
  durum text not null default 'beklemede',   -- beklemede | gonderildi | iptal
  gonderildi_at timestamptz,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.followups.basamak is '3saat | 20saat (ikisi de ücretsiz) | sablon (25. saat, onaylı şablon, ücretli) | randevu-hatirlatma (merdivenin parçası DEĞİL, randevu tarihinden sayılır). Süreler 14 Ağustos 2026 Fatih Bey kararıyla güncellendi.';
comment on column public.followups.durum is 'beklemede | gonderildi | iptal. Müşteri cevap verdiyse, ilgilenmiyorum dediyse ya da ekip devraldıysa iptal edilir.';

create unique index if not exists followups_conversation_basamak_key
  on public.followups (conversation_id, basamak);
create index if not exists followups_kuyruk_idx
  on public.followups (durum, planlanan_at);

drop trigger if exists followups_updated_at on public.followups;
create trigger followups_updated_at before update on public.followups
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- notifications — bildirim kuyruğu
-- KAPSAM Bölüm 5. Kuyruk, çünkü iki şey gerekiyor:
--   1. Sıcak müşteri bildirimi 00:00-08:00 arası sabaha ERTELENİR.
--   2. Telegram anlık çökerse bildirim kaybolmaz, cron yeniden dener.
-- ---------------------------------------------------------------------------

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  hedef text not null,                       -- fatih | operiqo
  tip text not null,                         -- randevu | devir | sicak | sistem
  govde text not null,                       -- Telegram HTML gövdesi, hazır kurulmuş
  conversation_id uuid references public.conversations(id) on delete cascade,
  durum text not null default 'beklemede',   -- beklemede | gonderildi | hata
  planlanan_at timestamptz not null default now(),
  gonderildi_at timestamptz,
  deneme smallint not null default 0,
  son_hata text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.notifications is 'KAPSAM Bölüm 5. randevu/devir anlık her saat; sicak 08:00-00:00 anlık, gece sabaha ertelenir; sistem → Operiqo.';
comment on column public.notifications.deneme is 'Gönderim denemesi sayısı. 5 denemeden sonra durum=hata, cron artık uğraşmaz.';

create index if not exists notifications_kuyruk_idx
  on public.notifications (durum, planlanan_at);

drop trigger if exists notifications_updated_at on public.notifications;
create trigger notifications_updated_at before update on public.notifications
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- settings — tek satır (id = 1)
-- ---------------------------------------------------------------------------

create table if not exists public.settings (
  id smallint primary key default 1,
  calisma_saati_baslangic time not null default '08:00',
  calisma_saati_bitis time not null default '01:00',   -- gece yarısını aşar, kod sarma hesabı yapar
  bot_aktif boolean not null default true,
  sablon_takip_aktif boolean not null default false,   -- Meta şablon onayı gelene kadar kapalı (KAPSAM Madde 4.3)
  takip_aktif boolean not null default true,           -- 3. ve 20. saat takipleri (pencere içi, ücretsiz)
  telegram_chat_id text,                               -- Fatih Bey /start yazınca panelden yakalanır
  telegram_aktif boolean not null default true,
  meta jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint settings_tek_satir check (id = 1)
);

-- Tablo daha önce kurulduysa "create table if not exists" yeni kolonları EKLEMEZ.
-- Bu şema dosyası defalarca çalıştırılabilir olmak zorunda, o yüzden kolonlar
-- ayrıca alter ile de garantiye alınır. Sıra önemli: comment'ler kolonlar
-- kesinleştikten SONRA gelir, yoksa eski kurulumda "column does not exist" der.
alter table public.settings add column if not exists takip_aktif boolean not null default true;
alter table public.settings add column if not exists telegram_chat_id text;
alter table public.settings add column if not exists telegram_aktif boolean not null default true;

comment on table public.settings is 'Tek satır. KAPSAM karar 5: bot 08:00-01:00 çalışır, 01:00-08:00 arası tek mesai dışı mesajı atar.';
comment on column public.settings.telegram_chat_id is 'Telegram sohbet kimliği. Jeton DEĞİL — jeton ortam değişkeninde durur, buraya asla yazılmaz.';
comment on column public.settings.takip_aktif is 'Ücretsiz takip merdiveni (3. ve 20. saat). Şablon takibi ayrı bayrak: sablon_takip_aktif.';

insert into public.settings (id) values (1) on conflict (id) do nothing;

drop trigger if exists settings_updated_at on public.settings;
create trigger settings_updated_at before update on public.settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- bot_egitim — işletmenin bota kendi eklediği bilgi / davranış / kampanya
--
-- Fatih Bey'in isteği (12 Ağustos): "bot gün geçtikçe eğitilebiliyor olsun".
-- Üç tür tek tabloda tutuluyor çünkü hepsinin yaşam döngüsü aynı: yaz, aç/kapat,
-- sil. Ayrı tablo üç kat kod demekti, kazancı yoktu.
--
--   bilgi    → kalıcı işletme bilgisi (yeni hizmet, garanti şartı, çalışma usulü)
--   davranis → ton/üslup notu ("daha samimi ol", "randevuda telefon iste")
--   reklam   → reklamdan gelene anlatılacak kampanya; `anahtar` reklam kimliği
--              ya da reklam başlığında geçen kelime
--
-- ⚠ `anahtar` yalnızca tur='reklam' satırlarında anlamlıdır.
-- ---------------------------------------------------------------------------

create table if not exists public.bot_egitim (
  id uuid primary key default gen_random_uuid(),
  tur text not null check (tur in ('bilgi', 'davranis', 'reklam')),
  baslik text not null,
  icerik text not null,
  anahtar text,                              -- reklam eşleşmesi: ad_id ya da başlıktaki kelime
  gecerli_bitis date,                        -- sadece tur='reklam': kampanyanın son günü
  aktif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.bot_egitim is 'Fatih Bey panelden ekler; sistem promptuna girer. tur=reklam olanlar yalnızca o reklamdan gelen konuşmaya girer.';
-- ⚠ SIRA ÖNEMLİ: tablo daha önce kurulduysa "create table if not exists" yeni
-- kolonu EKLEMEZ. Kolon önce alter ile garantiye alınır, comment SONRA gelir —
-- yoksa eski kurulumda "column does not exist" hatası verir.
alter table public.bot_egitim add column if not exists gecerli_bitis date;

comment on column public.bot_egitim.anahtar is 'Sadece tur=reklam icin: reklam kimligi ya da reklam basliginda gecen kelime.';
comment on column public.bot_egitim.gecerli_bitis is 'Kampanyanin son gunu. Gecmisse bot kampanyayi SOYLEMEZ - suresi dolmus indirimi vaat etmek taahhuttur (Madde 9.2).';

create index if not exists bot_egitim_tur_idx on public.bot_egitim (tur, aktif);

drop trigger if exists bot_egitim_updated_at on public.bot_egitim;
create trigger bot_egitim_updated_at before update on public.bot_egitim
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- activity_log — ne olduğunun izi
-- ---------------------------------------------------------------------------

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  aktor text not null,                       -- bot | ekip | sistem | webhook
  tip text not null,                         -- mesaj_geldi | mesaj_gonderildi | devir | randevu_talebi | takip_gonderildi ...
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_created_idx
  on public.activity_log (created_at desc);

-- ---------------------------------------------------------------------------
-- eski_verileri_temizle — 2 ayda bir çalışan bakım işi
--
-- NEDEN: Supabase ücretsiz planında 500 MB sınırı ve OTOMATİK YEDEK YOK.
-- Konuşma geçmişinin asıl kopyası zaten WhatsApp ve Instagram uygulamalarında
-- duruyor (İsa kararı, 14 Ağustos 2026) — burası çalışma alanı, arşiv değil.
--
-- ⚠ SİLİNMEYENLER, sebepleriyle:
--   appointment_requests — ticari kayıt. Randevu talebi silinmez, süresi yok.
--   settings, bot_egitim  — işletmenin kendi yazdığı bilgi, yaşlanmaz.
--   randevusu olan konuşma — talebe bağlı yazışma delildir, cascade ile gitmemeli.
--   durum='devir' konuşma  — ekip hâlâ ilgileniyor olabilir, tarihe bakmadan korunur.
--
-- Silme sırası önemli: alt tablolar cascade ile gider, önce konuşma silinir.
-- Kişi (contacts) en sonda silinir, çünkü konuşması kalmayan kişi öksüz kayıttır.
--
-- Kuru çalıştırma (SAYAR, SİLMEZ):
--   select public.eski_verileri_temizle(kuru => true);
-- ---------------------------------------------------------------------------

create or replace function public.eski_verileri_temizle(
  konusma_gun int default 180,   -- müşteri yazışması: 6 ay dokunulmadıysa gider
  log_gun     int default 60,    -- activity_log / bildirim / takip izleri: 2 ay
  test_gun    int default 30,    -- test + mock konuşmaları: çöp, 1 ay yeter
  kuru        boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sonuc jsonb := '{}'::jsonb;
  n int;
  eskimis uuid[];
begin
  -- ---- 1. Silinecek konuşmaları BİR KEZ belirle -------------------------
  -- Kuru çalıştırmada da aynı listeyi kullanıyoruz ki rapor gerçeği göstersin.
  select coalesce(array_agg(k.id), '{}')
    into eskimis
  from public.conversations k
  where k.durum <> 'devir'
    and coalesce(k.son_mesaj_at, k.created_at) < now() - make_interval(days =>
          case when k.kanal in ('test', 'mock') then test_gun else konusma_gun end)
    -- Randevu talebi olan yazışma korunur: talebin bağlamı kaybolmasın.
    and not exists (
      select 1 from public.appointment_requests r where r.conversation_id = k.id
    );

  sonuc := sonuc || jsonb_build_object('konusma', coalesce(array_length(eskimis, 1), 0));

  -- Silinecek mesaj sayısını raporla (cascade ile gidecekler).
  select count(*) into n
    from public.messages m where m.conversation_id = any(eskimis);
  sonuc := sonuc || jsonb_build_object('mesaj', n);

  if not kuru then
    -- messages / followups / notifications / appointment_requests hepsi
    -- conversation_id üzerinden ON DELETE CASCADE; tek delete yeter.
    delete from public.conversations where id = any(eskimis);
  end if;

  -- ---- 2. Bitmiş kuyruk kayıtları --------------------------------------
  -- Konuşması yaşamaya devam eden ama işi bitmiş satırlar. Bunlar sadece iz;
  -- gönderildi/iptal olmuşsa bir daha okunmaz.
  select count(*) into n from public.followups
   where durum in ('gonderildi', 'iptal') and created_at < now() - make_interval(days => log_gun);
  sonuc := sonuc || jsonb_build_object('takip', n);
  if not kuru then
    delete from public.followups
     where durum in ('gonderildi', 'iptal') and created_at < now() - make_interval(days => log_gun);
  end if;

  select count(*) into n from public.notifications
   where durum in ('gonderildi', 'hata') and created_at < now() - make_interval(days => log_gun);
  sonuc := sonuc || jsonb_build_object('bildirim', n);
  if not kuru then
    delete from public.notifications
     where durum in ('gonderildi', 'hata') and created_at < now() - make_interval(days => log_gun);
  end if;

  -- ---- 3. activity_log ---------------------------------------------------
  -- En hızlı şişen, en az okunan tablo. Her mesaj için satır yazıyor.
  select count(*) into n from public.activity_log
   where created_at < now() - make_interval(days => log_gun);
  sonuc := sonuc || jsonb_build_object('kayit', n);
  if not kuru then
    delete from public.activity_log where created_at < now() - make_interval(days => log_gun);
  end if;

  -- ---- 4. Öksüz kişiler --------------------------------------------------
  -- Konuşması kalmamış kişi kaydı hiçbir şeye yaramaz. En SONDA, çünkü
  -- yukarıdaki silmeler yeni öksüzler üretiyor.
  --
  -- ⚠ Sayım kuru modda da doğru olmalı: orada konuşmalar HENÜZ silinmediği için
  -- düz "not exists" sorgusu her zaman 0 döndürürdü ve rapor yalan söylerdi.
  -- Bu yüzden silinmek üzere işaretlenen konuşmalar (eskimis) yok sayılıyor.
  select count(*) into n from public.contacts k
   where not exists (
     select 1 from public.conversations s
      where s.contact_id = k.id and not (s.id = any(eskimis))
   );
  sonuc := sonuc || jsonb_build_object('kisi', n);
  if not kuru then
    delete from public.contacts k
     where not exists (select 1 from public.conversations s where s.contact_id = k.id);
  end if;

  return sonuc || jsonb_build_object('kuru', kuru, 'an', now());
end;
$$;

comment on function public.eski_verileri_temizle is
  'Bakım işi, pg_cron 2 ayda bir çağırır. Randevu talepleri, devirdeki konuşmalar ve ayarlar ASLA silinmez. kuru => true ile sayar ama silmez.';

-- ---------------------------------------------------------------------------
-- RLS — tek yönetici kullanıcı modeli (KAPSAM karar 10)
-- Oturum açmış kullanıcı her tabloda tam yetkili. Anonim erişim yok.
-- ---------------------------------------------------------------------------

alter table public.contacts             enable row level security;
alter table public.conversations        enable row level security;
alter table public.messages             enable row level security;
alter table public.appointment_requests enable row level security;
alter table public.followups            enable row level security;
alter table public.notifications        enable row level security;
alter table public.settings             enable row level security;
alter table public.activity_log         enable row level security;
alter table public.bot_egitim           enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'contacts', 'conversations', 'messages',
    'appointment_requests', 'followups', 'notifications', 'settings', 'activity_log',
    'bot_egitim'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_yonetici', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      t || '_yonetici', t
    );
  end loop;
end;
$$;
