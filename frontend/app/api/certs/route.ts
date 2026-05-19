import { createServerSupabaseClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('certifications')
    .select('id, name, issuer, issued_date, category, file_type, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  return NextResponse.json(data ?? [])
}
