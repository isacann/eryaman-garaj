// Gizlilik politikası — Meta uygulama yayını (Live mode) bu adresi zorunlu tutuyor.
// Herkese açık olmalı: middleware'de /gizlilik açık yollara eklendi.

export const metadata = {
  title: 'Gizlilik Politikası — Eryaman Garaj',
  description: 'Eryaman Garaj mesajlaşma sisteminin kişisel veri işleme esasları.',
}

const GUNCELLEME = '13 Ağustos 2026'

export default function GizlilikSayfasi() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-slate-800">
      <h1 className="text-2xl font-semibold text-slate-900">Gizlilik Politikası</h1>
      <p className="mt-2 text-sm text-slate-500">Son güncelleme: {GUNCELLEME}</p>

      <Bolum baslik="Kim olduğumuz">
        <p>
          Eryaman Garaj (&ldquo;biz&rdquo;), Ankara&rsquo;da faaliyet gösteren bir araç kaplama ve
          detaylı bakım işletmesidir. WhatsApp ve Instagram üzerinden gelen müşteri mesajlarını
          yanıtlamak için bir mesajlaşma sistemi kullanıyoruz. Bu politika, o sistemde işlenen
          kişisel verileri açıklar.
        </p>
      </Bolum>

      <Bolum baslik="Hangi verileri işliyoruz">
        <ul className="list-disc space-y-1 pl-5">
          <li>Ad ve profil adınız (WhatsApp ya da Instagram hesabınızda göründüğü şekliyle)</li>
          <li>Telefon numaranız veya Instagram kullanıcı kimliğiniz</li>
          <li>Bize gönderdiğiniz mesajların içeriği ve varsa gönderdiğiniz fotoğraflar</li>
          <li>Mesaj tarih ve saatleri</li>
          <li>Reklamımıza tıklayarak yazdıysanız, hangi reklamdan geldiğiniz bilgisi</li>
        </ul>
      </Bolum>

      <Bolum baslik="Neden işliyoruz">
        <p>
          Yalnızca sorunuza cevap verebilmek, fiyat ve hizmet bilgisi iletebilmek, randevu
          taleplerinizi kaydedebilmek ve size dönüş yapabilmek için. Verilerinizi reklam
          hedeflemesi için kullanmıyoruz.
        </p>
      </Bolum>

      <Bolum baslik="Kimlerle paylaşıyoruz">
        <p>
          Mesajlarınız üçüncü kişilere satılmaz ve pazarlama amacıyla paylaşılmaz. Sistemin
          çalışması için şu hizmet sağlayıcıları kullanıyoruz: mesajların iletimi için Meta
          Platforms (WhatsApp ve Instagram), verilerin saklanması için Supabase, uygulamanın
          çalıştırılması için Vercel ve cevap metinlerinin oluşturulması için Anthropic. Bu
          sağlayıcılar veriyi yalnızca bize hizmet vermek için işler.
        </p>
      </Bolum>

      <Bolum baslik="Ne kadar süre saklıyoruz">
        <p>
          Yazışmalarınızı, hizmet ilişkisi ve olası talepleriniz için gerekli olduğu sürece
          saklarız. Silinmesini istediğinizde talebiniz üzerine kaydınızı sileriz.
        </p>
      </Bolum>

      <Bolum baslik="Haklarınız ve veri silme">
        <p>
          KVKK kapsamında verilerinize erişme, düzeltme ve silinmesini isteme hakkınız vardır.
          Bunun için bize WhatsApp&rsquo;tan yazabilir veya aşağıdaki adrese e-posta
          gönderebilirsiniz. Talebiniz en geç 30 gün içinde sonuçlandırılır.
        </p>
      </Bolum>

      <Bolum baslik="İletişim">
        <p>
          Eryaman Garaj — Ankara
          <br />
          E-posta: <a className="underline" href="mailto:fatih.altin92@gmail.com">fatih.altin92@gmail.com</a>
          <br />
          WhatsApp: 0531 734 26 59
        </p>
      </Bolum>
    </main>
  )
}

function Bolum({ baslik, children }: { baslik: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-slate-900">{baslik}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed">{children}</div>
    </section>
  )
}
