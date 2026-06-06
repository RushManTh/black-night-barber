// GET    /api/barber/time-off?idToken=... — own time-off entries (upcoming + recent)
// POST                                       — create time-off
import { authenticateBarber } from '@/lib/line/barber-auth'
import { verifyLineIdToken } from '@/lib/line/verify'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: Request) {
  const idToken = new URL(req.url).searchParams.get('idToken')
  if (!idToken) return Response.json({ error: 'idToken required' }, { status: 400 })
  const verified = await verifyLineIdToken(idToken)
  if (!verified.ok) return Response.json({ error: verified.error }, { status: 401 })

  const sb = createAdminClient()
  const { data: prof } = await sb
    .from('profiles')
    .select('id, role')
    .eq('line_user_id', verified.userId)
    .maybeSingle()
  if (!prof || !['barber', 'admin', 'owner'].includes(prof.role)) {
    return Response.json({ error: 'staff only' }, { status: 403 })
  }

  const since = new Date(Date.now() - 30 * 86400000).toISOString()
  const { data } = await sb
    .from('barber_time_off')
    .select('id, start_at, end_at, reason, created_at')
    .eq('barber_id', prof.id)
    .gte('end_at', since)
    .order('start_at', { ascending: false })

  return Response.json({ items: data ?? [] })
}

export async function POST(req: Request) {
  const { auth, body } = await authenticateBarber(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const startAt = typeof body?.start_at === 'string' ? body.start_at : null
  const endAt = typeof body?.end_at === 'string' ? body.end_at : null
  const reason = typeof body?.reason === 'string' ? body.reason : null

  if (!startAt || !endAt) {
    return Response.json({ error: 'start_at and end_at required' }, { status: 400 })
  }
  if (new Date(endAt) <= new Date(startAt)) {
    return Response.json({ error: 'end_at must be after start_at' }, { status: 400 })
  }

  const sb = createAdminClient()
  const { data, error } = await sb
    .from('barber_time_off')
    .insert({ barber_id: auth.userId, start_at: startAt, end_at: endAt, reason })
    .select('id')
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true, id: data.id })
}
