# Eryaman Garaj — Yanıt Paneli

WhatsApp ve Instagram DM'lerini tek panelde toplayan uygulama.
İşin sınırları `../KAPSAM.md` dosyasında. Ton kaynağı `../TON-ANALIZI.md`,
fiyat kaynağı `../FIYAT-LISTESI.md`.

Bu depoda şu an **kilometre taşı 3** var: uygulama iskeleti, veritabanı, kanal
soyutlaması, panel, **yanıt motoru**, **test konsolu** ve **devir akışı**.
Motor artık konuşmaya bağlı: test konsolundan yazılan mesajı cevaplıyor, cevabı
tablolara yazıyor, randevu talebini panele düşürüyor. Meta bağlantısı sıradaki
adım; gerçek WhatsApp/Instagram akışı henüz yok.

---

## Çalıştırma

```bash
npm install
npm run env        # ../.secrets.env'den .env.local üretir
npm run db:kur     # Supabase şemasını uygular + auth ayarlarını yazar
npm run dev        # http://localhost:3000
```

Panele giriş e-posta + şifre iledir, kayıt sayfası yoktur (KAPSAM karar 10:
tek kullanıcı, tek yetki). Kullanıcı komutla açılır:

```bash
npm run kullanici:ekle -- fatih.altin92@gmail.com "sifre"
```

## Ortam değişkenleri

`.env.local` elle yazılmaz, `npm run env` ile `../.secrets.env`'den üretilir.
İkisi de git-ignore'dadır, depoya girmez.

| Değişken | Nerede kullanılır |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | tarayıcı + sunucu |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | tarayıcı + sunucu, RLS geçerli |
| `SUPABASE_SERVICE_ROLE_KEY` | **sadece sunucu** (webhook, cron). RLS'i baypas eder, tarayıcıya asla gitmez. |

`../.secrets.env` ayrıca `SUPABASE_REF` ve `SUPABASE_MGMT_TOKEN` tutar; bunlar
sadece `scripts/` altındaki kurulum betikleri içindir, uygulama okumaz.

### Model / sağlayıcı

Varsayılan **`openai` / `gpt-5.4-mini`** (İsa kararı, 9 Ağustos 2026). Gemini'nin
ücretsiz katmanı hem kotaya takılıyor hem kalite sorunu veriyordu.

```bash
MOTOR_SAGLAYICI=openai        # openai | gemini | gemini-lite | anthropic | sahte
MOTOR_MODEL=gpt-5.4-mini      # boş bırakılırsa sağlayıcının varsayılanı
```

Sağlayıcı değiştirmek kod değişikliği değil, tek satır ortam değişkeni.
`openai.ts` Chat Completions + strict structured outputs kullanır, SDK yok.

### Yanıt motorunun değişkenleri

Hepsi opsiyoneldir, `.secrets.env`'e eklenince `npm run env` bunları da
`.env.local`'e taşır. **Hiçbiri `NEXT_PUBLIC_` değil, tarayıcıya gitmez.**

| Değişken | Ne işe yarar |
|---|---|
| `MOTOR_SAGLAYICI` | `gemini` (varsayılan) · `gemini-lite` · `anthropic` · `sahte` |
| `MOTOR_MODEL` | model adını elle ezer. Boşsa sağlayıcının varsayılanı kullanılır. |
| `GEMINI_API_KEY` | `gemini` ve `gemini-lite` için **zorunlu** |
| `ANTHROPIC_API_KEY` | `anthropic` için **zorunlu** |
| `MOTOR_TEYITSIZ_FIYAT` | `evet` dersen fiyat listesinin 3b bölümündeki teyitsiz rakamlar da kullanılır (varsayılan: kapalı) |
| `FIYAT_LISTESI_YOLU` | `../FIYAT-LISTESI.md` bulunamazsa yolu elle vermek için |

Anahtar yoksa motor sessizce çalışmaz, hangi değişkenin eksik olduğunu ve
nereye konacağını söyleyerek durur. Anahtarsız denemek için `sahte` sağlayıcı
var (aşağıya bak).

## Veritabanı

Şema tek dosyada: `supabase/schema.sql`. Tekrar çalıştırılabilir.

```bash
npm run db:kur
```

Betik Management API üzerinden SQL'i çalıştırır, tabloları ve RLS politikalarını
doğrular, auth ayarlarını yazar (kayıt kapalı, e-posta + şifre).

| Tablo | Ne tutar |
|---|---|
| `contacts` | yazışan kişi (kanal + kanal kimliği tekil) |
| `conversations` | konuşma, durumu (`bot` / `devir` / `kapali`), 24 saatlik Meta penceresinin bitişi |
| `messages` | mesajlar (`gelen` / `giden`, gönderen `musteri` / `bot` / `ekip`) |
| `appointment_requests` | randevu talebi. Takvim kaydı değil, ekip teyit eder (KAPSAM karar 3) |
| `followups` | takip kuyruğu: `3saat` → `20saat` → `sablon` (KAPSAM karar 6) |
| `settings` | tek satır: çalışma saatleri, bot açık mı, şablon takibi açık mı |
| `activity_log` | ne olduğunun izi |

Durum alanları CHECK'siz TEXT: yeni bir değer eklemek migration gerektirmez.
İzin verilen değerler kolon yorumlarında yazılı, TypeScript tarafında
`src/lib/db/types.ts`'te daraltılmış.

**RLS:** her tabloda açık. Oturum açmış kullanıcı tam yetkili, anonim erişim yok.
Sunucu tarafı (webhook, cron) service_role ile bağlanır ve RLS'i baypas eder.

## Kanal soyutlaması

Uygulamanın hiçbir yeri doğrudan WhatsApp'a ya da Instagram'a bağlanmaz.
Her gönderim ve her gelen mesaj `src/lib/channels/` altındaki `Kanal`
arayüzünden geçer.

| Dosya | Durum |
|---|---|
| `types.ts` | `Kanal` arayüzü, ortak `GelenMesaj` tipi |
| `mock.ts` | **çalışır.** Betikle beslenen test kanalı (`npm run mock:gonder`) |
| `test.ts` | **çalışır.** Paneldeki test konsolunun (`/test`) kanalı |
| `whatsapp.ts` | iskelet, TODO. Meta erişimi gelince doldurulacak |
| `instagram.ts` | iskelet, TODO. Meta erişimi gelince doldurulacak |

`mock` ve `test` kanalları dışarı mesaj GÖNDERMEZ; gönderilen metin
`activity_log`'a düşer. Üretimde ikisi de kullanılmaz.

Kanal sadece taşıma yapar. Kişi / konuşma / mesaj kayıtları tek yerden,
`src/lib/mesajlar.ts` servis katmanından yazılır.

### Sahte kanalla test

Sunucu ayaktayken:

```bash
npm run mock:gonder -- 905551112233 "Test Müşteri" "PPF fiyatı nedir?"
```

Mesaj gerçek tablolara yazılır ve panelde görünür, kanal rozeti **Test** olur.
Giden tarafta dışarı bir şey gitmez, gönderilen metin konsola ve `activity_log`'a
düşer. Test verisini silmek için:

```bash
npm run test:temizle
```

Sadece `kanal` değeri `mock` ya da `test` olan kayıtlar silinir, gerçek
yazışmalara dokunulmaz.

## Yanıt motoru

`src/lib/motor/` altında, **model bağımsız**. Uygulamanın hiçbir yeri "gemini"
ya da "claude" bilmez; sağlayıcı ve model ortam değişkeninden seçilir, model
adı iş mantığına gömülmez.

| Dosya | Ne |
|---|---|
| `types.ts` | ortak tipler (`YapiliCikti`, `KonusmaMesaji`, `Gorsel`) |
| `saglayici.ts` | `Saglayici` arayüzü, ortam değişkeni çözümü, varsayılan model tablosu |
| `gemini.ts` / `gemini-lite.ts` | Gemini REST, `responseSchema` ile yapılandırılmış çıktı |
| `anthropic.ts` | resmî `@anthropic-ai/sdk`, `output_config.format` ile yapılandırılmış çıktı |
| `sahte.ts` | anahtarsız test sağlayıcısı, sabit cevap döner |
| `sema.ts` | çıktı şeması tek yerde; Gemini biçimine `geminiSemasi()` ile çevrilir |
| `fiyat.ts` | `../FIYAT-LISTESI.md` okunur ve bölünür. Fiyat tablosu koda kopyalanmaz. |
| `sistem-prompt.ts` | ton + fiyat + çalışma saati + kimlik kuralları |
| `saat.ts` | 08:00-01:00 mesai hesabı (KAPSAM karar 5) |
| `denetim.ts` | otomatik kırmızı bayrak kontrolleri |
| `altin-set.ts` | altın set koşucusu |

```ts
import { yanitUret } from '@/lib/motor'

const yanit = await yanitUret({
  konusma: [{ rol: 'musteri', metin: 'PPF fiyatı nedir?' }],
  kisiAdi: 'Emrah',
})
yanit.yapili.mesajlar      // müşteriye gidecek kısa mesajlar
yanit.yapili.devir_gerekli_mi
```

**Yapılandırılmış çıktı ham metinden regex ile ayıklanmaz.** Her sağlayıcı kendi
şema desteğini kullanır, gelen JSON `sema.ts` içinde doğrulanır.

**Fiyat tek kaynaktan gelir.** Sistem promptundaki tablo `../FIYAT-LISTESI.md`
dosyasından okunur. Fiyat değişince tek dosya güncellenir, prompt kendiliğinden
yeni fiyattan konuşur. 3b bölümündeki "Fatih Bey teyit etmeli" kalemlerin
rakamı prompta **girmez**; bot o işlerde numara isteyip devreder.

**Fotoğraf.** Müşteri araç fotoğrafı atarsa modele gönderilir, gözlem
`gorsel_notu` alanına düşer. Fotoğraftan fiyat kesilmez (KAPSAM karar 2).

## Altın set (botun sınav kağıdı)

`../altin-set.json` içindeki 18 gerçek konuşma seçili sağlayıcıya oynatılır.
Konuşma tur tur ilerler: müşterinin gerçek mesajları sırayla verilir, işletme
tarafını bot doldurur. Fatih Bey'in o gün verdiği cevaplar rapora referans
olarak yazılır, **modele gösterilmez**.

```bash
npm run altin-set                          # MOTOR_SAGLAYICI'ya göre
npm run altin-set -- --saglayici=sahte     # anahtarsız uçtan uca deneme
npm run altin-set -- --saglayici=anthropic --model=claude-haiku-4-5
npm run altin-set -- --limit=3             # sadece ilk 3 vaka
```

Rapor `_altin-set/<saglayici>-<tarih>.md` olarak yazılır (git-ignore'da). Her
vakada müşteri mesajı, botun cevabı, Fatih Bey'in gerçek cevabı ve
yapılandırılmış çıktı yan yana durur.

Otomatik kırmızı bayraklar:

| Kontrol | Ne yakalar |
|---|---|
| Listede olmayan rakam | `FIYAT-LISTESI.md`'de geçmeyen bir ₺ rakamı; ayrıca fiyatı teyit bekleyen bir işe rakam verilmesi |
| Fiyatla açma ihlali | ilk cevapta rakam geçmesi (Fatih Bey kararı: fiyat sohbetin sonunda) |
| İndirim vaadi | indirimden bahsedip onaylı cümleyi kullanmamak |
| SUV / binek farkı | araç tipine göre fiyat farkından bahsetmek (fark yok) |

Raporun sonunda **denetimin kendi kontrolü** var: bilerek bozuk beş metin
kontrollerden geçirilir, hepsinin yakalandığı tabloda görünür.

## Botun konuşmaya bağlanması

`src/lib/bot.ts` motoru veritabanına bağlar. Motor metin üretir, `mesajlar.ts`
kaydeder, bu dosya ikisini birleştirir:

```ts
import { botCevapla } from '@/lib/bot'

const sonuc = await botCevapla(konusmaId, gorseller)
```

Yaptıkları: konuşma geçmişini tablodan kurar, motoru çağırır, botun mesajlarını
yazar, randevu talebini `appointment_requests`'e düşürür, devir bayrağını
`activity_log`'a yazar. Yapılandırılmış çıktı ilk giden mesajın `meta` alanında
saklanır; panel ve test konsolu analizi oradan okur.

Bot şu üç durumda yazmaz: konuşma devirde, konuşma kapalı, `settings.bot_aktif`
kapalı. Devir kararı insanındır: botun kendi `devir_gerekli_mi` bayrağı sadece
işaret düşürür, konuşmayı susturmaz.

Şimdilik tek çağıran test konsolu. Meta webhook'u geldiğinde aynı fonksiyonu
çağıracak, kanal fark etmiyor.

## Panel

| Yol | Ne |
|---|---|
| `/giris` | e-posta + şifre |
| `/` | gelen kutusu: yazışma listesi + sohbet detayı |
| `/sohbet/[id]` | mesaj akışı, elle cevap kutusu, devir |
| `/randevular` | randevu talepleri |
| `/test` | test konsolu |
| `/ayarlar` | çalışma saatleri, bot açık/kapalı, şablon takibi |

Oturum koruması `src/middleware.ts`'te; oturumsuz istek `/giris`e düşer.
Panel hem masaüstünde hem telefonda çalışır: dar ekranda sohbet açılınca liste
gizlenir, üstte "← Gelen kutusu" bağlantısı çıkar.

### Test konsolu (`/test`)

Meta bağlantısı yokken botun konuşma kalitesini yargılamak için. Müşteri gibi
yazılır, bot cevap verir, her cevabın altındaki **Botun analizi** kutusunda
yapılandırılmış çıktı durur: niyet, araç, kapsam, fiyat verilebilir mi, devir
gerekli mi ve sebebi, randevu talebi, güven, model ve jeton.

- Motor çağrısı **sunucu tarafında** (sunucu eylemi). `GEMINI_API_KEY`
  tarayıcıya inmez.
- Araç fotoğrafı yüklenebilir. Fotoğraf tarayıcıda 1024 piksele küçültülüp
  JPEG'e çevrilir, sonra modele gider.
- Yazışmalar gerçek tablolara `kanal = 'test'` ile yazılır, gelen kutusunda
  **Test konsolu** rozetiyle görünür. Dışarı hiçbir mesaj gitmez.
- Konsol sekmede saklanır: panele bakıp geri gelince aynı yazışma sürer.
  "Sohbeti sıfırla" yeni bir yazışma açar.

### Elle cevap ve devir (KAPSAM karar 4)

Sohbet detayındaki kutuya ekip bir şey yazdığı anda konuşma `durum = 'devir'`
olur, `devir_at` damgalanır ve **bot susar**. "Bot'a geri ver" düğmesi durumu
`bot`'a çevirir, damgayı siler.

`devir_at` 15 dakika kuralının sayacı: ekip devraldıktan sonra 15 dakika
yazmazsa bot "ekibimiz birazdan dönecek" diyecek. O çalıştırıcı takip
kuyruğuyla birlikte gelecek, damga şimdiden tutuluyor.

## Yayın (Vercel)

```bash
vercel login      # bir kez, tarayıcıda doğrulama ister
npm run yayinla
```

`scripts/yayinla.mjs` projeyi bağlar, ortam değişkenlerini `../.secrets.env`'den
Vercel'e yazar (production + preview), fiyat listesini eşitler, üretime çıkar.
Anahtarlar komut satırına yazılmaz.

**Fiyat listesi tuzağı:** botun fiyat kaynağı `../FIYAT-LISTESI.md`, yani
uygulama dizininin dışında. Vercel'e sadece `app/` çıkıyor, dolayısıyla
`npm run prebuild` (derlemeden önce otomatik) dosyanın bir kopyasını
`app/FIYAT-LISTESI.md`'ye alır ve `next.config.ts` bu kopyayı sunucusuz pakete
ekler. Kopya ÜRETİLİR, elle düzenlenmez; fiyat değişince üst dizindeki dosya
güncellenir.

## Doğrulama

```bash
npm run tip                             # tsc --noEmit
npm run lint
npm run build
npm run altin-set -- --saglayici=sahte  # motor boru hattı, anahtarsız

# panel + test konsolu uçtan uca (sunucu ayakta olmalı)
node scripts/konsol-dogrula.mjs <e-posta> <sifre>

# zamanlanmış iş kuralları uçtan uca (sunucu ayakta olmalı)
npm run zamanlanmis:dogrula
```

`zamanlanmis:dogrula` 13 kontrol yapar: takip merdiveni kuruluyor mu, zamanı
gelince gidiyor mu, müşteri yazınca / şablon kapalıyken iptal oluyor mu, 15
dakika devir hatırlatması gidiyor mu, bildirim kuyrukta bekliyor mu. Zamanı
beklemek yerine kuyruk satırlarının `planlanan_at` değerini geçmişe çekip cron
rotasını çağırır; gerçek akışın aynısı çalışır.

`konsol-dogrula.mjs` masaüstü ve mobil görünümde giriş yapar, konsoldan mesaj
atar, botun cevabını ve analiz kutusunu bekler, panelde rozeti doğrular, elle
cevap yazıp devri test eder, devirdeyken botun sustuğunu ve bota geri
verilebildiğini kontrol eder. Ekran görüntüleri `_ekran/` altına düşer.

**Kota notu:** Gemini ücretsiz katmanında model başına dakikada sınırlı istek
var. Kotaya takılırsan konsol "Yapay zeka kotası doldu" der; doğrulama betiği
bekleyip tekrar dener. Kota model bazlı, `MOTOR_MODEL` ile başka bir modele
geçmek işi çözer.

## Zamanlanmış işler

Tek rota (`/api/cron`), dört iş: sabah kuyruğu → 15 dk devir kuralı → takip
merdiveni → bildirim kuyruğu. `Authorization: Bearer $CRON_SECRET` ile korunur;
sır tanımlı değilse üretimde rota kendini kapatır.

```bash
npm run cron:kur              # Supabase pg_cron işini kurar (5 dakikada bir)
npm run cron:kur -- --durum   # iş kayıtlı mı, son çalışmalar
npm run cron:kur -- --kaldir
```

⚠ **Tetikleyici Vercel Cron değil.** Vercel'in Hobby planında cron günde
yalnızca bir kez çalışabiliyor, daha sık bir ifade dağıtımı hata veriyor. Günde
tek tetiklemeyle ne 3. saat takibi ne de 15 dakika kuralı işler. Supabase zaten
altyapıda, pg_cron ücretsiz katmanda mevcut. Vercel Pro'ya geçilirse
`vercel.json`'a `crons` bloğu eklenip aynı rota kullanılır, kod değişmez.

`/api/cron` middleware'in açık yollarında olmalı; olmazsa çağrı `/giris`'e
yönlendirilir ve hiçbir zamanlanmış iş çalışmaz.

## Bildirim (Telegram)

Jeton `TELEGRAM_BOT_TOKEN` ortam değişkeninde (gizli), sohbet kimliği
`settings.telegram_chat_id`'de (gizli değil). Kurulum: Fatih Bey bota `/start`
yazar → `/ayarlar` → "Bağlantıyı kur" → "Test mesajı gönder".

Bildirimler önce kuyruğa (`notifications`) yazılır, sonra gönderilir: gece gelen
sıcak müşteri haberi sabah 08:00'e ertelenir, Telegram çökerse bildirim
kaybolmaz, cron 5 denemeye kadar tekrar dener. Jeton yoksa satırlar kuyrukta
bekler, mesaj akışı bundan etkilenmez.

## Henüz yapılmayanlar

- **Meta bağlantısı.** `whatsapp.ts` ve `instagram.ts` iskelet halinde,
  gelen mesaj otomatik cevaplanmıyor. Gerekenler KAPSAM Bölüm 9'da listeli.
  App Review gerekmiyor; bekleme kalemi işletme doğrulaması + Live mode.
- **Bot fiyat görselini kendiliğinden göndermiyor.** Altyapı hazır
  (`medyaGonder`), panelden ekip gönderiyor. Botun otomatik göndermesi
  "fiyatla açma yasağı" nedeniyle ayrı bir kapsam kararı ister.
- `settings.sablon_takip_aktif` varsayılan **kapalı**: Meta şablon onayı gelmeden
  açılmaz (KAPSAM Madde 4.3).

## Kapsam dışı (yazma)

Otomatik randevu/rezervasyon sisteminin kendisi, Instagram yorumları,
web sitesi sohbet widget'ı. Ayrıntı: `../KAPSAM.md` Bölüm 3.
