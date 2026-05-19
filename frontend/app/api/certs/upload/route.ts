import { createServerSupabaseClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Tipo no permitido. Solo PDF, PNG, JPG.' }, { status: 415 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Archivo muy grande (máx 10MB)' }, { status: 413 })
  }

  const ext = file.type === 'application/pdf' ? 'pdf' : file.type.split('/')[1]
  const fileType = ext === 'jpeg' ? 'jpg' : ext
  const storagePath = `${user.id}/${uuidv4()}.${ext}`

  const buffer = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from('certifications')
    .upload(storagePath, buffer, { contentType: file.type })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: cert, error: insertError } = await supabase
    .from('certifications')
    .insert({
      user_id: user.id,
      file_url: storagePath,
      file_type: fileType,
      name: 'Procesando...',
      issuer: '',
      category: 'other',
    })
    .select()
    .single()
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:8000'
  const { data: { session } } = await supabase.auth.getSession()

  // Fire-and-forget: FastAPI updates cert row when done
  fetch(`${backendUrl}/certs/extract`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({
      file_url: storagePath,
      file_type: fileType,
      user_id: user.id,
      cert_id: cert.id,
    }),
  }).catch(console.error)

  return NextResponse.json(cert, { status: 201 })
}
