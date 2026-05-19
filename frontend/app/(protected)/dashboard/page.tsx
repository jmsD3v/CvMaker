import { createServerSupabaseClient } from '@/lib/supabase'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [profileRes, expRes, certRes] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user!.id).single(),
    supabase.from('experience').select('id', { count: 'exact', head: true }).eq('user_id', user!.id),
    supabase.from('certifications').select('id', { count: 'exact', head: true }).eq('user_id', user!.id),
  ])

  const name = profileRes.data?.full_name ?? 'Usuario'
  const expCount = expRes.count ?? 0
  const certCount = certRes.count ?? 0

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Hola, {name.split(' ')[0]} 👋</h1>
      <p className="text-gray-500 text-sm mb-8">Aquí está el resumen de tu perfil.</p>

      <div className="grid grid-cols-2 gap-4 mb-8 sm:grid-cols-3">
        <div className="bg-indigo-50 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-indigo-600">{expCount}</p>
          <p className="text-xs text-gray-600 mt-1">Experiencias</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-purple-600">{certCount}</p>
          <p className="text-xs text-gray-600 mt-1">Certificaciones</p>
        </div>
      </div>

      <Link
        href="/generate"
        className="block w-full bg-indigo-600 text-white text-center py-3 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
      >
        Generar CV + Carta de presentación →
      </Link>

      <div className="mt-6 grid gap-3 text-sm">
        <Link href="/profile/contact" className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl hover:bg-gray-100">
          <span>Editar contacto</span>
          <span className="text-gray-400">→</span>
        </Link>
        <Link href="/profile/experience" className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl hover:bg-gray-100">
          <span>Gestionar experiencia</span>
          <span className="text-gray-400">→</span>
        </Link>
        <Link href="/certifications" className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl hover:bg-gray-100">
          <span>Subir certificaciones</span>
          <span className="text-gray-400">→</span>
        </Link>
      </div>
    </div>
  )
}
