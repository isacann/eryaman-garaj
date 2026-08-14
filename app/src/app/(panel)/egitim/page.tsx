import { egitimListesi } from './eylemler'
import EgitimBolumu from './EgitimBolumu'

export const dynamic = 'force-dynamic'

export default async function EgitimSayfasi() {
  const kayitlar = await egitimListesi()

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 md:px-10 md:py-10">
      <h1 className="text-[15px] font-semibold">Bot eğitimi</h1>
      <p className="mt-1.5 text-[13px] text-metin-soluk">
        Buraya yazdıklarınızı bot bundan sonraki tüm cevaplarında kullanır. Bir kaydı
        silmeden geçici olarak kapatabilirsiniz.
      </p>

      <div className="mt-8 space-y-10">
        <EgitimBolumu
          tur="bilgi"
          baslik="Bilgi ekle"
          aciklama="İşletmeye dair kalıcı bilgi: yeni bir hizmet, garanti şartı, çalışma usulü, sık sorulan bir sorunun doğru cevabı. Dokümanınız varsa metnini buraya yapıştırabilirsiniz."
          ornekBaslik="Seramik kaplama kademeleri"
          ornekIcerik="Nasiol ZR53 tek kademe uyguluyoruz. 2 yıl ömürlü, yıkamaya dayanıklı. Üstü için ayrı bir kademe yok."
          kayitlar={kayitlar.filter((k) => k.tur === 'bilgi')}
        />

        <EgitimBolumu
          tur="davranis"
          baslik="Geri bildirim (ton ve davranış)"
          aciklama="Botun nasıl konuşacağına dair notlar. Bilgi değil, üslup: neyi nasıl söylesin, neyi yapmasın. Fatih Bey'in test sırasında takıldığı şeyler buraya yazılır."
          ornekBaslik="Randevu sorusunda"
          ornekIcerik="Sadece saat sorup bırakmasın; iletişim numarasını isteyip 'size hemen dönüş sağlıyoruz' desin."
          kayitlar={kayitlar.filter((k) => k.tur === 'davranis')}
        />

        <EgitimBolumu
          tur="reklam"
          baslik="Reklam kampanyaları"
          aciklama="Reklamdan gelen müşteriye anlatılacak kampanya. Meta bize reklamın kimliğini ve başlığını gönderiyor ama kampanya/indirim bilgisini GÖNDERMİYOR — o yüzden buradan tanımlanır. Anahtar olarak reklam kimliğini ya da reklam başlığında geçen bir kelimeyi yazın."
          anahtarli
          ornekBaslik="Ağustos cam filmi kampanyası"
          ornekIcerik="Bu reklamdan gelenlere 5 cam komple XPEL HP 9.500₺ (normal 11.000₺). Ay sonuna kadar geçerli."
          ornekAnahtar="cam filmi"
          kayitlar={kayitlar.filter((k) => k.tur === 'reklam')}
        />
      </div>
    </div>
  )
}
