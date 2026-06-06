// GET /api/admin/reports?idToken=...&range=7d|30d|90d|custom&from=...&to=...
// Returns:
//   - current period totals + previous-period comparison (delta %)
//   - daily revenue series
//   - per-barber breakdown
//   - per-service breakdown
//   - hourly distribution (peak hours)
//   - customer split (new vs returning)
import { verifyLineIdToken } from '@/lib/line/verify'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_ROLES = ['barber', 'admin', 'owner']

type Booking = {
  id: string
  state: string
  total_thb: number
  slot_time: string
  customer_id: string
  barber_id: string
  barber: { profile: { display_name: string } | null } | null
  booking_services: { service_name: string; service_price_thb: number }[]
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const idToken = url.searchParams.get('idToken')
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

  // Resolve range — default last 7 days
  const range = url.searchParams.get('range') ?? '7d'
  const now = new Date()
  let from: Date
  let to: Date = now

  if (range === 'custom') {
    const fromP = url.searchParams.get('from')
    const toP = url.searchParams.get('to')
    if (!fromP || !toP) {
      return Response.json({ error: 'from and to required for custom range' }, { status: 400 })
    }
    from = new Date(fromP)
    to = new Date(toP)
  } else {
    const days = range === '30d' ? 30 : range === '90d' ? 90 : 7
    from = new Date(now.getTime() - days * 86400000)
  }

  const periodMs = to.getTime() - from.getTime()
  const prevFrom = new Date(from.getTime() - periodMs)
  const prevTo = from

  // Fetch both periods in parallel
  const [currentRes, previousRes] = await Promise.all([
    fetchPeriod(sb, prevFrom.toISOString(), to.toISOString()),
    Promise.resolve(null), // placeholder; computed below from currentRes for efficiency
  ])
  void previousRes
  const allBookings = currentRes

  const inCurrent = (b: Booking) =>
    new Date(b.slot_time) >= from && new Date(b.slot_time) <= to
  const inPrevious = (b: Booking) =>
    new Date(b.slot_time) >= prevFrom && new Date(b.slot_time) < from

  const cur = allBookings.filter(inCurrent)
  const prev = allBookings.filter(inPrevious)

  const totals = summarize(cur)
  const prevTotals = summarize(prev)

  // Daily series (current period only)
  const byDay = new Map<string, { date: string; revenue: number; count: number }>()
  for (const b of cur.filter((x) => x.state === 'completed')) {
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(
      new Date(b.slot_time)
    )
    const cur = byDay.get(day) ?? { date: day, revenue: 0, count: 0 }
    cur.revenue += Number(b.total_thb)
    cur.count++
    byDay.set(day, cur)
  }
  const daily = Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date))

  // Per barber
  const byBarber = new Map<string, { name: string; revenue: number; completed: number; total: number; no_show: number }>()
  for (const b of cur) {
    const name = b.barber?.profile?.display_name ?? '?'
    const row = byBarber.get(b.barber_id) ?? { name, revenue: 0, completed: 0, total: 0, no_show: 0 }
    row.total++
    if (b.state === 'completed') {
      row.completed++
      row.revenue += Number(b.total_thb)
    }
    if (b.state === 'no_show') row.no_show++
    byBarber.set(b.barber_id, row)
  }
  const perBarber = Array.from(byBarber.values()).sort((a, b) => b.revenue - a.revenue)

  // Per service
  const byService = new Map<string, { name: string; count: number; revenue: number }>()
  for (const b of cur.filter((x) => x.state === 'completed')) {
    for (const s of b.booking_services) {
      const row = byService.get(s.service_name) ?? { name: s.service_name, count: 0, revenue: 0 }
      row.count++
      row.revenue += Number(s.service_price_thb)
      byService.set(s.service_name, row)
    }
  }
  const perService = Array.from(byService.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10)

  // Hourly distribution (Bangkok local) — count completed
  const byHour: Record<number, number> = {}
  for (let i = 8; i < 24; i++) byHour[i] = 0
  for (const b of cur.filter((x) => x.state === 'completed')) {
    const hour = Number(
      new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Bangkok' }).format(
        new Date(b.slot_time)
      )
    )
    if (Number.isFinite(hour)) byHour[hour] = (byHour[hour] ?? 0) + 1
  }
  const hourly = Object.entries(byHour)
    .map(([h, c]) => ({ hour: Number(h), count: c }))
    .filter((x) => x.hour >= 8 && x.hour <= 22)
    .sort((a, b) => a.hour - b.hour)

  // Customer split: new vs returning
  // "new" = customer's first completed booking falls within current period
  const customerIds = Array.from(
    new Set(cur.filter((b) => b.state === 'completed').map((b) => b.customer_id))
  )
  let newCount = 0
  if (customerIds.length > 0) {
    const { data: firsts } = await sb
      .from('customers')
      .select('id, first_visit_at')
      .in('id', customerIds)
    for (const c of firsts ?? []) {
      if (c.first_visit_at && new Date(c.first_visit_at) >= from) newCount++
    }
  }

  return Response.json({
    range: {
      from: from.toISOString(),
      to: to.toISOString(),
      days: Math.round(periodMs / 86400000),
      previous_from: prevFrom.toISOString(),
      previous_to: prevTo.toISOString(),
    },
    totals: {
      ...totals,
      previous: prevTotals,
      revenue_change_pct: pctChange(prevTotals.revenue, totals.revenue),
      bookings_change_pct: pctChange(prevTotals.bookings, totals.bookings),
      completed_change_pct: pctChange(prevTotals.completed, totals.completed),
    },
    daily,
    per_barber: perBarber,
    per_service: perService,
    hourly,
    customers: {
      unique: customerIds.length,
      new: newCount,
      returning: customerIds.length - newCount,
    },
  })
}

async function fetchPeriod(
  sb: ReturnType<typeof createAdminClient>,
  fromIso: string,
  toIso: string
): Promise<Booking[]> {
  const { data } = await sb
    .from('bookings')
    .select(
      'id, state, total_thb, slot_time, customer_id, barber_id, ' +
        'barber:barbers(profile:profiles(display_name)), ' +
        'booking_services(service_name, service_price_thb)'
    )
    .gte('slot_time', fromIso)
    .lt('slot_time', toIso)
  return (data ?? []) as unknown as Booking[]
}

function summarize(bookings: Booking[]) {
  const completed = bookings.filter((b) => b.state === 'completed')
  const noShows = bookings.filter((b) => b.state === 'no_show').length
  const cancelled = bookings.filter((b) => b.state === 'cancelled').length
  const revenue = completed.reduce((a, b) => a + Number(b.total_thb), 0)
  return {
    bookings: bookings.length,
    completed: completed.length,
    no_shows: noShows,
    cancelled,
    revenue,
    no_show_rate: bookings.length > 0 ? Math.round((noShows / bookings.length) * 100) : 0,
  }
}

function pctChange(prev: number, cur: number): number | null {
  if (prev === 0) return cur === 0 ? 0 : null
  return Math.round(((cur - prev) / prev) * 100)
}
