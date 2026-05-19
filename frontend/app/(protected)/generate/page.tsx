'use client'
import { useRef, useState } from 'react'

export default function GeneratePage() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFileLoad(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setText(reader.result as string)
    reader.readAsText(file)
  }

  async function handleGenerate() {
    if (!text.trim()) { setError('Ingresá el aviso laboral'); return }
    setLoading(true)
    setError(null)
    setSuccess(false)

    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_posting_text: text }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Error desconocido' }))
      setError(data.error)
      setLoading(false)
      return
    }

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'cvmaker_output.zip'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setLoading(false)
    setSuccess(true)
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-2">Generar CV + Carta</h1>
      <p className="text-sm text-gray-600 mb-6">
        Pegá el aviso laboral completo o cargá un archivo .txt.
        Vas a recibir un .zip con <strong>CV.docx</strong> y <strong>Carta.docx</strong> listos para usar.
      </p>

      <div className="mb-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt"
          onChange={handleFileLoad}
          className="hidden"
          id="posting-file"
        />
        <label htmlFor="posting-file" className="cursor-pointer text-sm text-indigo-600 hover:underline">
          Cargar desde archivo .txt
        </label>
      </div>

      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Pegá el aviso laboral completo acá — cuanto más detallado, mejor el CV generado..."
        rows={14}
        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4 resize-y"
      />

      {error && (
        <p className="text-red-500 text-sm mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          {error}
        </p>
      )}
      {success && (
        <p className="text-green-600 text-sm mb-4 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
          ✓ Descarga iniciada. Abrí el .zip para acceder a CV.docx y Carta.docx.
        </p>
      )}

      <button
        onClick={handleGenerate}
        disabled={loading || !text.trim()}
        className="w-full bg-indigo-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading
          ? '⏳ Generando CV y carta... (puede tomar 30-60 segundos)'
          : 'Generar CV + Carta de presentación →'}
      </button>

      <p className="text-xs text-gray-400 text-center mt-3">
        El generador usa toda tu experiencia y certificaciones para producir un CV ATS-optimizado con las keywords exactas del aviso.
      </p>
    </div>
  )
}
