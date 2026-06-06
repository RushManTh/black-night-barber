// POST /api/waitlist  — customer joins waitlist
// GET  /api/waitlist?idToken=... — list customer's own waitlist
import { authenticate } from '@/lib/line/auth'
import { verifyLineIdToken } from '@/lib/line/verify'
import { createAdminClient } from '@/lib/supabase/admin'

const BRANCH_ID = '00000000-0000-0000-0000-000000000001'

export async function POST(req: Request) {
  const { auth, body } = await authenticate(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const serviceId = typeof body?.service_id === 'string' ? body.service_id : null
  const preferredDate = typeof body?.preferred_date === 'string' ? body.preferred_date : null
  const timeFrom = typeof body?.time_from === 'string' ? body.time_from : null
  const timeTo = typeof body?.time_to === 'string' ? body.time_to : null
  const barberId = typeof body?.barber_id === 'string' ? body.barber_id : null

  if (!serviceId || !preferredDate || !timeFrom || !timeTo) {
    return Response.json(
      { error: 'service_id, preferred_date, time_from, time_to required' },
      { status: 400 }
    )
  }

  const sb = createAdminClient()

  // Compute next position in line for the requested date
  const { data: maxRow } = await sb
    .from('waitlist')
    .select('position')
    .eq('branch_id', BRANCH_ID)
    .eq('preferred_date', preferredDate)
    .in('status', ['waiting', 'notified'])
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextPos = (maxRow?.position ?? 0) + 1

  const { data: created, error } = await sb
    .from('waitlist')
    .insert({
      customer_id: auth.userId,
      branch_id: BRANCH_ID,
      barber_id: barberId,
      service_id: serviceId,
      preferred_date: preferredDate,
      time_from: timeFrom,
      time_to: timeTo,
      position: nextPos,
    })
    .select('id, position')
    .single()

  if (error) {
    const dupe = error.message.includes('uniq_active_waitlist')
    return Response.json(
      { error: dupe ? 'คุณมีรายการรอคิวในวันนี้แล้ว' : error.message },
      { status: dupe ? 409 : 500 }
    )
  }

  return Response.json({ ok: true, waitlist: created })
}

export async function GET(req: Request) {
  const idToken = new URL(req.url).searchParams.get('idToken')
  if (!idToken) return Response.json({ error: 'idToken required' }, { status: 400 })

  const verified = await verifyLineIdToken(idToken)
  if (!verified.ok) return Response.json({ error: verified.error }, { status: 401 })

  const sb = createAdminClient()
  const { data: profile } = await sb
    .from('profiles')
    .select('id')
    .eq('line_user_id', verified.userId)
    .maybeSingle()
  if (!profile) return Response.json({ items: [] })

  const { data, error } = await sb
    .from('waitlist')
    .select(
      'id, preferred_date, time_from, time_to, position, status, notified_at, expires_at, reserved_booking_id, ' +
        'service:services(name), ' +
        'barber:barbers(profile:profiles(display_name))'
    )
    .eq('customer_id', profile.id)
    .in('status', ['waiting', 'notified'])
    .order('preferred_date', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ items: data ?? [] })
}
