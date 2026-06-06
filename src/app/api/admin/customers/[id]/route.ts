// GET   /api/admin/customers/[id]?idToken=... — detail + history + reviews + loyalty
// PATCH /api/admin/customers/[id]               — update admin_notes / tier / trust_score
import { authenticateAdmin } from '@/lib/line/admin-auth'
import { verifyLineIdToken } from '@/lib/line/verify'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_ROLES = ['barber', 'admin', 'owner']

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
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

  const { id } = await ctx.params

  const { data: customer, error } = await sb
    .from('customers')
    .select(
      'id, birthday, preferred_hairstyles, tier, trust_score, total_visits, total_spent_thb, no_show_count, phone_verified, admin_notes, first_visit_at, last_visit_at, ' +
        'profile:profiles!inner(display_name, avatar_url, phone, line_user_id, role)'
    )
    .eq('id', id)
    .maybeSingle()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!customer) return Response.json({ error: 'not found' }, { status: 404 })

  const { data: bookings } = await sb
    .from('bookings')
    .select(
      'id, slot_time, duration_minutes, total_thb, state, barber:barbers(profile:profiles(display_name)), booking_services(service_name)'
    )
    .eq('customer_id', id)
    .order('slot_time', { ascending: false })
    .limit(50)

  const { data: reviews } = await sb
    .from('reviews')
    .select('id, rating, comment, tags, created_at, barber:barbers(profile:profiles(display_name))')
    .eq('customer_id', id)
    .order('created_at', { ascending: false })
    .limit(20)

  const { data: loyalty } = await sb
    .from('loyalty_transactions')
    .select('id, points, type, description, created_at')
    .eq('customer_id', id)
    .order('created_at', { ascending: false })
    .limit(20)
  const loyaltyBalance = (loyalty ?? []).reduce((a, l) => a + Number(l.points), 0)

  return Response.json({
    customer,
    bookings: bookings ?? [],
    reviews: reviews ?? [],
    loyalty: loyalty ?? [],
    loyalty_balance: loyaltyBalance,
  })
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { auth, body } = await authenticateAdmin(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  if (auth.role === 'barber') {
    return Response.json({ error: 'owner/admin only' }, { status: 403 })
  }

  const { id } = await ctx.params
  const patch: Record<string, unknown> = {}
  if (typeof body?.admin_notes === 'string' || body?.admin_notes === null) {
    patch.admin_notes = body.admin_notes
  }
  if (typeof body?.tier === 'string' && ['bronze', 'silver', 'gold'].includes(body.tier)) {
    patch.tier = body.tier
  }
  if (body?.trust_score != null) {
    patch.trust_score = Math.max(0, Math.min(100, Number(body.trust_score)))
  }

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: 'nothing to update' }, { status: 400 })
  }

  const sb = createAdminClient()
  const { error } = await sb.from('customers').update(patch).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}
