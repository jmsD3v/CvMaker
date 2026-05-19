'use client'
import { useEffect, useState } from 'react'
import type { Education } from '@/types'

export default function EducationPage() {
  const [items, setItems] = useState<Education[]>([])

  async function load() {
    const res = await fetch('/api/profile/education')
    setItems(await res.json())
  }

  useEffect(() => { load() }, [])

  async function toggleStatus(item: Education) {
    const newStatus = item.status === 'in_progress' ? 'completed' : 'in_progress'
    const updates: Partial<Education> = { status: newStatus }
    if (newStatus === 'completed' && !item.end_year) {
      updates.end_year = new Date().getFullYear()
    }
    await fetch(`/api/profile/education/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    load()
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Educación</h1>
      <div className="space-y-4">
        {items.map(item => (
          <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4 flex justify-between items-center">
            <div>
              <p className="font-semibold">{item.degree}</p>
              <p className="text-sm text-gray-600">{item.institution}</p>
              <p className="text-xs text-gray-400">
                {item.start_year}{item.end_year ? ` — ${item.end_year}` : ''}
              </p>
            </div>
            <button
              onClick={() => toggleStatus(item)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                item.status === 'completed'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
              }`}
            >
              {item.status === 'completed' ? 'Completado ✓' : 'En curso — marcar completo'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
