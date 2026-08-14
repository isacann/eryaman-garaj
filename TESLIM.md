# TESLIM.md — Eryaman Garaj sisteminin Fatih Bey'e devri

Bu belge, sistemin geliştirme hesaplarından **Fatih Altın'ın kendi hesaplarına** taşınmasının adım adım tarifidir. Sırayla uygulanır; sıra keyfi değil, her fazın çıktısı bir sonrakinin girdisi.

Hazırlanma tarihi: **14 Ağustos 2026**. Sözleşme teslim tarihi: **21 Ağustos 2026**.

---

## Teslim mantığı — nerede ne yapılır

Bu işin iki ayrı parçası var ve **aynı yerde yapılmazlar**:

| Parça | Nerede | Neden |
|---|---|---|
| **Hesap sahipliği** (Supabase, Vercel, Anthropic, Railway) | Uzak masaüstünde, **Fatih Bey'in tarayıcısından** | Hesaplar onun e-postasıyla açılmalı, faturalar onun kartına gitmeli (Sözleşme Madde 6) |
| **Kurulum, dağıtım, doğrulama** | **geliştirme makinesinden** | Kod burada çalışıyor ve doğrulanmış durumda. Yeni bir makinede Node/npm/Playwright kurmak saatler alır ve hiçbir kazancı yok |
| **Kaynak kod devri** | En sonda, sistem çalışır hâldeyken | Klasörün tamamı zip ya da özel git deposu olarak verilir |

⚠ **Fatih Bey'in makinesine kurulum yapmayın.** Teslim edilecek şey çalışan bir sistem ve onun hesaplarıdır; geliştirme ortamı değil. Bakım penceresinde (teslimden sonraki 1 ay) isterse ayrıca kurulur.

---

## FAZ 0 — Bağlanmadan önce (geliştirme makinesinde, ~15 dk)

- [ ] **Klasörün tam yedeğini al.** `C:\Users\hp\Desktop\eryaman` → harici bir kopyaya. Geri dönülemez adımlar var.
- [ ] `.secrets.env` dosyasının bir kopyasını `.secrets.env.eski` olarak sakla — yeni anahtarlar yazılırken eskisi lazım olabilir.
- [ ] **Şu an neyin çalıştığını doğrula:** `cd app && npm run bedava:dogrula` → 15/15 · 6/6 · 6/6 · 4/4 · 23/23 · 18/18 beklenir.
- [ ] Fatih Bey'e önceden söylenmesi gerekenler hazır olsun:
  - Aylık gider tablosu (aşağıda, "Fatih Bey'in aylık gideri")
  - Kredi kartı gerekecek: **Vercel, Anthropic, Railway** kayıt sırasında ister
  - Supabase Frankfurt'a taşınacak, mevcut test verisi **taşınmayacak** (karar: geçmiş zaten WhatsApp/Instagram uygulamalarında duruyor)

---

## FAZ 1 — Hesaplar (uzak masaüstü, Fatih Bey'in tarayıcısı, ~40 dk)

Hepsi **fatih.altin92@gmail.com** ile açılır. Şifreleri Fatih Bey belirlesin ve kendisi kaydetsin — geliştirici tarafında kalmasın.

### 1.1 Supabase (Frankfurt)
- [ ] `supabase.com` → GitHub ya da e-posta ile kayıt
- [ ] Yeni proje: ad `eryaman-garaj`, bölge **Central EU (Frankfurt) — eu-central-1**
  - ⚠ Mevcut proje Singapur'da. Ankara'ya Frankfurt çok daha yakın, her sorgu bunu hissettirir.
- [ ] Veritabanı şifresini kaydet
- [ ] Proje açılınca **Settings → API**'den şunları not al:
  - `Project URL` → `SUPABASE_URL`
  - `Project reference ID` → `SUPABASE_REF`
  - `anon public` anahtarı → `SUPABASE_ANON_KEY`
  - `service_role` anahtarı → `SUPABASE_SERVICE_ROLE_KEY` ⚠ bu anahtar RLS'i baypas eder, tarayıcıya asla gitmez
- [ ] **Account → Access Tokens** → yeni token üret → `SUPABASE_MGMT_TOKEN`

### 1.2 Vercel
- [ ] `vercel.com` → GitHub ile giriş (Fatih Bey'in GitHub'ı yoksa önce o açılır)
- [ ] Plan seçimi: **Hobby yeterli** (14 Ağustos kararı — Fatih Bey kendi kullanımı). Bilinen sınırlar aşağıda "Bilinen kısıtlar" bölümünde.
- [ ] Henüz proje oluşturma; FAZ 2'de CLI'dan yapılacak.

### 1.3 Anthropic (yapay zeka motoru)
- [ ] `console.anthropic.com` → kayıt
- [ ] **Billing** → kredi kartı ekle → **en az $20 kredi yükle**
  - Ölçülen aylık tüketim: **~$33** (1.400 tur, prompt önbelleği açık)
  - ⚠ Otomatik yükleme (auto-reload) **açılsın**. 11 ve 12 Ağustos'ta bakiye iki kez bitti ve bot tamamen sustu.
- [ ] **API Keys** → yeni anahtar → `ANTHROPIC_API_KEY`

### 1.4 Railway (Evolution API — WhatsApp)
- [ ] `railway.com` → GitHub ile giriş, kredi kartı ekle (Hobby planı yeterli, ~$5/ay)
- [ ] Kurulum FAZ 3'te.

### 1.5 Değişmeyenler
Bunlar zaten Fatih Bey'e ait, **dokunulmayacak**:
- **Telegram bot** (`@eryamangaraj_bot`) — jeton aynı kalır, `/start` tekrar gerekmez
- **Meta uygulaması** ve sırları (`META_APP_SECRET`, `META_INSTAGRAM_APP_SECRET`, `INSTAGRAM_TOKEN`) — portföy zaten `Eryaman detailing Otomotiv`

---

## FAZ 2 — Altyapıyı kur (geliştirme makinesi, ~30 dk)

### 2.1 Yeni sırları yaz

Sırların **hepsi değişmiyor**: Meta ve Telegram zaten işletmenin kendi hesapları, olduğu gibi taşınıyor. Elle kopyalarken satır atlamamak için şablonu betik üretiyor:

```bash
cd app && npm run teslim:env
```

Bu `.secrets.env.teslim` dosyasını yazar:
- **Aynen taşınanlar** (8): Meta ve Telegram sırları, `MOTOR_SAGLAYICI`, `MOTOR_MODEL`
- **Otomatik üretilenler** (2): `CRON_SECRET`, `EVOLUTION_WEBHOOK_SIR`
- **Doldurulacaklar** (10): `<< DOLDUR >>` diye işaretli
- **Bilerek yazılmayanlar**: OpenAI ve WhatsApp Cloud API değişkenleri — dosyanın sonunda sebebiyle listelenir

Doldurma bitince `.secrets.env` olarak kaydedilir, sonra `npm run env` ile `app/.env.local` üretilir.

⚠ Bu dosya sır içerir, `.gitignore`'da (`.secrets.env*`). Fatih Bey'in makinesine **elden** taşınır, depoya girmez.

**Tam liste, ne olacağıyla:**

| Değişken | Ne olacak |
|---|---|
| `SUPABASE_URL` | 🔄 **YENİ** (Frankfurt projesi) |
| `SUPABASE_REF` | 🔄 **YENİ** |
| `SUPABASE_ANON_KEY` | 🔄 **YENİ** |
| `SUPABASE_SERVICE_ROLE_KEY` | 🔄 **YENİ** |
| `SUPABASE_MGMT_TOKEN` | 🔄 **YENİ** |
| `ANTHROPIC_API_KEY` | 🔄 **YENİ** (Fatih Bey'in hesabı) |
| `CRON_SECRET` | 🔄 **YENİ ÜRET** — eskisi sohbet geçmişine düştü |
| `NEXT_PUBLIC_PANEL_ADRES` | 🔄 FAZ 2.4'te belli olacak |
| `EVOLUTION_API_URL` / `EVOLUTION_API_KEY` / `EVOLUTION_INSTANCE` | 🆕 FAZ 3'te |
| `EVOLUTION_WEBHOOK_SIR` | 🆕 **YENİ ÜRET** — webhook adresine `?sir=` diye eklenir (yedek doğrulama) |
| `TELEGRAM_BOT_TOKEN` | ✅ **AYNI KALIR** |
| `META_APP_SECRET` | ✅ **AYNI KALIR** |
| `META_INSTAGRAM_APP_SECRET` | ✅ **AYNI KALIR** |
| `META_WEBHOOK_VERIFY_TOKEN` | ✅ **AYNI KALIR** |
| `INSTAGRAM_APP_ID` | ✅ **AYNI KALIR** |
| `INSTAGRAM_TOKEN` | ✅ aynı kalır — ⚠ 60 günlük, **yenileme takibi kurulmadı** (bkz. Açık işler) |
| `MOTOR_SAGLAYICI` / `MOTOR_MODEL` | ✅ `anthropic` / `claude-sonnet-5` |
| `OPENAI_API_KEY` | ❌ **SİL** — Anthropic'e geçildi, kullanılmıyor |
| `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_WABA_ID` | ❌ **SİL** — Evolution'a geçildi, Cloud API kullanılmıyor |

- [ ] `.secrets.env.teslim` → `.secrets.env` olarak kaydet
- [ ] `cd app && npm run env` — `app/.env.local` üretilir (elle yazmaya gerek yok)

### 2.2 Veritabanı şemasını kur
```bash
cd app && node scripts/provision.mjs
```
Beklenen: 9 tablo, 9 RLS policy, "provision bitti".

### 2.3 Panel kullanıcısını aç
```bash
cd app && node scripts/kullanici-ekle.mjs fatih.altin92@gmail.com '<yeni-şifre>'
```
⚠ Şifreyi Fatih Bey belirlesin. `ErGaraj2026!` sohbet geçmişine düştü, **kullanılmayacak**.

### 2.4 Vercel'e dağıt
```bash
cd app && vercel login          # Fatih Bey'in hesabıyla
cd app && vercel link           # yeni proje: eryaman-garaj-panel
cd app && npm run yayinla       # env değişkenlerini yükler + üretime dağıtır
```
- [ ] Dağıtım bitince Vercel'in verdiği adresi not al → bu **yeni panel adresi**
- [ ] `.secrets.env` ve `app/.env.local` içindeki `NEXT_PUBLIC_PANEL_ADRES`'i bu adresle güncelle
- [ ] `npm run yayinla` komutunu **bir kez daha** çalıştır (adres değişkeni de yüklensin)

⚠ **Adres değişikliği zincirleme etki yapar.** Yeni adres belli olduktan sonra şunların hepsi güncellenmeli: pg_cron hedefi (FAZ 2.5), Meta Instagram webhook'u (FAZ 4.2), Evolution webhook'u (FAZ 3.3). Bu yüzden dağıtım, webhook'lardan **önce** gelir.

> 💡 **Kalıcı adres önerisi:** Fatih Bey'in alan adı varsa `bot.eryamangaraj.com` gibi bir alt alan adı Vercel'e bağlanabilir. O zaman ileride proje taşınsa bile webhook adresleri değişmez. 10 dakikalık iş, ileride bir günlük dert engelliyor.

### 2.5 Zamanlanmış işleri kur
```bash
cd app && npm run cron:kur
cd app && npm run cron:kur -- --durum
```
Beklenen iki iş:
- `eryaman-zamanlanmis-isler` → `*/5 * * * *` (sabah kuyruğu, 15 dk devir kuralı, takip merdiveni, bildirim kuyruğu)
- `eryaman-veri-temizligi` → `0 2 1 */2 *` (2 ayda bir veri temizliği)

---

## FAZ 3 — Evolution API / WhatsApp (~30 dk)

**Neden Evolution:** Fatih Bey WhatsApp Business uygulamasını kullanmaya devam etmek istiyor. Numara Meta Cloud API'ye taşınsaydı uygulamadan **geri dönüşsüz** düşecekti (Sözleşme Madde 7.3). Coexistence (ikisi bir arada) Meta'da Tech Provider statüsü gerektiriyor, bize kapalı.

⚠ **Riskler Fatih Bey'e anlatıldı ve kabul edildi (13 Ağustos).** Evolution gayri resmi bir yol; WhatsApp'ın bağlı cihaz mekanizmasını kullanıyor ama Meta'nın resmi API'si değil. Numara banı ihtimali resmi API'ye göre belirgin şekilde yüksek.

- [ ] **3.1** Railway → `railway.com/deploy/self-host-evolution-api` → Deploy
  - `AUTHENTICATION_API_KEY` için güçlü bir parola belirle → `EVOLUTION_API_KEY`
- [ ] **3.2** Deploy bitince Railway'in verdiği adres → `EVOLUTION_API_URL`
- [ ] **3.3** Instance oluştur (adı → `EVOLUTION_INSTANCE`), webhook adresi olarak
      `<panel-adresi>/api/webhooks/whatsapp` ver
- [ ] **3.4** QR kod üret → **Fatih Bey telefonundan**: WhatsApp Business → Ayarlar → Bağlı cihazlar → Cihaz bağla → taratır
- [ ] **3.5** `.secrets.env` + `app/.env.local` güncellenir, `npm run yayinla` tekrar koşulur
- [ ] **3.6** Gerçek bir telefondan işletme numarasına mesaj at, botun cevapladığını gör

⚠ **Bağlı cihaz oturumu telefon uzun süre kapalı kalırsa düşer.** Fatih Bey'in telefonu şarjda ve internete bağlı kalmalı. Oturum düşerse QR yeniden taranır.

---

## FAZ 4 — Instagram (Meta, ~20 dk + doğrulama bekleme)

Instagram tarafı **Meta'nın resmi API'sinde kalıyor** (14 Ağustos kararı). Gerekçe: Instagram'da gayri resmi araç kullanmanın cezası kalıcı hesap kapatma, kaybı ise takipçi tabanı + DM geçmişi + aynı portföydeki reklam altyapısı. WhatsApp'taki gibi resmi bir "bağlı cihaz" mekanizması yok.

- [ ] **4.1 İşletme doğrulaması** (Fatih Bey yapar, Meta Business Suite)
  - Gerekli: vergi levhası **+** unvan ve adresi birlikte içeren ikinci bir belge
  - Kabul edilenler: telefon/internet faturası, elektrik/doğalgaz/su faturası, banka hesap özeti
  - ⚠ **Gün alabilir.** Sözleşme Madde 4.3: Meta onaylarının beklenmesi 21 güne dahil değil, teslimi öteler.
- [ ] **4.2** Doğrulama onaylanınca app **Live mode**'a alınır (Publish düğmesi aktifleşir)
- [ ] **4.3** Meta panelinde Instagram webhook adresi yeni panel adresiyle güncellenir:
      `<panel-adresi>/api/webhooks/instagram`, doğrulama jetonu `META_WEBHOOK_VERIFY_TOKEN`
- [ ] **4.4** Abonelik kontrolü:
      `GET https://graph.instagram.com/v25.0/me/subscribed_apps` → boşsa
      `POST .../me/subscribed_apps?subscribed_fields=messages`
- [ ] **4.5** Gerçek bir Instagram hesabından DM at, mesajın panele düştüğünü gör

✅ **Kod tarafı hazır** (14 Ağustos): kanal, webhook rotası, ad çekme, sınavlar tamam. Live mode açılır açılmaz DM'ler panele düşmeye başlar, ek geliştirme gerekmez.

---

## FAZ 5 — Doğrulama (geliştirme makinesi, ~20 dk)

Sırayla koşulur, hepsi geçmeden "teslim oldu" denmez.

| # | Komut | Beklenen | Bakiye |
|---|---|---|---|
| 1 | `npm run bedava:dogrula` | 15/15 · 6/6 · 6/6 · 4/4 · 23/23 · 18/18 | 🆓 |
| 2 | `npx tsc --noEmit` | çıktı yok | 🆓 |
| 3 | `npm run cron:kur -- --durum` | 2 iş aktif, son çalışmalar `succeeded` | 🆓 |
| 4 | `select public.eski_verileri_temizle(kuru => true);` | rapor döner, **hiçbir şey silmez** | 🆓 |
| 5 | `node scripts/konsol-dogrula.mjs <e-posta> <şifre>` | 15/15 | 🆓 |
| 6 | `npm run zamanlanmis:dogrula` | 12/12 (⚠ yerel dev sunucu şart) | 🆓 |
| 7 | `npm run altin-set` | 18 vaka · 31 tur · 0 kırmızı bayrak | 💰 ~$0,50 |
| 8 | `npx tsx scripts/geribildirim-dogrula.ts --tekrar=3` | 27/27 | 💰 ~$2,4 |

⚠ **7 ve 8 Fatih Bey'in kredisini harcar.** Koşmadan önce ona söyle. Kusur ararken önce tek vaka (`--vaka=`), tam regresyonu yalnızca "bitti mi" doğrulaması için sakla.

- [ ] **Uçtan uca canlı sınama:** gerçek telefondan WhatsApp mesajı → bot cevaplıyor → panelde görünüyor → randevu talebi → Telegram bildirimi düşüyor

---

## FAZ 6 — Devir ve kapanış

- [ ] **Kaynak kodu teslim et:** klasörün tamamı (`.secrets.env` **dahil**, artık onun sırları) zip ya da özel git deposu olarak
- [ ] `.ig-profile`, `.wa-profile` ve `*-yedek` klasörlerini **çıkar** — bunlar geliştirme sırasında kullanılan tarayıcı oturumları, arşiv çekmek için kullanıldı, teslimde işi yok
- [ ] **geliştirme erişimlerini kapat:** geliştirmede kullanılan Supabase/Vercel/Anthropic hesaplarındaki eski projeleri sil, ödeme yöntemlerini kaldır
- [ ] **Eski Vercel projesini sil** (`eryaman-garaj-panel.vercel.app`) — hem isim serbest kalsın hem iki panel aynı anda çalışmasın
- [ ] Fatih Bey'e panel eğitimi: gelen kutusu, devir, randevu onayı, **Bot eğitimi sekmesi**, ayarlar
- [ ] Bakım penceresi başlangıcını yaz: teslimden itibaren **1 ay**, kapsam içi

---

## Fatih Bey'in aylık gideri (Sözleşme Madde 6 — müşteride)

| Kalem | Aylık | Not |
|---|---|---|
| Anthropic (yapay zeka) | ~$33 ≈ **1.576₺** | Ölçülen, 1.400 tur, önbellek açık |
| Railway (Evolution) | ~$5 ≈ **240₺** | |
| Vercel | **0₺** | Hobby planı |
| Supabase | **0₺** | Free plan |
| **Toplam** | **~1.816₺** | |

Meta mesaj ücreti buna dahil değil. WhatsApp Evolution üzerinden gittiği için şu an ücret yok; Instagram'da 24 saatlik pencere içi mesajlar ücretsiz.

Kur: 47,7₺/$ (Ağustos 2026).

---

## Bilinen kısıtlar (Fatih Bey'e söylenmeli)

**Vercel Hobby planında:**
- Çalışma zamanı logları **~1 saat** sonra siliniyor → bu yüzden hata kayıtları artık **Supabase'e** yazılıyor (`activity_log`, `tip='hata'`), 60 gün duruyor
- Vercel Cron günde 1 kez → etkilenmiyoruz, **pg_cron** kullanıyoruz
- 100 GB veri transferi / 1M çağrı / 4 CPU saat → tahmini kullanımın çok üstünde, sorun beklenmiyor

**Supabase Free planında:**
- **Otomatik yedek yok.** İşletme kararı (14 Ağustos): konuşma geçmişinin asıl kopyası WhatsApp ve Instagram uygulamalarında zaten duruyor
- 500 MB sınırı → 2 ayda bir çalışan temizlik işi bunu güvenle altında tutuyor
- 7 gün hareketsizlikte proje duraklatılır → **bizde olmaz**, pg_cron 5 dakikada bir veritabanına dokunuyor

**Veri temizliği (`eski_verileri_temizle`), 2 ayda bir:**

| Silinir | Süre |
|---|---|
| Müşteri yazışmaları (mesajlarıyla) | 180 gün dokunulmamışsa |
| Test/mock konuşmaları | 30 gün |
| Bitmiş takip ve bildirim kayıtları | 60 gün |
| `activity_log` (hata kayıtları dahil) | 60 gün |
| Konuşması kalmamış kişi kayıtları | — |

| **Asla silinmez** | Neden |
|---|---|
| Randevu talepleri | Ticari kayıt |
| Randevusu olan konuşmalar | Talebin bağlamı |
| `durum='devir'` konuşmalar | Ekip hâlâ ilgileniyor olabilir |
| Ayarlar, bot eğitimi | İşletmenin kendi bilgisi, yaşlanmaz |

Ne silineceğini önceden görmek için (sayar, silmez):
```sql
select public.eski_verileri_temizle(kuru => true);
```

---

## Açık işler (teslimde ya da bakım penceresinde)

| İş | Aciliyet | Not |
|---|---|---|
| ~~Instagram webhook'unda mesaj kaydetme bağlantısı~~ | ✅ **BİTTİ** (14 Ağustos) | Kanal + rota tamamlandı, 10 vakalık sınavı var. Canlıda doğrulandı: imza, echo filtresi, kayıt akışı |
| ~~`channels/whatsapp.ts`'i Evolution'a çevirme~~ | ✅ **BİTTİ** (14 Ağustos) | 13 vakalık bakiyesiz sınavı var (`npm run kanal:dogrula`). Cloud API sürümü `whatsapp-cloud.ts`'te saklandı |
| Instagram jetonu 60 günlük — yenileme takibi | 🟡 Süre dolmadan | Şu an elle yenilenmesi gerekir |
| `npm audit` — 3 yüksek uyarı | 🟡 Bakım penceresi | `next@16`'ya kırıcı yükseltme istiyor |
| Doğrulama scriptleri Playwright'ı komşu projeden alıyor | 🟡 Bakım penceresi | Teslimde `devDependency` olarak eklenmeli |
| `TON-ANALIZI.md` WhatsApp verisiyle güncellenmedi | 🟢 İsteğe bağlı | Şu an sadece Instagram verisine dayanıyor |

---

## Geri dönüşü olmayan adımlar — iki kez düşün

1. **Eski Vercel projesini silmek** — silinince adres serbest kalır, başkası alabilir
2. **Numara Meta Cloud API'ye taşımak** — WhatsApp Business uygulamasından düşer (Madde 7.3). **Evolution'a geçtiğimiz için bu adım YAPILMIYOR**
3. **Eski Supabase projesini silmek** — mevcut test verisi gider. Yeni sistem çalıştığı doğrulanmadan silme
4. **geliştirme hesaplarındaki ödeme yöntemini kaldırmak** — Fatih Bey'in kartı her serviste tanımlı olduğu doğrulandıktan sonra
