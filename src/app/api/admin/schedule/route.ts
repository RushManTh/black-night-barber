// GET /api/admin/schedule?idToken=...&date=YYYY-MM-DD
// Returns:
//   - barbers active that day (with their schedule for the weekday)
//   - all bookings on that date grouped per barber
//   - shop open/close for the day
import { verifyLineIdToken } from '@/lib/line/verify'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_ROLES = ['barber', 'admin', 'owner']

export async function GET(req: Request) {
  const url = new URL(req.url)
  const idToken = url.searchParams.get('idToken')
  const date = url.searchParams.get('date') // YYYY-MM-DD in Bangkok TZ
  if (!idToken || !date) {
    return Response.json({ error: 'idToken and date required' }, { status: 400 })
  }
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

  const dayStart = new Date(`${date}T00:00:00+07:00`)
  const dayEnd = new Date(dayStart.getTime() + 86400000)
  const dow = dayStart.getUTCDay() // 0=Sun

  // Shop info
  const { data: branch } = await sb
    .from('branches')
    .select('open_time, close_time, slot_duration_minutes, closed_weekdays')
    .limit(1)
    .single()

  // Barbers + their schedule for this weekday
  let barbersQ = sb
    .from('barbers')
    .select(
      'id, display_order, is_active, profiles(display_name, avatar_url), barber_schedules(day_of_week, start_time, end_time, is_active)'
    )
    .eq('is_active', true)
    .order('display_order')
  if (caller.role === 'barber') barbersQ = barbersQ.eq('id', caller.id)
  const { data: barbersRaw } = await barbersQ

  type BarberRow = {
    id: string
    display_order: number
    profiles: { display_name: string; avatar_url: string | null } | null
    barber_schedules: { day_of_week: number; start_time: string; end_time: string; is_active: boolean }[]
  }
  const barbers = (barbersRaw ?? []) as unknown as BarberRow[]

  // Bookings on this date (per Bangkok day)
  let bookingsQ = sb
    .from('bookings')
    .select(
      'id, slot_time, end_time, duration_minutes, total_thb, state, barber_id, customer_id, ' +
        'customer:customers(profile:profiles(display_name, phone)), ' +
        'booking_services(service_name)'
    )
    .gte('slot_time', dayStart.toISOString())
    .lt('slot_time', dayEnd.toISOString())
    .neq('state', 'cancelled')
    .neq('state', 'expired')
    .order('slot_time')
  if (caller.role === 'barber') bookingsQ = bookingsQ.eq('barber_id', caller.id)
  const { data: bookings } = await bookingsQ

  // Time-off entries that intersect this day
  const { data: timeOffs } = await sb
    .from('barber_time_off')
    .select('barber_id, start_at, end_at, reason')
    .lt('start_at', dayEnd.toISOString())
    .gt('end_at', dayStart.toISOString())
    .in('barber_id', barbers.map((b) => b.id))

  return Response.json({
    date,
    day_of_week: dow,
    branch: {
      open_time: branch?.open_time ?? '10:00:00',
      close_time: branch?.close_time ?? '21:00:00',
      slot_duration_minutes: branch?.slot_duration_minutes ?? 30,
      is_closed: Array.isArray(branch?.closed_weekdays) && branch.closed_weekdays.includes(dow),
    },
    barbers: barbers.map((b) => {
      const schedule = b.barber_schedules.find((s) => s.day_of_week === dow && s.is_active)
      return {
        id: b.id,
        display_name: b.profiles?.display_name ?? '?',
        avatar_url: b.profiles?.avatar_url,
        works_today: !!schedule,
        start_time: schedule?.start_time ?? null,
        end_time: schedule?.end_time ?? null,
      }
    }),
    bookings: bookings ?? [],
    time_offs: timeOffs ?? [],
  })
}
