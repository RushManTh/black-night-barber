// POST /api/bookings/[id]/confirm — call confirm_booking() within lock window
import { authenticate } from '@/lib/line/auth'
import { createAdminClient } from '@/lib/supabase/admin'

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

  return Response.json({ booking: data })
}
