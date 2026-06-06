// POST /api/bookings/[id]/confirm — call confirm_booking() within lock window
import { authenticate } from '@/lib/line/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { bookingConfirmedText, pushText } from '@/lib/line/notify'

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { auth } = await authenticate(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { id } = await ctx.params
  const sb = createAdminClient()

  // Ensure the booking belongs to the caller
  const { data: existing, error: lookupErr } = await sb
    .from('bookings')
    .select('id, customer_id, state, locked_until')
    .eq('id', id)
    .maybeSingle()
  if (lookupErr) return Response.json({ error: lookupErr.message }, { status: 500 })
  if (!existing) return Response.json({ error: 'booking not found' }, { status: 404 })
  if (existing.customer_id !== auth.userId) {
    return Response.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data, error } = await sb.rpc('confirm_booking', { p_booking_id: id })
  if (error) {
    const expired = error.message.includes('LOCK_EXPIRED') || error.message.includes('INVALID_STATE')
    return Response.json({ error: error.message }, { status: expired ? 410 : 500 })
  }

  // Best-effort LINE push (failure shouldn't break the booking)
  try {
    const { data: detail } = await sb
      .from('bookings')
      .select(
        'slot_time, total_thb, ' +
          'customer:customers(profile:profiles(line_user_id)), ' +
          'barber:barbers(profile:profiles(display_name)), ' +
          'booking_services(service_name)'
      )
      .eq('id', id)
      .single()
    const d = detail as unknown as {
      slot_time: string
      total_thb: number
      customer: { profile: { line_user_id: string | null } | null } | null
      barber: { profile: { display_name: string } | null } | null
      booking_services: { service_name: string }[]
    } | null
    const lineId = d?.customer?.profile?.line_user_id
    if (lineId) {
      await pushText({
        to: lineId,
        customerId: auth.userId,
        bookingId: id,
        templateKey: 'booking_confirmed',
        text: bookingConfirmedText({
          slotTime: d!.slot_time,
          services: d!.booking_services.map((s) => s.service_name),
          barber: d!.barber?.profile?.display_name ?? 'ช่างของเรา',
          total: Number(d!.total_thb),
        }),
      })
    }
  } catch { /* swallow */ }

  return Response.json({ booking: data })
}
