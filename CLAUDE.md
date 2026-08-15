# CLAUDE.md — Eryaman Garaj Yapay Zeka Yanıt Sistemi

Eryaman Garaj'ın Instagram ve WhatsApp mesajlarını yanıtlayan yapay zeka sistemi. Bu dosya sistemin çalışma mantığını, kilitlenmiş iş kurallarını ve geliştirme sırasında öğrenilen dersleri tutar. Yeni bir oturum bunu okuyup kaldığı yerden devam edebilir.

Son güncelleme: **15 Ağustos 2026**

---

## Bir bakışta

| | |
|---|---|
| İşletme | Eryaman Garaj — XPEL yetkili uygulama merkezi, Ankara |
| İş | Instagram DM + WhatsApp yapay zeka yanıt sistemi |
| Bot numarası | **0531 734 26 59** (işletme hattı) |
| Aktif model | `claude-sonnet-5` (`MOTOR_SAGLAYICI=anthropic`) |
| WhatsApp | Evolution API (kendi sunucumuz, Railway) |
| Instagram | Meta resmî API (Instagram Login) |

📦 **Teslim/kurulum yapıyorsanız → `TESLIM.md`.** Hesap devri, kurulum sırası, doğrulama listesi ve geri dönüşü olmayan adımlar orada.

---

## 1. Sistem ne yapıyor

Müşteri WhatsApp ya da Instagram'dan yazınca:

1. Mesaj webhook'a düşer, veritabanına kaydedilir
2. Yanıt motoru konuşma geçmişi + fiyat listesi + işletme kurallarıyla cevap üretir
3. Cevap müşteriye gitmeden önce **zorunlu parça kontrolünden** geçer; eksik varsa bir kez düzeltilir
4. Cevap gönderilir, panele işlenir
5. Gerekirse takip merdiveni kurulur, randevu talebi açılır, Telegram bildirimi düşer

Ekip panelden elle cevap yazarsa bot susar. 15 dakika içinde kimse yazmazsa bot *"ekibimiz birazdan dönecek"* der.

**Çözdüğü problem, gerçek veriyle:** WhatsApp arşivinde 1.196 müşteri sorusunun cevap süresi ölçüldü — **ortanca 30 dakika**, soruların **%39'u bir saatten geç**, 55 soru bir günden geç. **242 müşteri mesajı hiç cevaplanmamış**, nezaket cümleleri ayıklandığında **102'si doğrudan satış fırsatı**. En ucuz iş 4.000₺.

---

## 2. Kilitlenmiş iş kuralları

Bunlar işletmenin kararlarıdır; değiştirmeden önce sorulmalı. Tam liste `KAPSAM.md` Bölüm 4'te.

| Konu | Karar |
|---|---|
| Çalışma saati | 08:00 – 01:00 tam çalışır. 01:00–08:00 arası tek "mesai dışındayız" mesajı, sabah devam eder |
| Proaktif sessiz saat | **22:00 – 08:00.** Botun KENDİ başlattığı mesaj (takip merdiveni + randevu hatırlatması) bu aralıkta gitmez, sabah 08:00'e kaydırılır. Gelen mesaja cevap yine 01:00'e kadar sürer — ikisi ayrı pencere (15 Ağustos) |
| Fiyatla açma | **YASAK.** *"Müşteri genelde fiyat soruyor, akıcı bir sohbetten sonra en son fiyat verilebilir"* |
| Fiyat sırası | **kapsam** (kaç parça / kaç cam) → fiyat. Araç şartı yok, standart fiyatlandırma |
| SUV/binek farkı | Rakamlar standart, bot araca göre fiyat değiştirmez. *"SUV modellerimiz için fiyatlarda değişkenlik gösterebiliyor"* diyebilir; **"fark yok" diyemez** |
| İlk cevapta rakam | **Kod kilidi var.** Kapsam belli değilse ilk turda rakam ve görsel yok; içerik anlatılır |
| Fiyat cevabı biçimi | Serilerin **tamamı** `• ürün – garanti: fiyat` diye listelenir → fiyat/performans önerisi (Xtreme) → pakete dahiller → kapanış sorusu |
| Komple PPF sırası | **XPEL Xtreme 100.000₺ önce, Global en son.** Ultimate Plus ilk teklif değil |
| Cam filmi sırası | Önce XPEL, sonra Global (PPF'in tersi) |
| Mat PPF | **Sadece komple** (110.000 / 175.000). Kısmi mat **yapılmıyor**, bot devretmez, net söyler |
| "Pahalı" itirazı | Global öner. Global bir **itiraz cevabı**, açılış değil |
| İndirim | Bot indirim vermez ama kapıyı kapatmaz: *"İndirim şansımız oluyor evet, firma yetkilimiz ile görüşüp size dönüş yapabilirim."* + devir + bildirim |
| Hasarlı parça onarımı | Bot fiyat **vermez**, devreder |
| Sigorta / kasko / vergi / hukuk | Devir zorunlu, bot iddia üretmez |
| Fotoğraf | Bot bakar, aracı okur, notu panele düşer, **fiyat kesmez** |
| Fiyat listesi görseli | Bot gönderir. Metin fiyatıyla aynı kurala tabi: kapsam netleşmeden görsel yok |
| Randevu | Bot **net gün/saat sorar**. ⛔ **İletişim numarası İSTEMEZ** (15 Ağustos, önceki karar iptal): müşteri zaten o hattan yazıyor. Kayıt panele **onay beklemeden** düşer (14 Ağustos kararı); ekip zamanı düzeltir ya da iptal eder |
| Randevu kaydı ne zaman açılır | **Sadece somut gün/saat söylenirse.** Niyet yetmez ("randevu alabilir miyim", "gelmek istiyorum", selamlama). **Kod kilidi var** (`randevuTalebiGecerliMi`): 15 Ağustos'ta "merhaba"ya bile randevu bildirimi düşüyordu |
| Randevu hatırlatması | Randevudan **24 saat önce**; o an geçmişse randevu günü **10:00**, o da geçmişse **2 saat önce**; randevuya 2 saatten az kaldıysa gönderilmez |
| Instagram'da randevu | Müşteri **WhatsApp'a yönlendirilir** (0531 734 26 59). Sebep: Instagram'da 24 saat penceresi duruyor, hatırlatma her zaman gönderilemiyor. Bir kez söylenir, ısrar edilmez |
| Takip merdiveni | **3. saat** → **20. saat**, ikisi de ücretsiz. 14 Ağustos: 20 dakikalık basamak kaldırıldı (fazla ısrarcı), 25. saat şablon basamağı da kaldırıldı (Evolution'da Meta şablonu ve 24 saat penceresi yok) |
| Ekip elle cevap yazarsa | Bot susar. **Panelden de, telefondan WhatsApp uygulamasından da** — ikisi de yazışmayı devre alır (15 Ağustos) |
| Motor patlarsa | Müşteriye **teknik hiçbir şey yazılmaz** (15 Ağustos). Devir bayrağı düşer, ekip 15 dk yazmazsa nötr cümle gider |
| Bildirim | Telegram. Randevu / devir / sıcak müşteri anlık; gece gelenler sabaha ertelenir |
| Bot kimliği | "Eryaman Garaj" adına konuşur, robot olup olmadığı sorulursa saklamaz |
| Hitap | Erkek → bey, kadın → hanım, **unisex ya da emin değilse hitap yok**, sadece ad |
| Hitapta ad | **Sadece ilk ad** (15 Ağustos). WhatsApp `pushName` tam ad getiriyor; "Asım ALTUN bey" gitti. Kod kilidi: `ilkAd()`, motorun girişinde |
| Renkli kaplama (renk değişimi) | ⛔ **Bot fiyat VERMEZ, devreder** (15 Ağustos). Standart liste yok; fiyat yüzey alanına, filme ve renge göre değişiyor. Bot hizmeti anlatır, aracı/isteneni öğrenir, ekip fiyatlar. **Ayrım:** "mat PPF" koruma kalemidir, fiyatı verilir; "kırmızı mat kaplama" renk dönüşümüdür, verilmez |

⚠ **Bir kural iki yerde yazılıyorsa ikisinin çelişmediğini kontrol et.** Bu ders üç kez tekrarlandı: karar `FIYAT-LISTESI.md` ya da `KAPSAM.md`'de güncellendi, `sistem-prompt.ts`'te eski hâli kaldı ve bot iki kaynağın arasında kaldı. **Bir karar değiştirdiğinde `sistem-prompt.ts`'i grep'le.**

---

## 3. Veri varlıkları

### Arşivler
- `arsiv/whatsapp.json` + `.md` — **904 sohbet, 4.841 mesaj**, 781'i gerçek yazışma. Mayıs–Ağustos 2026, zaman damgalı
- `arsiv/instagram-dm.json` + `.md` — **241 sohbet, 901 satır** (Primary kutusu)
- `arsiv/wa-isimler.json`, `arsiv/ig-isimler.json` — tam isim listeleri

### Analizler
- `FIYAT-LISTESI.md` — **botun tek fiyat kaynağı.** Motor bunu dosyadan okur; fiyat değişince yalnızca bu dosya güncellenir. `app/FIYAT-LISTESI.md` **üretilen kopyadır** (prebuild `fiyat:esitle`), elle düzenlenmez
  ⚠ **Listede rakam olması, o rakamın söylenebilir olduğu anlamına gelmiyor.** Renk değişimi kaleminin iki rakamı tek bir araca verilmiş tek bir cevaptan gelmişti; bot onları her araca sabit fiyat gibi söyledi. Kalem 15 Ağustos'ta listeden çıkarıldı. **Bir rakamı listeye koymadan önce sor: bu her müşteri için mi geçerli, yoksa bir kereye mahsus muydu?**
- `TON-ANALIZI.md` — ton profili (⚠ şu an sadece Instagram verisine dayanıyor, WhatsApp ile güncellenmeli)
- `altin-set.json` + `ALTIN-SET.md` — 18 gerçek konuşmadan sınav seti
- `fiyat-listesi/*.png` — fiyat görselleri (PPF, cam filmi, mikron tablosu)

### Hacim
Mayıs 662 → Haziran 1.514 → Temmuz 1.669 mesaj. Instagram dahil **~1.400 tur/ay** beklenir.

Yeniden üretmek için: `node scripts/wa-analiz.mjs`

---

## 4. Uygulama (`app/`)

**Stack:** Next.js 15 (App Router) + TypeScript strict + Tailwind v4 + Supabase + Vercel.
Çalıştır: `cd app && npm run dev` (port 3000). Kurulum: `app/README.md`.

**Tablolar:** contacts, conversations, messages, appointment_requests, followups, notifications, settings, bot_egitim, activity_log. RLS her tabloda açık. Şema tek dosya: `app/supabase/schema.sql`.

### Kanal soyutlaması (`app/src/lib/channels/`)
Uygulamanın hiçbir yeri doğrudan WhatsApp'a ya da Instagram'a bağlanmaz; her gönderim ve her gelen mesaj `types.ts`'teki `Kanal` arayüzünden geçer.

| Dosya | Durum |
|---|---|
| `whatsapp.ts` | **Evolution API** — aktif |
| `whatsapp-cloud.ts` | Meta Cloud API — kullanılmıyor, dönüş ihtimaline karşı saklanıyor |
| `instagram.ts` | **Meta resmî API** — kod tamam, ⚠ Live mode bekliyor |
| `mock.ts`, `test.ts` | Sınav ve panel test konsolu |

⚠ **Evolution'da en kritik filtre `fromMe`.** Kendi gönderdiğimiz mesaj webhook'a geri düşüyor; elenmezse bot kendi cevabını müşteri mesajı sanıp kendine cevap yazar ve sonsuz döngüye girer. Grup mesajları (`@g.us`) ve durum güncellemeleri de elenir. Hepsi `npm run kanal:dogrula` ile sınanıyor.

⚠ **`fromMe` iki yere birden bakar.** `gelenMesajiCoz` onu eler (sonsuz döngü koruması, değişmedi); `gidenEkipMesajiCoz` **yalnızca** onları toplar. İkincisi botu tetiklemez, **susturur**: Fatih Bey telefondan cevap yazınca yazışma devre geçer. Botun kendi mesajı da `fromMe` gelir — ayrım `harici_id` eşleşmesiyle yapılır (`ekipElleYazdiginiIsle`). ⚠ Bu ayrım yanlış kurulursa bot her cevabından sonra kendini devre alır ve bir daha hiç yazmaz.

⚠ **Bağlı cihaz oturumu** telefon uzun süre çevrimdışı kalırsa düşer; QR yeniden taratılmalı.

### Yanıt motoru (`app/src/lib/motor/`)
- `sistem-prompt.ts` — ton, fiyat, saat ve kimlik kuralları; fiyat tablosunu `FIYAT-LISTESI.md`'den okur
- `saglayici.ts` + `anthropic.ts` / `openai.ts` / `gemini.ts` / `sahte.ts` — model bağımsız adaptör
- `denetim.ts` — kırmızı bayraklar: uydurma fiyat, **yanlış kaleme yanlış fiyat**, fiyatla açma, kapsamsız fiyat, indirim vaadi, SUV farkı, erken fiyat görseli
- `altin-set.ts` — sınav koşucusu

**Prompt önbelleği:** prompt `<!--ONBELLEK-SINIRI-->` ile ikiye ayrılıyor — sabit önek (kimlik + ton + fiyat kuralları + tablo, ~9.800 jeton) ve konuşmaya özel bölüm (~1.100 jeton). Anthropic sabit öneke `cache_control: {ttl:'1h'}` koyuyor. **Ölçülen hit oranı %87.**
⚠ Müşteri adı promptun **sonunda** olmalı; başta olduğu sürece önbellek her müşteride kırılıyordu (hit oranı 0).

### Zorunlu-parça kilidi
Cevap müşteriye gitmeden `eksikleriBul()` kontrol eder, eksikse model **tek bir düzeltme turuyla** yeniden çağrılır. Kurallardan bazıları: `selamlama-isim`, `fiyat-listesi-eksik`, `liste-tekrari`, `kapsamsiz-ilk-fiyat`, `kapsama-dahil-kalem-fiyati`, `arac-tekrar-soruldu`, `cumle-tekrari`, `kuru-acilis`, `ozelliksiz-liste`, `kompleye-kismi-teklifi`, `fiyati-araca-bagladi`, `renk-degisiminde-fiyat`. (`randevuda-telefon-yok` **15 Ağustos'ta kaldırıldı** — Fatih Bey numara istenmesinden vazgeçti.)

**Düzeltme turuna süre bütçesi var** (`MOTOR_DUZELTME_BUTCE_MS`, varsayılan 8 sn): ilk çağrı bütçeyi aştıysa yalnızca `agir: true` işaretli eksikler (yanlış/eksik fiyat) ikinci tura çıkar. Biçimsel kusur için müşteri bir dakika daha bekletilmez. Hafif eksikler modelsiz düzeltilir (`hafifEksikleriKodlaDuzelt`).

`MOTOR_DUZELTME_LOG=1` ile hangi kuralın kaç kez tetiklendiği görülür.
⚠ **Bir kilit sık tetikleniyorsa önce "haklı mı" diye sor.** 12 Ağustos ölçümünde 81 turun 42'sinde düzeltme tetikleniyordu ve **%79'u tek kuralın yanlış alarmıydı**.

### Randevu ve hatırlatma
Bot gün/saat konuştuğunda `randevu_talebi` (müşterinin ifadesi) ve `randevu_zaman` (ISO karşılığı) alanlarını doldurur. Kayıt `appointment_requests`'e **`durum='onaylandi'`** olarak düşer — ekip onayı beklenmez.

⚠ **`randevu_zaman` kod kilidiyle doğrulanır** (`randevuZamaniCoz`): geçmiş tarih, 6 aydan uzak tarih (modelin yıl karıştırması), olmayan gün (31 Şubat) ve biçimsiz metin reddedilir. Reddedilirse talep yine panele düşer ama hatırlatma kurulmaz — yanlış güne mesaj göndermektense hiç göndermemek yeğdir.

Hatırlatma `followups` tablosunda `basamak='randevu-hatirlatma'` olarak taşınır ama **takip merdiveninin parçası değildir**; kuralları terstir:

| | Merdiven | Randevu hatırlatması |
|---|---|---|
| Sayaç | Müşterinin son mesajı | Randevu tarihi |
| Müşteri yazınca | İptal | Devam eder |
| Ekip devralınca | Durur | Devam eder |

⚠ **Katı 24 saat kuralı yetmiyordu.** Sahadaki en sık cümle "yarın getireyim" ve o randevu genellikle 24 saatten yakın; katı kuralla bu randevuların neredeyse hepsi hatırlatmasız kalıyordu. `hatirlatmaAni` üç kademeli: 24 saat önce → randevu günü 10:00 → 2 saat önce. Metin de buna göre "yarın"/"bugün" diye değişir (`ayniGunMu`), yoksa aynı gün giden mesaj yanlış gün söylerdi.

Doğrulama: `npm run randevu:dogrula` (🆓 18 vaka) · `npm run randevu:uctan-uca` (💰 ~$0,05, gerçek `botCevapla` yolundan)

### Zamanlanmış işler
`app/src/app/api/cron/route.ts` — tek rota, beş iş: sabah kuyruğu → 15 dk devir kuralı → takip merdiveni → randevu hatırlatması → bildirim kuyruğu.

⚠ **Tetikleyici Vercel Cron değil, Supabase pg_cron.** Vercel Hobby'de cron günde yalnızca bir kez çalışabiliyor. İki pg_cron işi var:

| İş | Sıklık |
|---|---|
| `eryaman-zamanlanmis-isler` | 5 dakikada bir |
| `eryaman-veri-temizligi` | 2 ayda bir |

Kurulum: `npm run cron:kur` · Durum: `npm run cron:kur -- --durum`

⚠ **Cron'un tekrarladığı bir iş, kendini kuyruktan çıkarmayı unutmuş olabilir.** 15 Ağustos'ta bir müşteri 08:00'den itibaren **her 5 dakikada bir** "Kusura bakmayın, sistemimizde anlık bir aksaklık oldu" mesajı aldı. Sabah kuyruğu (`mesaiKuyrugunuIslet`) `botCevapla`'yı çağırıyor, motor patlıyor, son çare cümlesi gidiyor — ama `meta.mesai_bekliyor` bayrağı **yalnızca başarı yolunda** temizleniyordu. Konuşma kuyrukta kalınca cron aynı hatayı sonsuza dek tekrarladı. **Kuyruktan çıkarma işlemi hata yoluna da yazılmalı**, ayrıca müşteriye giden her tekrarlanabilir cümlenin süre kilidi olmalı (`SON_CARE_KILIT_SAAT`).

### Veri temizliği
`public.eski_verileri_temizle()` — konuşmalar 180 gün, test/mock 30 gün, kuyruk ve `activity_log` 60 gün sonra silinir. **Randevu talepleri, randevusu olan konuşmalar, devirdeki konuşmalar, ayarlar ve bot eğitimi asla silinmez.**

Ne silineceğini önce görmek için: `select public.eski_verileri_temizle(kuru => true);`

### Hata kayıtları
`lib/hata-log.ts` → `activity_log` (`tip='hata'`, 60 gün). Vercel Hobby'de çalışma zamanı logları ~1 saatte siliniyor, o yüzden kalıcı iz veritabanında tutuluyor.

### Bot eğitimi
Panelde "Bot eğitimi" sekmesi, tablo `bot_egitim`. Üç tür:
- **bilgi** — kalıcı işletme bilgisi, promptun önbellekli sabit önekine girer (maliyeti artırmaz)
- **davranis** — ton/üslup notu, aynı yere girer
- **reklam** — reklamdan gelene anlatılacak kampanya; `anahtar` + `gecerli_bitis`

Eklenen metindeki rakamlar `egitimRakamlariniBul` ile izinli rakamlara ekleniyor, yoksa denetim onları "uydurma" sayardı.

⚠ **Süresi dolmuş kampanya söylenmez:** konuşma kaydı aylarca yaşıyor ve `meta.reklam` orada duruyor; tarih kontrolü olmasa ağustos kampanyası ekimde vaat edilirdi.

📣 **Meta reklam verisi:** webhook'ta reklamın kimliği + başlığı + metni geliyor, **kampanya/indirim verisi gelmiyor** — Meta'da öyle bir alan yok. Doğru kurgu: reklam metnini Meta'dan al, kampanyanın kesin rakamını panelden al.

### Panel sayfaları
`/giris`, `/` (gelen kutusu), `/sohbet/[id]` (elle cevap + devir + görsel gönderme), `/randevular`, `/egitim`, `/ayarlar`, `/test` (test konsolu, fotoğraf yükleme dahil), `/gizlilik`.

---

## 5. Doğrulama

### 🆓 Bakiye gerektirmeyenler — her değişiklikten önce/sonra koş
```bash
cd app && npm run bedava:dogrula
```

| Sınav | Ne kanıtlar |
|---|---|
| `kilit:dogrula` (26 vaka) | Kural **kodda** doğru yazılmış mı — yakalama + yanlış alarm yokluğu + **hitap adı** |
| `uctan-uca:dogrula` (6 vaka) | Model hata yaparsa kusur **müşteriye gitti mi** |
| `prompt:netlik` (6 vaka) | Promptu izleyen cevap denetimden temiz geçiyor mu — **prompt çelişkisiz mi** |
| `kampanya:dogrula` (4 vaka) | Kampanya yanlış müşteriye sızıyor mu |
| `kanal:dogrula` (29 vaka) | Her iki webhook çözücüsü — `fromMe` / `is_echo` sonsuz döngü koruması + **giden ekip mesajı çözücüsü** |
| `randevu:dogrula` (41 vaka) | Randevu tarihi çözücüsü + hatırlatma anı/metni + **randevu talebi filtresi** + **proaktif sessiz saat** |

Ayrıca: `npx tsc --noEmit`, `npm run zamanlanmis:dogrula` (⚠ yerel dev sunucu şart), `node scripts/konsol-dogrula.mjs <e-posta> <şifre>`.

### 💰 Model çağıran sınavlar
| Komut | Ne ölçer | Yaklaşık |
|---|---|---|
| `npm run altin-set` | Cevap kalitesi + kırmızı bayraklar (18 vaka, 31 tur) | ~$0,50 |
| `npm run geribildirim:dogrula` | Tüm geri bildirimler — 27 vaka × 3 tekrar | ~$2,4 |
| `npm run gorsel:dogrula` | Fiyat görseli ne zaman gider/gitmez | düşük |

⚠ **Her vaka 3 kez koşulur, kontrol ancak hepsinde geçerse geçmiş sayılır.** Eski sınav her vakayı bir kez koşuyor ve "18/18 geçti" diyordu — oysa "ilk cevapta selam + isim" kuralı 3 koşudan yalnızca 1'inde tutuyordu. **Tek koşuluk sınav yalan söyler.** Yeni sınav bunları **KIRILGAN (2/3)** diye ayrı raporlar; en tehlikeli kategori budur.

⚠ **Model varyansı gerçek.** Aynı prompt aynı soruya her zaman aynı cevabı vermiyor. **Bir bayrağı kusur saymadan önce vakayı okuyun** — koşuların yarısında bayrak botun değil denetimin hatası çıktı. Kritik kurallar (kalem-rakam eşleşmesi, Togg filtresi) **kodla kilitli**, varyanstan etkilenmiyor.

⚠ **Yeni bir motor kuralı eklerken kontrol et: sınav gerçek yoldan mı geçiyor?** Bir dönem `bot.ts` `yanitUret()` çağırırken sınavlar sağlayıcıyı doğrudan çağırıyordu; düzeltme turu eklenince sınavlar onu hiç görmeyecekti. Hepsi `yanitUret` üzerinden geçirildi.

---

## 6. Zor öğrenilen dersler

### Kural yazımı
**Kısıtlayıcı dil, kısıtlanan davranışın komşusunu da kesiyor.** Bir kural "YASAK/DUR" diliyle yazılınca model **hiç fiyat vermemeye** başladı (4 koşudan 2'sinde *"not aldım."*). Dil yumuşatılıp *"alanı doldurmamak fiyat vermemek demektir, en ağır hata"* eklenince düzeldi.

**Soyut talimat işe yaramıyor, somut çalışıyor.** *"Tekrarlama"* demek yetmedi; *"şu rakamları yazma: 11.000, 10.000, 7.500"* demek işe yaradı.

**Prompt kuralı tek başına yetmez.** Kritik kurallar üç katmanlı: (1) prompt, (2) düzeltme turu, (3) kod. Selamlama örneğinde ilk tur 4/4 ismi atlıyordu, düzeltme turu 3/4 kurtarıyordu, kalan %25 için kod cümleyi deterministik kuruyor.

**Kaldırılan kurallar bazen kusurun kaynağıdır.** Bot bir dönem "sorgu makinesi" gibi davranıyordu; sebep model değil, birikmiş üç kısıtlayıcı kuraldı ("en fazla iki seçenek göster", "önce Xtreme ile aç", "kapsam netleşmeden fiyat verme"). Üçü de kaldırıldı.

**Kod kilidi yazmadan önce "haklı mı" diye sor.** `ozelliksiz-liste` kilidi 81 turun 33'ünde yanlış alarm veriyordu: yalnızca PPF kelimelerine bakıyordu, cam filminin özellikleri farklı adlanıyor.

### Veri ve teşhis
**Veriyi kontrol etmeden "kök sebebi buldum" deme.** Konuşma hafızasında gerçek bir hata bulundu (en eski 40 mesajda takılı kalıyordu) ama canlı veriye bakınca hiçbir konuşma 40'ı aşmamıştı. Hata gerçekti ve ilk uzun konuşmada patlayacaktı — kök sebep değil, **zaman bombası**.

**Uzun koşularda her adımda diske yaz.** Arka plan işinin çıktısı bitene kadar görünmez.

### Playwright + tarayıcı otomasyonu
**Kalıcı profil:** Chromium aynı profili iki işlemde açamaz. Çekici çalışacaksa açık pencere **temiz kapanmalı** (X ile, süreç öldürerek değil).

**Instagram DM:** sohbetler link değil, satırlar tıklanarak açılır. Tıklamaları "Bildirimleri Aç" penceresi yiyor. Liste sanal kaydırmalı — **arama kutusundan** açılmalı.

**WhatsApp Web (2026-08 yapısı):**
- Satırlar `#pane-side [role="row"]`, isim = ilk `span[title]`
- Mesajlar `#main [role="row"]`. `message-in/out` sınıfları **artık yok**
- Zaman: `[data-pre-plain-text]` = `"[15:49, 07.08.2026] Ad: "`
- ⚠ **En sinsi tuzak:** arama sonuçlarında "Sohbetler", "Ortak Gruplar" gibi **bölüm başlıkları da `[role="row"]`**. Gerçek sohbet satırının işareti içinde `span[title]` olması. Bu yüzden bir tarama 584 sohbeti boş çekmişti

---

## 7. Scriptler

| Script | Ne yapar |
|---|---|
| `wa-scrape2.mjs` / `ig-scrape2.mjs` | Tam WhatsApp / Instagram taraması |
| `wa-analiz.mjs` | Hacim, cevap süresi, cevapsız mesaj analizi |
| `wa-probe*.mjs`, `ig-probe*.mjs` | DOM teşhis araçları (yapı değişirse ilk bunlar) |
| `altin-set-uret.mjs` | Arşivden sınav seti üretir |
| `supabase-kur.mjs` | Supabase projesini bulur/açar |

`app/scripts/`: `provision.mjs` (şema), `cron-kur.mjs`, `yayinla.mjs` (Vercel), `env-yaz.mjs`, `kullanici-ekle.mjs`, `konsol-dogrula.mjs`, `maliyet-olc.ts`, `gecikme-olc.ts`, `sohbet.ts` (komut satırından bota konuşma oynatır), `kilit-dogrula.ts`, `uctan-uca-dogrula.ts`, `prompt-netlik-dogrula.ts`, `kampanya-dogrula.ts`, `kanal-dogrula.ts`, `model-karsilastir.ts`.

Bota komut satırından konuşmak:
```bash
npx tsx scripts/sohbet.ts "mesaj1" "mesaj2" --ad=Ayşe
```

---

## 8. Gecikme (ölçülen)

| Senaryo | Süre |
|---|---|
| Fiyat senaryosu | 13–24 sn |
| Kısa soru | 6–9 sn |

Sabit ~5 sn taban, geri kalanın tamamı **çıktı uzunluğu**. Ölç: `npm run gecikme:olc`.

**Fiyat listesi kodla basılıyor** (`fiyatListesiUret`): model yalnızca `fiyat_listesi` alanına anahtar yazıyor (`komple-ppf`, `komple-mat`, `on-4-ppf`, `on-3-ppf`, `kaput-ppf`, `cam-filmi`), metin `FIYAT-LISTESI.md`'den üretiliyor.
⚠ Model bu alanı ~3/4 koşuda kullanıyor; kalanında listeyi kendi yazıyor (kod ayıklıyor, sonuç doğru ama süre kazanılmıyor). Bir tur daha prompt çalışması gerekiyor.

---

## 9. Açık işler

| İş | Öncelik |
|---|---|

| Meta İşletme Doğrulaması → Instagram Live mode | 🔴 **Instagram'ın tek kalan engeli** (kod 14 Ağustos'ta tamamlandı) |
| Instagram jetonu 60 günlük — yenileme takibi kurulmadı | 🟡 |
| `npm audit` — 3 yüksek uyarı (Next.js alt bağımlılıkları, `next@16` kırıcı yükseltme ister) | 🟡 |
| `fiyat_listesi` alanının kullanım oranını 4/4'e çıkarmak | 🟡 |
| `TON-ANALIZI.md`'yi WhatsApp verisiyle güncellemek | 🟢 |
| Altın seti WhatsApp vakalarıyla genişletmek | 🟢 |

**İşletmeden beklenen bilgiler:**
- Seramik kaplamada Nasiol ZR53 dışında kademe var mı
- Instagram işletme doğrulaması için vergi levhası + unvan/telefon içeren ikinci belge
