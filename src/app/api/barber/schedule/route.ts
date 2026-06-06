// GET /api/barber/schedule?idToken=... — own weekly schedule (Mon-Sun)
// PATCH                                — bulk replace own schedule
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

  const { data } = await sb
    .from('barber_schedules')
    .select('day_of_week, start_time, end_time, is_active')
    .eq('barber_id', prof.id)
    .order('day_of_week')

  return Response.json({ schedule: data ?? [] })
}

export async function PATCH(req: Request) {
  const { auth, body } = await authenticateBarber(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const entries = Array.isArray(body?.entries)
    ? (body!.entries as { day_of_week: number; start_time: string; end_time: string; is_active: boolean }[])
    : null
  if (!entries) return Response.json({ error: 'entries[] required' }, { status: 400 })

  const sb = createAdminClient()
  // Replace strategy: delete all + insert
  await sb.from('barber_schedules').delete().eq('barber_id', auth.userId)
  const rows = entries
    .filter((e) => Number.isInteger(e.day_of_week) && e.day_of_week >= 0 && e.day_of_week <= 6)
    .map((e) => ({
      barber_id: auth.userId,
      day_of_week: e.day_of_week,
      start_time: e.start_time,
      end_time: e.end_time,
      is_active: e.is_active !== false,
    }))
  if (rows.length > 0) {
    const { error } = await sb.from('barber_schedules').insert(rows)
    if (error) return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}
