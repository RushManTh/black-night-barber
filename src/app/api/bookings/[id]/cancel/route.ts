// POST /api/bookings/[id]/cancel — customer cancels their own pending/confirmed booking
import { authenticate } from '@/lib/line/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { auth, body } = await authenticate(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { id } = await ctx.params
  const reason = typeof body?.reason === 'string' ? body.reason : null

  const sb = createAdminClient()

  // Verify ownership + cancellable state
  const { data: existing } = await sb
    .from('bookings')
    .select('id, customer_id, state, slot_time')
    .eq('id', id)
    .maybeSingle()
  if (!existing) return Response.json({ error: 'booking not found' }, { status: 404 })
  if (existing.customer_id !== auth.userId) {
    return Response.json({ error: 'forbidden' }, { status: 403 })
  }
  if (!['pending', 'confirmed'].includes(existing.state)) {
    return Response.json({ error: `cannot cancel state=${existing.state}` }, { status: 409 })
  }

  const { error } = await sb
    .from('bookings')
    .update({
      state: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by: auth.userId,
      cancellation_reason: reason,
    })
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
