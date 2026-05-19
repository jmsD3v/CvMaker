import { createServerSupabaseClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  async function signOut() {
    'use server'
    const supabase = await createServerSupabaseClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-6">
        <span className="font-bold text-indigo-700 mr-4">CvMaker</span>
        <Link href="/dashboard" className="text-sm text-gray-700 hover:text-indigo-600 font-medium">Dashboard</Link>
        <Link href="/profile/contact" className="text-sm text-gray-700 hover:text-indigo-600 font-medium">Perfil</Link>
        <Link href="/certifications" className="text-sm text-gray-700 hover:text-indigo-600 font-medium">Certificaciones</Link>
        <Link href="/generate" className="text-sm text-gray-700 hover:text-indigo-600 font-medium">Generar CV</Link>
        <form action={signOut} className="ml-auto">
          <button type="submit" className="text-sm text-gray-400 hover:text-gray-600">Salir</button>
        </form>
      </nav>
      <main className="max-w-3xl mx-auto px-4 py-8">{children}</main>
    </div>
  )
}
