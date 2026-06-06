// POST /api/bookings — create a pending booking via try_lock_slot()
// GET  /api/bookings?idToken=... — list current user's bookings (upcoming first)
import { authenticate } from '@/lib/line/auth'
import { verifyLineIdToken } from '@/lib/line/verify'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  computeDiscount,
  describeValidationError,
  validatePromo,
  type Promotion,
} from '@/lib/promo'

const BRANCH_ID = '00000000-0000-0000-0000-000000000001'

export async function POST(req: Request) {
  const { auth, body } = await authenticate(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const barberId = typeof body?.barber_id === 'string' ? body.barber_id : null
  const slotTime = typeof body?.slot_time === 'string' ? body.slot_time : null
  const serviceIds = Array.isArray(body?.service_ids) ? (body!.service_ids as string[]) : null
  const promoCode = typeof body?.promo_code === 'string' ? body.promo_code.toUpperCase().trim() : null
  if (!barberId || !slotTime || !serviceIds?.length) {
    return Response.json({ error: 'barber_id, slot_time, service_ids required' }, { status: 400 })
  }

  const sb = createAdminClient()

  // Sum durations + prices from selected services
  const { data: services, error: svcErr } = await sb
    .from('services')
    .select('id, duration_minutes, price_thb')
    .in('id', serviceIds)
  if (svcErr) return Response.json({ error: svcErr.message }, { status: 500 })

  const totalDuration = (services ?? []).reduce((a, s) => a + s.duration_minutes, 0)
  const subtotal = (services ?? []).reduce((a, s) => a + Number(s.price_thb), 0)
  if (totalDuration <= 0) return Response.json({ error: 'invalid services' }, { status: 400 })

  // Optional promo — validate before creating the booking
  let appliedPromo: Promotion | null = null
  let discount = 0
  if (promoCode) {
    const { data: promoRow } = await sb
      .from('promotions')
      .select('*')
      .eq('code', promoCode)
      .maybeSingle()
    if (!promoRow) {
      return Response.json({ error: describeValidationError('NOT_FOUND') }, { status: 409 })
    }
    const promo = promoRow as Promotion

    const { count } = await sb
      .from('promotion_usages')
      .select('id', { count: 'exact', head: true })
      .eq('promotion_id', promo.id)
      .eq('customer_id', auth.userId)
    const customerUses = count ?? 0

    const valid = validatePromo({ promo, subtotal, serviceIds, customerUses })
    if (!valid.ok) {
      return Response.json({ error: describeValidationError(valid.reason) }, { status: 409 })
    }
    appliedPromo = promo
    discount = computeDiscount(promo, subtotal)
  }

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

  // Apply promo discount to the locked booking + record usage + bump counter
  if (appliedPromo && discount > 0) {
    const newTotal = Math.max(0, subtotal - discount)
    await sb
      .from('bookings')
      .update({
        subtotal_thb: subtotal,
        discount_thb: discount,
        total_thb: newTotal,
        promotion_id: appliedPromo.id,
        promotion_code: appliedPromo.code,
      })
      .eq('id', bookingId as string)

    await sb.from('promotion_usages').insert({
      promotion_id: appliedPromo.id,
      customer_id: auth.userId,
      booking_id: bookingId as string,
      discount_amount_thb: discount,
    })

    await sb
      .from('promotions')
      .update({ current_uses: appliedPromo.current_uses + 1 })
      .eq('id', appliedPromo.id)
  }

  // Return the locked booking
  const { data: booking } = await sb
    .from('bookings')
    .select('id, slot_time, duration_minutes, subtotal_thb, discount_thb, total_thb, state, locked_until, promotion_code')
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
