import { redirect } from 'next/navigation'
import { supabaseSunucu } from '@/lib/supabase/sunucu'
import YanMenu from '@/components/YanMenu'

export default async function PanelDuzeni({ children }: { children: React.ReactNode }) {
  const db = await supabaseSunucu()
  const {
    data: { user },
  } = await db.auth.getUser()

  if (!user) redirect('/giris')

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <YanMenu eposta={user.email ?? ''} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  )
}
