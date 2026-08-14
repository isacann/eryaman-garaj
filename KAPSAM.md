# Eryaman Garaj — Yapay Zeka Yanıt Sistemi (Kapsam Dokümanı)

Bu dosya işin tek doğruluk kaynağıdır. Sözleşme ve teklif dışına çıkan hiçbir şey buraya girmez.
Kaynaklar: `OPERIQO_Kapali_Kurulum_Sozlesmesi_Eryaman_Garaj imzalı.pdf`, `eryaman-garaj-teklif-guncel.html`.

**Yan dosyalar:**
- `FIYAT-LISTESI.md` — botun fiyat kaynağı (görseller `fiyat-listesi/`)
- `TON-ANALIZI.md` — Fatih Bey'in konuşma tonu ve fiyat davranışı, gerçek DM arşivinden
- `arsiv/instagram-dm.md` — ham yazışma arşivi

---

## 1. İş künyesi

| | |
|---|---|
| Müşteri | Eryaman Garaj (Fatih Altın) |
| İş | Instagram + WhatsApp yapay zeka yanıt sistemi |
| Kurulum modu | Kapalı kurulum |
| Sözleşme | 28 Temmuz 2026 imzalı, 21 gün |
| **Teslim** | **21 Ağustos 2026** |
| Bedel | 50.000 TL (25.000 imzada + 25.000 teslimde) |
| 1. taksit | ÖDENDİ (5 Ağustos 2026) |
| Bakım | Teslimden sonra 1 ay, kapsam içi |
| Hizmetler | PPF (boya koruma), renkli kaplama, detaylı bakım |
| Adres | Eryaman, Ayaş Ankara Yolu Blv. No:368, Etimesgut / Ankara |

---

## 2. Ne kuruyoruz (sözleşme Madde 2)

1. **Mesaj alıcı** — Meta resmî API'leri üzerinden WhatsApp (Cloud API) ve Instagram DM'e bağlanma.
2. **Yanıt motoru** — Fatih Bey'in geçmiş yazışmalarından çıkarılmış tonla, verdiği hizmet ve fiyat bilgisi doğrultusunda cevap; ilgilenen kişiyi sıcak tutma; randevuya ya da işletme adresine yönlendirme.
3. **Panel** — yazışan kişiler listesi, yazışma geçmişi, mesaj trafiği.
4. **Takip** — yanıtsız kalan yazışmalara, Meta'nın izin verdiği ölçüde hatırlatma.
5. **Devir** — ekibin panelden elle cevap yazabilmesi + bildirim.

## 3. Kapsam DIŞI (yazılı)

- **Otomatik randevu / rezervasyon sisteminin kendisi.** Altyapı buna hazır kurulur, sistem yok. Ajan kendiliğinden takvim modülü yazmayacak.
- **Instagram yorumları.** Sadece DM. (İsa kararı)
- **Web sitesi sohbet widget'ı.** Demo sayfadaki widget bu işin parçası değil, karıştırılmayacak. (İsa kararı)
- Madde 2'de sayılmayan her şey. Yeni modül talebi = esaslı değişiklik, yazılı mutabakat + ayrı bedel.

---

## 4. Kilitlenen kararlar (İsa, 7 Ağustos 2026)

| # | Konu | Karar |
|---|---|---|
| 1 | Fiyat politikası | Kural uydurulmadı, **gerçek yazışmalardan çıkarıldı** (Instagram DM arşivi, 7 Ağustos 2026). Ayrıntı için aşağıdaki "Fiyat davranışı" bölümü. |
| 2 | Fotoğraf | Bot araç fotoğrafına **bakar**, analiz eder (model, renk, durum), notu panele düşer. **Fotoğrafa bakarak fiyat kesmez**; fiyat için araç ve kapsamı yine sorar. |
| 3 | Randevu | Bot uygun saati konuşur, **randevu talebi panele düşer**, ekip teyit eder. Ekip panelde "Onayla" der, **teyit mesajını bot yazar** (tek tık). |
| 4 | Devir | Panelden elle cevap yazılır, bot susar. Devir istendiğinde ekip 15 dakika yazmazsa bot "ekibimiz birazdan dönecek" der, müşteri soğumaz. |
| 5 | Çalışma saati | **08:00 - 01:00** bot tam çalışır. 01:00 - 08:00 arası **cevap vermez**, tek "mesai saatleri dışındayız" mesajı atar, sohbet kuyruğa alınır, 08:00'de bot asıl cevabı yazar. |
| 6 | Takip merdiveni | **3. saat** (pencere içi, ücretsiz) → **20. saat** (pencere içi, ücretsiz) → **24 saat sonrası tek onaylı şablon** (ücretli, İsa onayladı). Kesme: müşteri cevap verdiyse, ilgilenmiyorum dediyse, ekip devraldıysa. |
| 7 | Bildirim kanalı | **Telegram** (Fatih Bey kuracak). Panelde de işaret. |
| 8 | Bot kimliği | "Eryaman Garaj" adına konuşur. "Sen robot musun" diye sorulursa saklamaz. |
| 9 | Bot numarası | **0531 734 26 59** (işletme numarası). Fatih Bey'in kişisel hattı 0536 632 26 37, ona DOKUNULMAZ. |
| 10 | Panel kullanıcısı | **Tek kullanıcı, tek yetki, rol ayrımı yok.** Web, hem masaüstü hem telefon. Giriş: e-posta + şifre (sihirli link yok). |
| 11 | Hesaplar | Hepsi Fatih Bey adına açılır, teknik kurulum İsa'da. |

---

## 5. Bildirim kuralları

| Ne olduğunda | Kime | Ne zaman |
|---|---|---|
| Randevu talebi geldi | Fatih Bey (Telegram) | anlık, her saat |
| Devir gerekiyor (insan istedi / pazarlık / şikâyet / bot emin değil) | Fatih Bey | anlık, her saat |
| Sıcak müşteri (araç bilgisi + fiyat sorusu) | Fatih Bey | 08:00-00:00 anlık, gece sabaha ertelenir |
| Sistem sorunu (kanal koptu, token düştü) | **Operiqo** | anlık |

Bildirimin altında "Panelde aç" ve "Devral" butonu olur.

---

## 6. Meta gerçekleri (ajan bunları bilmek zorunda)

- **24 saatlik müşteri hizmetleri penceresi:** müşteri yazdıktan sonra 24 saat boyunca serbest metin gönderilebilir. Sonrasında SADECE Meta'nın onayladığı şablon mesaj gider ve ücretlidir. Takip merdiveni bu yüzden 3. ve 20. saatte kurgulandı.
- **Madde 7.3:** numara Cloud API'ye taşınınca WhatsApp Business uygulamasından düşer. **Geçmiş yazışmaların arşivi taşımadan ÖNCE alınmalı**, sonra erişilemez.
- **Madde 4.3:** Meta onaylarının (işletme doğrulaması, API erişimi, şablon onayı) beklenmesi 21 güne dahil değil, teslimi öteler. Şablon onayı reddedilebilir; teslim buna bağlanmaz.
- **Madde 6:** Meta mesaj ücreti, yapay zeka kullanım bedeli, sunucu, alan adı: hepsi müşteride, hesaplar onun adına.
- **Madde 9.2:** botun verdiği fiyat/bilgi hatalarının ticari sonucu müşteride. Yine de fiyat kurgusu ihtiyatlı olacak (bkz. karar 2).

---

## 7. Mimari

Tek Next.js uygulaması, Vercel'de. Parça sayısı ne kadar azsa teslim o kadar temiz.

```
Meta (WhatsApp Cloud API + Instagram DM)
        │  webhook
        ▼
  /api/webhook/meta ──► yanıt motoru (Anthropic API)
        │                    │ ton profili + hizmet/fiyat bilgisi + kurallar
        │                    │ fotoğraf analizi (görsel okuma)
        ▼                    ▼
   Supabase (Postgres)   Meta Send API ──► müşteri
   konuşmalar, mesajlar,
   kişiler, randevu talepleri,
   takip kuyruğu, ayarlar
        │
        ├──► Panel (aynı uygulama, Supabase Auth, canlı inbox)
        ├──► Supabase pg_cron ──► /api/cron ──► sabah kuyruğu, 15 dk kuralı,
        │                                        takip merdiveni, bildirim kuyruğu
        └──► Telegram bot ──► Fatih Bey'e bildirim
```

⚠ Zamanlayıcı **Vercel Cron değil, Supabase pg_cron**: Vercel'in Hobby planında cron günde yalnızca bir kez çalışabiliyor, daha sık bir ifade dağıtımı hata veriyor. Günde tek tetiklemeyle ne 3. saat takibi ne de 15 dakika kuralı işler. Supabase zaten altyapıda, pg_cron ücretsiz katmanda mevcut, ek hesap ya da masraf yok.

**Model:** `claude-opus-5` varsayılan. Mesaj başı maliyet müşteride olduğu için (Madde 6) İsa isterse `claude-sonnet-5`'e çekilir; bu bir maliyet kararıdır, teknik zorunluluk değil.

**Hesap sahipliği (teslimde sorun çıkmasın diye):**

| Katman | Hesap | Kim kurar |
|---|---|---|
| Meta Business + WABA + Instagram | Eryaman Garaj | Fatih Bey açar, Operiqo partner erişimi alır |
| Supabase (ayrı proje) | Eryaman Garaj (fatih.altin92@gmail.com) | Operiqo kurar |
| Vercel | Eryaman Garaj | Operiqo kurar |
| Anthropic API | Eryaman Garaj | Operiqo kurar, kart Fatih Bey'in |
| Telegram bot | Eryaman Garaj | Operiqo kurar, Fatih Bey /start yazar |

Teslimde devir diye ayrı bir iş kalmaz, sistem zaten onun hesaplarında çalışıyor olur. Operiqo erişimden çıkar, o kadar.

**Erişim yöntemi (kritik):** Instagram/WhatsApp için **kullanıcı adı + şifre İSTENMEZ**. Meta Business Suite üzerinden varlık erişimi verilir (Fatih Bey, Operiqo'yu iş ortağı olarak ekler). Şifre paylaşmak hem güvensiz hem iki adımlı doğrulamada kırılır.

---

## 8. Bot davranış kuralları (yanıt motoru sistem promptunun omurgası)

1. Eryaman Garaj adına konuşur, Fatih Bey'in tonuyla. Ton, gerçek yazışmalardan çıkarılır, uydurulmaz.
2. **Fiyat davranışı** (Fatih Bey onayı, 8 Ağustos 2026 + veriyle doğrulandı):
   - **Fiyatla açmaz.** Fatih Bey'in kuralı: *"Müşteri genelde fiyat soruyor, akıcı bir sohbetten sonra en son fiyat verilebilir."* Bot önce sohbeti kurar, aracı ve kapsamı netleştirir, fiyatı **konuşmanın sonunda** verir.
   - Sorma sırası: marka/model/yıl → kaç parça / kaç cam → mevcut durum (üzerinde film var mı, güncel renk).
   - Kapsam netleştiyse ve rakam `FIYAT-LISTESI.md`'de varsa **net fiyat verir**, yanına ürün + garanti + mikron ekler ("Global PPF, 5 yıl garanti, 190 mikron").
   - Genel "fiyatlarınız nedir" sorusuna **fiyat listesini yollar**.
   - İş büyük ya da listede yoksa (komple kaplama, obsidyen dönüşüm, hasarlı parça onarımı, çoklu araç) **numara ister ve devreder**.
   - **Listede olmayan rakamı asla uydurmaz.**
   - **SUV / binek fiyat farkı YOK.** Araç tipine göre fiyat değiştirmez, "SUV'da fark olabilir" demez.
   - **İndirim:** bot indirim vermez ama kapıyı kapatmaz. Fatih Bey'in verdiği cümle: *"İndirim şansımız oluyor evet, firma yetkilimiz ile görüşüp size dönüş yapabilirim."* Ardından **Fatih Bey'e bildirim atar**. Rakam pazarlığına girmez.
3. Fotoğrafa bakar, aracı okur, **fotoğraftan fiyat kesmez**, araç ve kapsamı sorar.
4. İlgilenen müşteriye gün/saat sorar, talebi panele düşürür, "ekibimiz teyit edip dönecek" der. Takvime kendi kaydetmez.
5. Cevabını bilmediği, pazarlık, şikâyet, "insanla görüşmek istiyorum" durumlarında devre çıkar, ekibe bildirim atar.
6. 01:00-08:00 arası tek mesai dışı mesajı, sabah devam.
7. Robot olup olmadığı sorulursa saklamaz.
8. Yalan söylemez, olmayan hizmeti vaat etmez, sözleşmede olmayan iş (ör. araç satışı) için söz vermez.

---

## 9. Fatih Bey'den gerekenler (Madde 7)

- [ ] **Meta İŞLETME DOĞRULAMASI** (vergi levhası / ticaret sicil belgesiyle Meta Business Suite'ten). Tek adım, hem WhatsApp'ın hem Instagram'ın kapısını açıyor. App Review gerekmiyor — Meta'nın kendi belgesi: *"If you are a direct developer and only access your own business data, you do not need to undergo App Review"*. Gerçek bekleme kalemi bu doğrulama ve uygulamanın Live moda alınması.
- [ ] **Geçmiş WhatsApp yazışmaları** (web'den giriş yapılıp arşiv çekilecek, numara taşınmadan önce)
- [ ] Instagram hesabına Meta Business üzerinden erişim (şifre değil)
- [ ] Hizmet ve fiyat listesi (İsa iletecek)
- [ ] Telegram kurulumu + bota /start
- [ ] Servis hesapları için kart bilgisi (Meta mesaj ücreti, yapay zeka, sunucu)
- [ ] Numara taşımaya onay (Madde 7.3 sözlü hatırlatma)

## 10. İş sırası (16 gün)

1. **Ton çıkarma** — WhatsApp Web'den geçmiş yazışmalar çekilir, ton ve fiyat davranışı profili çıkarılır. (Meta'ya bağımlı değil, ilk iş bu.)
2. **İskelet** — uygulama, veritabanı, panel kabuğu.
3. **Yanıt motoru** — ton profili + kurallar + fotoğraf okuma; sahte kanalla test edilir.
4. **Meta bağlantısı** — doğrulama gelince webhook + Cloud API + Instagram DM.
5. **Takip + bildirim + devir.**
6. **Şablon onayı** (paralel, teslimin şartı değil).
7. **Gerçek testler, teslim, 1 ay bakım.**

## 11. Ajanın uyacağı kurallar

- Bu dokümanda olmayan özelliği kendiliğinden ekleme. Kapsam genişlemesi paraya ve süreye bağlıdır.
- Sahte veri, uydurma fiyat, uydurma müşteri yorumu yazma.
- Fatih Bey'in gerçek verisi gelmeden yer tutucu kural yazacaksan, dosyanın başına açıkça "YER TUTUCU" yaz.
- Anahtarlar (`.env`) asla depoya girmez.
- Her adımda çalışan hali göster: build temiz, test geçiyor, ekran görüntüsü var.
