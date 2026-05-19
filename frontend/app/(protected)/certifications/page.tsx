'use client'
import { useEffect, useRef, useState } from 'react'
import type { Certification } from '@/types'

const CATEGORY_LABELS: Record<string, string> = {
  cybersecurity: 'Ciberseguridad',
  ai: 'IA / ML',
  dev: 'Desarrollo',
  industrial: 'Industrial',
  other: 'Otro',
}

const CATEGORY_COLORS: Record<string, string> = {
  cybersecurity: 'bg-red-50 text-red-700',
  ai: 'bg-purple-50 text-purple-700',
  dev: 'bg-blue-50 text-blue-700',
  industrial: 'bg-orange-50 text-orange-700',
  other: 'bg-gray-50 text-gray-700',
}

export default function CertificationsPage() {
  const [certs, setCerts] = useState<Certification[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function load() {
    const res = await fetch('/api/certs')
    setCerts(await res.json())
  }

  useEffect(() => { load() }, [])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    const form = new FormData()
    form.append('file', file)
    const res = await fetch('/api/certs/upload', { method: 'POST', body: form })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error)
    } else {
      await load()
    }
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold">Certificaciones</h1>
          <p className="text-sm text-gray-500">{certs.length} certificados</p>
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={handleUpload}
            className="hidden"
            id="cert-upload"
          />
          <label
            htmlFor="cert-upload"
            className={`cursor-pointer bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
          >
            {uploading ? 'Subiendo...' : '+ Subir certificado'}
          </label>
        </div>
      </div>

      {error && <p className="text-red-500 text-sm mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>}

      <div className="space-y-3">
        {certs.map(cert => (
          <div key={cert.id} className="bg-white border border-gray-200 rounded-xl p-4 flex justify-between items-center">
            <div>
              <p className="font-semibold text-sm">{cert.name}</p>
              <p className="text-sm text-gray-600">{cert.issuer}</p>
              <p className="text-xs text-gray-400">{cert.issued_date ?? 'Fecha desconocida'}</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${CATEGORY_COLORS[cert.category] ?? 'bg-gray-50 text-gray-700'}`}>
              {CATEGORY_LABELS[cert.category] ?? cert.category}
            </span>
          </div>
        ))}
        {certs.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-12">
            No hay certificados aún. Subí tu primer PDF o imagen.
          </p>
        )}
      </div>
    </div>
  )
}
