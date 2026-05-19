'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const STEPS = ['Contacto', 'Experiencia', 'Listo']

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [contact, setContact] = useState({
    full_name: '', email: '', phone: '', linkedin: '', github: '', location: '',
  })
  const [exp, setExp] = useState({
    title: '', company: '', location: '', start_date: '', description: '',
  })

  async function saveContact() {
    setSaving(true)
    setError(null)
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contact),
    })
    setSaving(false)
    if (!res.ok) { setError('Error guardando contacto'); return false }
    return true
  }

  async function saveExperience() {
    if (!exp.title.trim()) return true // optional skip
    setSaving(true)
    setError(null)
    const res = await fetch('/api/profile/experience', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...exp, end_date: null, highlights: [] }),
    })
    setSaving(false)
    if (!res.ok) { setError('Error guardando experiencia'); return false }
    return true
  }

  async function handleNext() {
    if (step === 0) {
      if (!contact.full_name.trim()) { setError('Nombre requerido'); return }
      const ok = await saveContact()
      if (ok) setStep(1)
    } else if (step === 1) {
      const ok = await saveExperience()
      if (ok) setStep(2)
    }
  }

  if (step === 2) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl shadow p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-xl font-bold mb-2">¡Perfil creado!</h1>
          <p className="text-sm text-gray-500 mb-6">
            Podés subir tus certificaciones y generar tu primer CV.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
          >
            Ir al Dashboard →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow p-8 max-w-md w-full">
        <div className="flex gap-2 mb-6">
          {STEPS.map((s, i) => (
            <div key={s} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-indigo-600' : 'bg-gray-200'}`} />
          ))}
        </div>

        <h1 className="text-lg font-bold mb-1">
          {step === 0 ? 'Datos de contacto' : 'Primera experiencia'}
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          {step === 0 ? 'Completá tus datos básicos.' : 'Agregá tu experiencia más reciente (opcional).'}
        </p>

        {step === 0 && (
          <div className="space-y-3">
            {(['full_name', 'email', 'phone', 'location', 'linkedin', 'github'] as const).map(field => (
              <input
                key={field}
                value={contact[field]}
                onChange={e => setContact(p => ({ ...p, [field]: e.target.value }))}
                placeholder={{ full_name: 'Nombre completo *', email: 'Email', phone: 'Teléfono', location: 'Ubicación', linkedin: 'LinkedIn URL', github: 'GitHub URL' }[field]}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            {(['title', 'company', 'location', 'start_date'] as const).map(field => (
              <input
                key={field}
                value={exp[field]}
                onChange={e => setExp(p => ({ ...p, [field]: e.target.value }))}
                placeholder={{ title: 'Cargo', company: 'Empresa', location: 'Ubicación', start_date: 'Fecha inicio (YYYY-MM-DD)' }[field]}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            ))}
            <textarea
              value={exp.description}
              onChange={e => setExp(p => ({ ...p, description: e.target.value }))}
              placeholder="Descripción del rol..."
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
        )}

        {error && (
          <p className="text-red-500 text-sm mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex gap-3 mt-6">
          {step === 1 && (
            <button
              onClick={() => { setError(null); setStep(0) }}
              className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50"
            >
              Atrás
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={saving}
            className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Guardando...' : step === 1 ? 'Finalizar' : 'Siguiente →'}
          </button>
        </div>

        {step === 1 && (
          <button
            onClick={() => setStep(2)}
            className="w-full text-center text-sm text-gray-400 hover:text-gray-600 mt-3"
          >
            Saltar por ahora
          </button>
        )}
      </div>
    </div>
  )
}
