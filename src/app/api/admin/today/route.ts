// GET /api/admin/today?idToken=... — today's bookings + quick stats for admin/owner
// (barbers see only their own bookings)
import { verifyLineIdToken } from '@/lib/line/verify'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_ROLES = ['barber', 'admin', 'owner']

export async function GET(req: Request) {
  const idToken = new URL(req.url).searchParams.get('idToken')
  if (!idToken) return Response.json({ error: 'idToken required' }, { status: 400 })

  const verified = await verifyLineIdToken(idToken)
  if (!verified.ok) return Response.json({ error: verified.error }, { status: 401 })

  const sb = createAdminClient()
  const { data: caller } = await sb
    .from('profiles')
    .select('id, role')
    .eq('line_user_id', verified.userId)
    .maybeSingle()
  if (!caller || !ADMIN_ROLES.includes(caller.role)) {
    return Response.json({ error: 'admin access required' }, { status: 403 })
  }

  // Today in shop's local TZ (Asia/Bangkok). Quick approach: now ± 24h window
  const now = new Date()
  const startOfToday = new Date(now)
  startOfToday.setUTCHours(0, 0, 0, 0)
  // Shift to Bangkok timezone offset (-7h from UTC = Bangkok is UTC+7)
  startOfToday.setUTCHours(-7, 0, 0, 0)
  const endOfToday = new Date(startOfToday.getTime() + 86400000)

  let q = sb
    .from('bookings')
    .select(
      'id, slot_time, duration_minutes, total_thb, state, customer_id, barber_id, ' +
        'customer:customers(profile:profiles(display_name, phone)), ' +
        'barber:barbers(profile:profiles(display_name)), ' +
        'booking_services(service_name, service_price_thb)'
    )
    .gte('slot_time', startOfToday.toISOString())
    .lt('slot_time', endOfToday.toISOString())
    .order('slot_time')

  if (caller.role === 'barber') q = q.eq('barber_id', caller.id)

  const { data, error } = await q
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // PostgREST embed with alias confuses the inferred row type; cast to a
  // light local shape for stats.
  const bookings = (data ?? []) as unknown as Array<{ state: string; total_thb: number }>

  // Stats
  const completed = bookings.filter((b) => b.state === 'completed')
  const noShows = bookings.filter((b) => b.state === 'no_show').length
  const upcoming = bookings.filter((b) =>
    ['pending', 'confirmed', 'checked_in', 'in_progress'].includes(b.state)
  ).length
  const revenue = completed.reduce((a, b) => a + Number(b.total_thb), 0)

  return Response.json({
    bookings: data ?? [],
    stats: { total: bookings.length, completed: completed.length, noShows, upcoming, revenue },
  })
}
