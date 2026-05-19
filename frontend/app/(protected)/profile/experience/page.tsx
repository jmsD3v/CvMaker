'use client'
import { useEffect, useState } from 'react'
import type { Experience } from '@/types'

const emptyExp = (): Partial<Experience> => ({
  title: '', company: '', location: '', start_date: '', end_date: null, description: '', highlights: [],
})

export default function ExperiencePage() {
  const [items, setItems] = useState<Experience[]>([])
  const [editing, setEditing] = useState<Partial<Experience> | null>(null)
  const [isNew, setIsNew] = useState(false)

  async function load() {
    const res = await fetch('/api/profile/experience')
    setItems(await res.json())
  }

  useEffect(() => { load() }, [])

  async function save() {
    if (!editing) return
    const method = isNew ? 'POST' : 'PATCH'
    const url = isNew ? '/api/profile/experience' : `/api/profile/experience/${editing.id}`
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    })
    setEditing(null)
    load()
  }

  async function remove(id: string) {
    if (!confirm('¿Eliminar esta experiencia?')) return
    await fetch(`/api/profile/experience/${id}`, { method: 'DELETE' })
    load()
  }

  if (editing) return (
    <div>
      <h1 className="text-xl font-bold mb-6">{isNew ? 'Nueva experiencia' : 'Editar experiencia'}</h1>
      <div className="space-y-4">
        {(['title', 'company', 'location'] as const).map(k => (
          <div key={k}>
            <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">{k}</label>
            <input
              value={(editing[k] as string) || ''}
              onChange={e => setEditing(p => ({ ...p, [k]: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        ))}
        <div className="grid grid-cols-2 gap-4">
          {(['start_date', 'end_date'] as const).map(k => (
            <div key={k}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {k === 'start_date' ? 'Inicio' : 'Fin (vacío = actual)'}
              </label>
              <input
                type="date"
                value={(editing[k] as string) || ''}
                onChange={e => setEditing(p => ({ ...p, [k]: e.target.value || null }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          ))}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
          <textarea
            value={editing.description || ''}
            onChange={e => setEditing(p => ({ ...p, description: e.target.value }))}
            rows={4}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="flex gap-3">
          <button onClick={save} className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-medium">
            Guardar
          </button>
          <button onClick={() => setEditing(null)} className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg text-sm font-medium">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">Experiencia</h1>
        <button
          onClick={() => { setEditing(emptyExp()); setIsNew(true) }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + Agregar
        </button>
      </div>
      <div className="space-y-4">
        {items.map(item => (
          <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex justify-between">
              <div>
                <p className="font-semibold">{item.title}</p>
                <p className="text-sm text-gray-600">{item.company}{item.location ? ` · ${item.location}` : ''}</p>
                <p className="text-xs text-gray-400">
                  {item.start_date} — {item.end_date ?? 'Actual'}
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setEditing(item); setIsNew(false) }} className="text-sm text-indigo-600 hover:underline">
                  Editar
                </button>
                <button onClick={() => remove(item.id)} className="text-sm text-red-500 hover:underline">
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
