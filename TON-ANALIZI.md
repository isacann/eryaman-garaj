# Eryaman Garaj — Ton ve Davranış Analizi (Instagram DM)

Kaynak: `arsiv/instagram-dm.md` · **241 sohbet, 163'ü mesajlı, 901 satır** (343 müşteri + 558 işletme).
7 Ağustos 2026'da Primary kutusundan çekildi. 13 sohbet açılamadı, General ve İstekler sekmeleri taranmadı.
Bu dosya yanıt motorunun ton kaynağıdır; fiyat kaynağı ayrı: `FIYAT-LISTESI.md`.

---

## 1. Selamlama (gerçek sayılarla)

| Kalıp | Kaç kez |
|---|---|
| `Merhabalar` (tek başına) | 63 |
| `Hoşgeldiniz. Aracınızın marka/modeli nedir? Memnuniyetle yardımcı olalım sizlere.` | 48 |
| `[İsim] bey merhabalar` | 9 |
| `Rica ederiz` (kapanış) | 9 |

Hitap **"siz"**, isim biliniyorsa **"[İsim] bey"**. "Hocam" sadece müşteriden gelir, işletme kullanmaz.
En belirgin fiil kalıbı: **"yardımcı olmak"** (60 kez) — "yardımcı olalım", "yardımcı olurum", "10.000₺'den yardımcı olurum".

## 2. Fiyat davranışı (üç yol, sayılarıyla)

| Davranış | Kaç kez | Kalıp |
|---|---|---|
| **Fiyat listesi yollar** | 39 | "Fiyat listemizi yönlendiriyorum" |
| **Net fiyat verir** | 32 | "Ön 3 parçanız için 18.000₺" |
| **Numara ister, devreder** | 19 | "Detaylı bilgi vermek için iletişim numaranızı bırakırsanız en yakın sürede müşteri danışmanımız sizinle iletişime geçecektir." |

Net fiyat verirken **ürün + garanti + mikron** ekleniyor (10 kez): "Global Markası 5 yıl garanti 190 mikron kalınlığında", "Xpel mat ppf 5 yıl garantili 190 micron".

**Fiyat öncesi bilgi toplama sırası:**
1. Araç marka/model/yıl → "Aracınızın marka/modeli nedir?"
2. Kapsam → "kaç cam olacak?", "Ön 3 parçanız için mi", "Sadece opsidyen detay mı?", "Global serimizden mi olacaktı?"
3. Mevcut durum → "Üzerinde cam filmi mevcut mu", "güncel renginiz nedir?"
4. Bazen plaka → "Plakanızı bizimle paylaşabilir misiniz"

**Numara istenen işler:** komple kaplama, obsidyen dönüşüm, çoklu araç, hasarlı parça onarımı. Yani büyük ve kişiye özel işler.

## 3. Müşteri ne soruyor (343 müşteri satırı)

| Konu | Kaç kez |
|---|---|
| Fiyat / ücret / "ne kadar" | 68 |
| PPF | 58 |
| Cam filmi | 42 |
| Mat kaplama | 17 |
| Obsidyen | 13 |
| Taksit / kart | 6 |
| Adres, "yeriniz nerede" | 4 |
| Randevu | 4 |
| Süre, "kaç gün" | 2 |
| Seramik kaplama | 2 |

Mesajların büyük kısmı **reklamdan** geliyor ve hazır kalıpla başlıyor:
"PPF Kaplama fiyatlarınız hakkında bilgi alabilir miyim ?" · "Cam Filmi Kampanyanız hakkında bilgi alabilirmiyim."

**Sonuç: gelen trafiğin neredeyse tamamı fiyat sorusu.** Botun bir numaralı işi bu, ikinci işi araç ve kapsamı netleştirmek.

## 4. Ticari bilgiler (yazışmalardan doğrulandı)

- **Süre:** "Ortalama 3 iş gününde aracınız teslim olmuş oluyor"
- **Randevu:** şart ("gelmeden randevu almak gerekiyor değil mi" → "Evet Deniz bey")
- **Ödeme:** kredi kartı var, **3 aya kadar taksit**
- **Teknik kısıt:** tek taraf cam filmi olmuyor, renk tonu farkı yüzünden sağ-sol birlikte
- **Adres cevabı:** "ERYAMAN GARAJ | XPEL Yetkili Uygulama Merkezi · Etimesgut, Ankara"
- **Markalar:** Global, XPEL (Xtreme / EXO Armor / Ultimate Plus / Ultimate Fusion / Stealth), Nasiol ZR53

## 5. Botun çözeceği acılar (arşivden birebir)

- **Cevapsız kalma.** Vedat Teke: Cumartesi 17:36 fiyat sordu → 20:53 "Hocam ?" → cevap 22:20 → Pazartesi tekrar fiyat istedi → **"Hocam cevap vermediniz"**. Bu müşteri hâlâ bekliyor.
- **Geç dönüş = kayıp müşteri.** Fransa'dan gelen müşteri (Audi A4, mat kaplama + cam filmi): süre geç netleşince **"Zamanımız epey kısıtlıymış, sizinle daha önce iletişime geçmem gerekirdi. Bu süre içinde yetiştirmek çok zor olur sanırım."** diyerek düştü.
- **İletilmeyen mesaj:** "Kusura bakmayın mesaj iletilmemiş"
- **Aynı otomatik karşılamanın iki kez gitmesi** (Ahmetcan İlhan, Metin Tan)
- **Gece biriktirme:** Perşembe 23:26-23:49 arasında bir yığın cevap toplu gitmiş.

## 6. Yanıt motorunun ton kuralları (bu analizden çıkan)

1. Selam: `Merhabalar` ya da isim varsa `[İsim] bey merhabalar`. Kısa, tek satır.
2. Hitap hep **siz**. "Hocam" deme.
3. Fiyat vermeden önce **araç + kapsam + mevcut durum** sor. Tek soruyla değil, sahadaki gibi kısa kısa sor.
4. Fiyatı **"... ₺'den yardımcı olurum"** kalıbıyla ver, yanına ürün + garanti + mikron ekle.
5. Genel fiyat sorusunda **fiyat listesini yolla**.
6. Büyük/karmaşık işte **numarayı iste ve devret** (Fatih Bey'in kalıbı hazır, aynen kullanılabilir).
7. Kapanış: `Rica ederiz`, `Tamamdır görüşmek üzere`.
8. Mesajları **kısa ve parça parça** yaz, tek uzun blok değil. Sahadaki ritim bu.
9. Aynı mesajı iki kez gönderme.

## 7. Eksik kalan

- **13 sohbet açılamadı** (arama sonucu gelmedi ya da açılmadı).
- **General ve İstekler (Request) sekmeleri taranmadı.** İstekler'de 1 bekleyen var.
- **WhatsApp arşivi hâlâ alınmadı.** Numara Cloud API'ye taşınmadan önce alınmalı, sonra o geçmişe erişilemez.
