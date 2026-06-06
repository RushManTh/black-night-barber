// GET /api/admin/reports?idToken=... — last-7-days revenue, no-show rate, top services
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
    .select('role')
    .eq('line_user_id', verified.userId)
    .maybeSingle()
  if (!caller || !ADMIN_ROLES.includes(caller.role)) {
    return Response.json({ error: 'admin access required' }, { status: 403 })
  }

  const now = new Date()
  const since = new Date(now.getTime() - 7 * 86400000)

  const { data: bookings } = await sb
    .from('bookings')
    .select('state, total_thb, slot_time, booking_services(service_name, service_price_thb)')
    .gte('slot_time', since.toISOString())
    .lt('slot_time', now.toISOString())

  type Row = {
    state: string
    total_thb: number
    slot_time: string
    booking_services: { service_name: string; service_price_thb: number }[]
  }
  const rows = (bookings ?? []) as unknown as Row[]

  const completed = rows.filter((r) => r.state === 'completed')
  const noShows = rows.filter((r) => r.state === 'no_show')
  const cancelled = rows.filter((r) => r.state === 'cancelled')

  const totalRevenue = completed.reduce((a, r) => a + Number(r.total_thb), 0)

  // Group revenue by day (Bangkok TZ)
  const byDay: Record<string, { date: string; revenue: number; count: number }> = {}
  for (const r of completed) {
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date(r.slot_time))
    byDay[day] = byDay[day] ?? { date: day, revenue: 0, count: 0 }
    byDay[day].revenue += Number(r.total_thb)
    byDay[day].count++
  }
  const daily = Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date))

  // Top services (count + revenue)
  const serviceMap: Record<string, { name: string; count: number; revenue: number }> = {}
  for (const r of completed) {
    for (const s of r.booking_services) {
      const key = s.service_name
      serviceMap[key] = serviceMap[key] ?? { name: key, count: 0, revenue: 0 }
      serviceMap[key].count++
      serviceMap[key].revenue += Number(s.service_price_thb)
    }
  }
  const topServices = Object.values(serviceMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return Response.json({
    range: { since: since.toISOString(), until: now.toISOString(), days: 7 },
    totals: {
      bookings: rows.length,
      completed: completed.length,
      no_shows: noShows.length,
      cancelled: cancelled.length,
      revenue: totalRevenue,
      no_show_rate: rows.length > 0 ? Math.round((noShows.length / rows.length) * 100) : 0,
    },
    daily,
    top_services: topServices,
  })
}
