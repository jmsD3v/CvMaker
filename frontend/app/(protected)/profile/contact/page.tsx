'use client'
import { useEffect, useState } from 'react'
import type { Profile } from '@/types'

export default function ContactPage() {
  const [profile, setProfile] = useState<Partial<Profile>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/profile').then(r => r.json()).then(setProfile)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const field = (key: keyof Profile, label: string, type = 'text') => (
    <div key={key}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={(profile[key] as string) || ''}
        onChange={e => setProfile(p => ({ ...p, [key]: e.target.value }))}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>
  )

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Datos de contacto</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {field('full_name', 'Nombre completo')}
        {field('email', 'Email', 'email')}
        {field('phone', 'Teléfono')}
        {field('linkedin', 'LinkedIn URL')}
        {field('github', 'GitHub URL')}
        {field('location', 'Ubicación')}
        <button
          type="submit"
          disabled={saving}
          className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Guardando...' : saved ? 'Guardado ✓' : 'Guardar'}
        </button>
      </form>
    </div>
  )
}
