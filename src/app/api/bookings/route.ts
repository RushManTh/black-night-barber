// POST /api/bookings — create a pending booking via try_lock_slot()
// GET  /api/bookings?idToken=... — list current user's bookings (upcoming first)
import { authenticate } from '@/lib/line/auth'
import { verifyLineIdToken } from '@/lib/line/verify'
import { createAdminClient } from '@/lib/supabase/admin'

const BRANCH_ID = '00000000-0000-0000-0000-000000000001'

export async function POST(req: Request) {
  const { auth, body } = await authenticate(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const barberId = typeof body?.barber_id === 'string' ? body.barber_id : null
  const slotTime = typeof body?.slot_time === 'string' ? body.slot_time : null
  const serviceIds = Array.isArray(body?.service_ids) ? (body!.service_ids as string[]) : null
  if (!barberId || !slotTime || !serviceIds?.length) {
    return Response.json({ error: 'barber_id, slot_time, service_ids required' }, { status: 400 })
  }

  const sb = createAdminClient()

  // Sum durations from selected services
  const { data: services, error: svcErr } = await sb
    .from('services')
    .select('id, duration_minutes')
    .in('id', serviceIds)
  if (svcErr) return Response.json({ error: svcErr.message }, { status: 500 })

  const totalDuration = (services ?? []).reduce((a, s) => a + s.duration_minutes, 0)
  if (totalDuration <= 0) return Response.json({ error: 'invalid services' }, { status: 400 })

  // Atomic slot lock
  const { data: bookingId, error: lockErr } = await sb.rpc('try_lock_slot', {
    p_customer_id: auth.userId,
    p_barber_id: barberId,
    p_branch_id: BRANCH_ID,
    p_slot_time: slotTime,
    p_duration_minutes: totalDuration,
    p_service_ids: serviceIds,
    p_lock_minutes: 10,
  })

  if (lockErr) {
    const isConflict =
      lockErr.message.includes('SLOT_UNAVAILABLE') ||
      lockErr.message.includes('ALREADY_BOOKED')
    return Response.json({ error: lockErr.message }, { status: isConflict ? 409 : 500 })
  }

  // Return the locked booking
  const { data: booking } = await sb
    .from('bookings')
    .select('id, slot_time, duration_minutes, total_thb, state, locked_until')
    .eq('id', bookingId as string)
    .single()

  return Response.json({ booking })
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
  if (!profile) return Response.json({ bookings: [] })

  const { data, error } = await sb
    .from('bookings')
    .select(
      'id, slot_time, duration_minutes, total_thb, state, locked_until, ' +
        'barbers!inner(profiles(display_name)), ' +
        'booking_services(service_name, service_price_thb)'
    )
    .eq('customer_id', profile.id)
    .in('state', ['pending', 'confirmed', 'checked_in', 'in_progress', 'completed'])
    .gte('slot_time', new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString())
    .order('slot_time', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ bookings: data ?? [] })
}
