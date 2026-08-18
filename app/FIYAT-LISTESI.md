<!-- ÜRETİLEN KOPYA. Elle düzenleme. Kaynak: ../FIYAT-LISTESI.md, eşitleyen: scripts/fiyat-esitle.mjs -->
# Eryaman Garaj — Fiyat Listesi (botun bilgi tabanı)

Kaynak: İsa'nın ilettiği 3 görsel. Kopyaları: `fiyat-listesi/ppf-genel.png`, `fiyat-listesi/cam-filmi.png`, `fiyat-listesi/ppf-mikron-tablosu.png`.
**Bu dosya botun fiyat kaynağıdır. Burada olmayan rakamı bot uydurmaz.**
Fiyat güncellendiğinde bu dosya güncellenir, bot otomatik yeni fiyattan konuşur.

---

## 1. PPF (boya koruma filmi) — TL

| Ürün | Garanti | Mikron | Kaput | Ön 3 parça | Ön 4 parça | Komple |
|---|---|---|---|---|---|---|
| **Global PPF** | 5 yıl | 190 | 10.000 | 18.000 | 25.000 | 75.000 |
| **XPEL Xtreme PPF** | 5 yıl | 190 | 13.000 | 26.000 | 35.000 | 100.000 |
| **XPEL EXO Armor** | 7 yıl | 200+ | 16.250 | 32.500 | 43.750 | 125.000 |
| **XPEL Ultimate Plus** | 10 yıl | 200 | 22.100 | 44.200 | 59.500 | 170.000 |
| **XPEL Ultimate Fusion** | 10 yıl | 200 | 24.700 | 49.400 | 66.500 | 190.000 |

### Mat seri

🚫 **KISMİ MAT UYGULAMA YAPILMIYOR** (Fatih Bey, 11 Ağustos: *"Mat kısmi yapılmıyor"*).
Mat PPF **yalnızca komple** uygulanır: Xtreme Mat **110.000₺** (5 yıl),
Ultimate Stealth **175.000₺** (10 yıl).
Müşteri kaput / ön 3 / ön 4 parça **mat** isterse bot **devretmez, net söyler**:
mat uygulamayı sadece komple yapıyoruz. İstenirse komple mat fiyatı verilir ya da
parlak seride kısmi seçenekler anlatılır. (10 Ağustos'taki "kapsamı al, ekibe
devret" talimatı bununla değişti — devredilecek bir şey yok, cevap belli.)

⚠ **MAT SERİDE GLOBAL YOKTUR.** Mat kaplama yalnızca XPEL ürünleriyle yapılır
(Xtreme MAT ve Ultimate Stealth). Müşteri mat isteyip "daha uygun bir marka var
mı" derse Global önerilemez — mat seride tek marka XPEL'dir, sadece iki kademe
arasında seçim yapılır. Yukarıdaki parlak seri fiyatları (Global 18.000 vb.)
MAT işler için KULLANILAMAZ.

| Ürün | Garanti | Mikron | Komple |
|---|---|---|---|
| **XPEL Xtreme PPF (MAT)** | 5 yıl | 190 | **110.000** |
| **XPEL Ultimate Stealth (MAT)** | 10 yıl | 200 | **175.000** |

⚠ Bu tabloda **bilerek yalnızca komple sütunu var.** Kısmi mat (kaput / ön 3 /
ön 4) sütunları 10 Ağustos'ta kaldırıldı: Fatih Bey'in listesinde yoklar ve
tabloda dururken bot boşluğu doldurmak için **fiyat uyduruyordu** (45.000₺,
55.000₺ gibi). 11 Ağustos'ta sebebi netleşti: **kısmi mat diye bir hizmet yok.**
Rakam eksik değil, iş yapılmıyor.

**Ürün konumlandırması (bot bu dille anlatır):**
- Global PPF: giriş seviyesi, taş izi + çizilme + UV koruması
- XPEL Xtreme: üstün parlaklık, günlük kullanım için ideal, 5 yıl garanti
- XPEL EXO Armor: **EN ÇOK TERCİH EDİLEN**, maksimum dayanım, en yüksek darbe ve taş izi direnci, 7 yıl garanti
- XPEL Ultimate Plus: self healing (kendini onaran), hidrofobik yüzey, sararma yapmaz, 10 yıl garanti
- XPEL Ultimate Fusion: ⭐ **PREMIUM**, PPF + seramik teknolojisi, 10 yıl garanti

⚠ **DÜZELTME (Fatih Bey, 10 Ağustos):** "En çok tercih edilen" ürün
**EXO Armor**'dur. Daha önce burada Ultimate Plus için yazıyordu, YANLIŞTI.
- XPEL Ultimate Fusion: PPF + seramik teknolojisi, su itici ve kir tutmaz, üst düzey parlaklık

### Kısmi kapsamların parça dökümü (Fatih Bey, 16 Ağustos 2026)

Sahada bot "ön 4 parça"nın içeriğini UYDURDU ("kaput, ön tampon, farlar ve
aynalar" dedi). Doğrusu ve tek kaynak burası:

- **Ön 4 parça = kaput + sağ-sol ön çamurluklar + ön tampon.** Farlar ve
  kapı eşikleri de bu kapsama dahil edilir (parça sayılmaz, dahildir).
  Ayna YOK.
- **Ön 3 parça = kaput + sağ-sol ön çamurluklar** (ön tampon YOK). Farlar
  ve kapı eşikleri yine dahil.
- (17 Ağustos 2026, Fatih Bey'in kesin dökümü — 16 Ağustos'taki türetilmiş
  tanımın yerini alır. Bot her iki kapsamda da farları ve kapı eşiklerini
  "dahil" diye sayabilir; ayna hiçbir kapsamda söylenmez.)

### TÜM KOMPLE KAPLAMALARDA DAHİL (Fatih Bey, 10 Ağustos 2026 — GÜNCEL)

Komple PPF bir "film" değil, paket. Fiyat verilirken bunlar da sayılır:

- Ön 2 cam filmi
- Araç içi deri bakımı
- Kapı eşikleri
- Jant seramiği

⚠ **SERAMİK KAPLAMA PAKETE DAHİL DEĞİL** (Fatih Bey, 16 Ağustos 2026:
"PPF kaplamada seramik hediye değil; JANT seramiği hediye"). 10 Ağustos
listesinde vardı, çıkarıldı — bot "seramik kaplama da dahil" DEMEYECEK.
Seramik kaplama ayrı fiyatlı hizmettir (Nasiol ZR53, 17.500₺).

⚠ Bu liste 8 Ağustos'taki listenin (far PPF, motor koruma, iç ekran koruma,
polisaj) YERİNE geçer. Çelişirlerse bu liste esastır.

⚠ **İç detaylı temizlik pakete DAHİL DEĞİL** (Fatih Bey, 11 Ağustos 2026).
10 Ağustos listesinde vardı, çıkarıldı. Dahil olanları sayarken adı geçmeyecek.
Detaylı temizlik ayrı fiyatlı bir hizmettir (12.500₺, bkz. yukarıdaki tablo).

**Teslim süresi: 2-3 iş günü.**
Satış notu (Fatih Bey'in ağzından): *"Aracınızı teslim alınır alınmaz getirmeniz, boyanın ilk günkü kondisyonunu korumak açısından en doğru tercih olacaktır."*

### Full kaplamalarda hediye (eski kampanya listesi)
Ön iki cam filmi · Araç içi deri bakımı · Kapı eşikleri · Jant seramiği · Boya koruma support paketi · Yıllık detaylı bakım
*(Kampanya, Eryaman Garaj'ın belirlediği koşullara tabidir.)*
⚠ Yukarıdaki "pakete dahil olanlar" listesi daha günceldir (8 Ağustos). Çelişirlerse güncel olan esastır.

---

## 1c. Renk değişim kaplama (renkli araç kaplama) — ⛔ BOT FİYAT VERMEZ

🚫 **BU KALEMDE RAKAM SÖYLENMEZ. DEVREDİLİR.** (Fatih Bey, 15 Ağustos 2026:
*"Renkli kaplama için fiyat vermesin, yanlış fiyat veriyor."*)

Eskiden burada iki rakam yazıyordu (Global Premium ve XPEL için birer fiyat) ve
kaynağı Fatih Bey'in 10 Ağustos'ta onayladığı **tek bir cevaptı** — BMW G20,
parlak yeşil. Sahada görüldü ki o rakamlar tek bir araca ve tek bir renge
aitmiş; bot onları her araca her renge sabit fiyat gibi söyleyince yanlış fiyat
vermiş oldu. Renk değişiminde fiyat aracın yüzey alanına, film cinsine ve
renge göre değişiyor; standart bir liste yok.

**Botun yapacağı:** hizmeti anlatır, ilgi gösterir, aracı ve isteneni öğrenir,
sonra devreder. Rakam yok, "şu civarda" yok, aralık yok.

Kalem sorulduğunda öğrenilecekler (sonraki teklifi ekip hazırlar):
- Aracın **marka/model ve model yılı**
- İstenen **renk ve doku** (parlak / mat / saten / krom)
- **Kapı içleri** dahil mi, yoksa sadece dış gövde mi

---

## 2. Cam filmi paketleri — TL

⚠ **SIRA ÖNEMLİ: cam filminde önce XPEL, sonra Global anlatılır** (Fatih Bey,
8 Ağustos). Tablo bilerek bu sırada yazıldı; bot okuduğu sırayla söylüyor.

### Cam terimleri — bunu bilmeden fiyat verilmez

| Müşterinin dediği | Karşılığı |
|---|---|
| **"5 cam komple"** | Ön cam **HARİÇ** tüm camlar: 2 ön yan + 2 arka yan + arka cam |
| **"ön cam hariç"** / "ön cam olmasın" | Aynı şey — **5 cam komple** demektir, tekrar sorma |
| **"komple" / "bütün camlar"** | 5 cam komple + ön cam (ön cam ayrı fiyatlanır) |
| **"ön 2 cam"** | Sadece sürücü + yolcu yan camı — 4.500₺ |

⚠ Ön cam **her zaman ayrı fiyatlandırılır** (XPEL XR Blue 12.000₺ / Global IR
Ceramic 7.500₺). 5 cam komple paketlerine dahil DEĞİLDİR.

Yani müşteri "ön cam hariç film istiyorum" dediyse kapsam ZATEN NETTİR:
5 cam komple. Bot "5 cam mı ön 2 cam mı" diye sormaz, doğrudan XPEL ve Global
seçeneklerinin fiyatını verir (Fatih Bey geri bildirimi, 10 Ağustos).

| Paket | Özellik | 5 cam komple |
|---|---|---|
| **XPEL HP Serisi** (maksimum performans) | %99 UV, %50-65 ısı reddi, Amerikan üretimi | **11.000** |
| **Global QDP Ceramic** (en çok tercih edilen) | %99 UV, %70-85 ısı reddi, seramik teknoloji | **10.000** |
| **Global HP Black** (ekonomik koruma) | %99 UV, %40-50 ısı reddi, bütçe dostu | **7.500** |

### Ön cam filmi premium seçenekler

| Ürün | Özellik | Fiyat |
|---|---|---|
| **XPEL XR Blue** | %95'e varan ısı reddi, mavi ton, maksimum konfor | **12.000** |
| **Global IR Ceramic** | %75-85 ısı reddi, gri ton, parlama azaltıcı | **7.500** |

### Parça cam filmi

| İş | Fiyat |
|---|---|
| **Ön 2 cam filmi** | **4.500** (Fatih Bey onayı, 8 Ağustos 2026) |

**Not (listede yazılı):** fiyatlar **sedan** araçlar için geçerlidir, **SUV ve ticari araçlarda fiyat farkı uygulanabilir**. Cam filmlerinde **ömür boyu garanti**.

---

## 2b. Ek onaylı kalemler (İsa teyidi, 8 Ağustos 2026)

Görsel listede yok ama sahada verilen ve teyit edilen fiyatlar. Bot bunları da kullanabilir.

| İş | Fiyat |
|---|---|
| **Obsidyen paketi** | **45.000₺** (tek başına) |
| **Mat PPF + Obsidyen paketi birlikte** | **145.000₺** (paket fiyatı; ayrı ayrı 110.000 + 45.000 = 155.000, birlikte 10.000₺ avantaj) |
| Komple pasta cila | 12.500₺ |
| **Detaylı araç temizliği** | **12.500₺** (Fatih Bey, 10 Ağustos) |
| PPF ön 3 parça + komple pasta cila paketi | 28.000₺ |
| Arka tampon PPF (tek parça komple uygulama) | 10.000₺ |
| Sol far + ön tampon PPF | 10.000₺ |
| Farlar | 2.500₺ |
| Ön 2 kapı camı (Global) | 4.000₺ |
| Ön cam filmi | 8.000₺ |
| Nasiol ZR53 seramik kaplama (3 yıl garanti) | 17.500₺ |
| Pasta cila + boya koruma paketi | 750₺ |

### Togg T10X — Mat PPF + Obsidiyen Dönüşüm Paketi · 145.000₺

⚠ **Bu içerik yalnızca Togg T10X için geçerli** (Fatih Bey, 8 Ağustos 2026). Başka araçta bu paket içeriğini sayma; obsidyen paketi genel fiyatı 45.000₺, mat PPF komple 110.000₺.

Pakete dahil:
- XPEL Mat PPF (%100 TPU, 190 mikron, 5 yıl garantili)
- Self-Healing (ısı ile kendini yenileyen yüzey)
- Ön 2 cam filmi
- Koltuk koruma uygulaması
- Jant seramik kaplama
- Far ve stop PPF koruması
- Premium işçilik ve maksimum kenar dönüşleri

Obsidiyen dönüşüm kapsamında (tamamı **Piano Black** görünüme dönüşür):
- Ön panjur
- Far kaşları
- Kapı alt çıtaları
- Ön tampon alt çıtaları
- Arka tampon alt difüzörü ve çıtaları
- Tüm logolar
- Jantlar

---

## 3. Yazışmalardan çıkan fiyatlar (241 sohbetlik DM arşivi)

### 3a. Görsel listeyle örtüşenler (doğrulandı, bot rahat kullanabilir)

| İş | Yazışmada | Listede |
|---|---|---|
| Global PPF ön 3 parça | 18.000₺ | 18.000₺ ✓ |
| Global PPF ön 4 parça | 25.000₺ | 25.000₺ ✓ |
| XPEL Xtreme kaput | 13.000₺ | 13.000₺ ✓ |
| XPEL Xtreme MAT komple | 110.000₺ | 110.000₺ ✓ |

### 3b. Sahada verilen fiyatlar — TEYİT EDİLDİ, tablo Bölüm 2b'ye taşındı

İsa 8 Ağustos 2026'da teyit etti. Kalemler artık onaylı listede (Bölüm 2b), bot kullanabilir.
Bu başlık geçmiş kaydı olarak duruyor, teyit bekleyen kalem kalmadı.

### 3c. Cam filmi çelişkisi — ÇÖZÜLDÜ (Fatih Bey, 8 Ağustos 2026)

> "Görseldeki fiyatlara sabit kalsın. Ön 2 cam filmi 4.500₺ ekleyebilir."

**Kural:** cam filminde **görsel liste esastır**, yazışmalardaki eski rakamlar (8.000/9.000) geçersiz.
**Listeye eklenen tek kalem: Ön 2 cam filmi 4.500₺.**

### 3d. Araç tipi farkı — GÜNCELLENDİ (Fatih Bey, 11 Ağustos 2026)

**GÜNCEL KURAL (11 Ağustos):** fiyatlandırma **standart**. Müşteri aracını söylemeden
fiyat sorarsa bot listeyi verir, araç sormak için beklemez. Fiyatı verirken şu notu
ekleyebilir: *"SUV modellerimiz için fiyatlarda değişkenlik gösterebiliyor."*

⚠ **Bu, 8 Ağustos kararını değiştirir.** O gün Fatih Bey birebir şöyle demişti:
> "Suv ve binek olarak aralarında fiyat farkı olmasın. Opsidyen paket için pasta cila için fiyatımız aynı."

ve kural "bot *SUV'da fark olabilir* DEMEZ" şeklindeydi. 11 Ağustos'ta bunun tersi
söylendi. İkisi bağdaştırılabilir: **rakamlar standart** (bot araca göre fiyat
değiştirmez, kendi kafasından zam yapmaz), ama **SUV'da değişkenlik olabileceğini
söyleyebilir**. Obsidyen paket ve pasta cila fiyatları her araçta aynıdır — o kısım
değişmedi.
⚠ Görsel listenin dipnotu ("fiyatlar sedan içindir") artık kuralla uyumlu.

---

## 4. Fiyat dışı ticari bilgiler (yazışmalardan doğrulandı)

- **Süre:** ortalama 3 iş günü (komple PPF'te 2-3 iş günü)
- **Randevu:** şart, gelmeden alınıyor
- **Ödeme:** kredi kartı var, **3 aya kadar taksit**
- **Teknik kısıt:** tek taraf cam filmi yapılmıyor (renk tonu farkı), sağ-sol birlikte değişmeli
- **Adres:** Eryaman, Ayaş Ankara Yolu Blv. No:368, Etimesgut / Ankara
- **Konum bağlantısı (Google Haritalar):** https://maps.app.goo.gl/q2yRdcAeFvipV4Hk8?g_st=ic
  ⚠ Adres sorulduğunda bağlantı DA gönderilir (17 Ağustos 2026, İsa: "bu şekilde
  atsın adresi"). Yazılı adres tek başına yetmiyor; müşteri navigasyona kendi
  yazmak zorunda kalıyordu. Bağlantı olduğu gibi, kısaltmadan yazılır.

### Verdiğimiz hizmetlerin tam listesi (eryamangaraj.com)

Bot "bu hizmeti veriyor musunuz" sorularında bu listeye bakar:

1. **PPF kaplama** (boya koruma filmi)
2. **Seramik kaplama**
3. **Renkli araç kaplama** (renk değişimi)
4. **Araç cam filmi**
5. **Detaylı araç temizliği**
6. **Pasta cila**

Eryaman Garaj **Ankara'nın XPEL yetkili uygulama merkezidir**.

### XPEL ürün bilgisi (satış dilinde kullanılır)

- **10 yıl uluslararası garanti**: çatlama, kabarma, sararma, leke ve soyulmaya karşı
- **Self-healing**: elastomerik polimerler, çizikler ısıyla (güneş ya da sıcak su) kendini onarır
- **Sıfır bulanıklık**: aracın orijinal rengini ve parlaklığını %100 yansıtır
- **Kimyasal direnç**: kuş pisliği, ağaç reçinesi, böcek kalıntısı, asit yağmuru
- **UV koruması**: zamanla sararmayı önler
- **Bilgisayarlı kesim**: DAP (Design Access Program) yazılımıyla araca özel kesim
- Havacılık ve motorsport standartlarında üretim

### Detaylı araç temizliği — 12.500₺

**Ne olduğu (bot bunu söyleyebilir):** aracın **içi ve dışı komple, detaylı
şekilde** temizlenir. Kapsam aracın durumuna göre değişir.

Fatih Bey (10 Ağustos): *"içeriği önemli değil, doğal bir şey söylesin."*
Yani bot bu soruda KAÇMAZ, devretmez, "ekibimiz netleştirsin" demez —
yukarıdaki tanımı doğal bir dille söyler ve işine bakar.

⚠ Ama **madde madde kapsam listesi UYDURMAZ** (motor yıkama, koltuk şampuanı,
seramik cila gibi tek tek işlemler sayılmaz). Sayılan her kalem taahhüt olur.
Müşteri özellikle "şu işlem dahil mi" diye sorarsa: "Aracınızı görünce ekibimiz
netleştirir" der.

⚠ **12.500₺ İKİ AYRI KALEMİN FİYATI:** komple pasta cila **ve** detaylı araç
temizliği. Bunlar farklı hizmetler, aynı rakamı paylaşıyorlar. Bot müşterinin
hangisini istediğini karıştırmaz; emin değilse hangisini kastettiğini sorar.

⚠ **Seramik kaplamada tek onaylı ürün var: Nasiol ZR53, 17.500₺, 3 yıl garanti.**
XPEL/Global gibi bir kademe listesi YOK. Fatih Bey'den gelmeden bot başka
seramik ürünü ya da kademesi anlatmaz.

⚠ **Cam filminde yasal karartma oranı bilgisi YOK.** Bot yüzde/limit söylemez,
"uygulamada mevzuata uygun çalışıyoruz, detayını ekibimiz netleştirir" der.

⚠ **Kasko / sigorta / vergi kapsamı hakkında bilgi YOK.** Bot bu sorularda
tahmin yürütmez, devreder.
