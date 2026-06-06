// POST /api/admin/bookings/[id]/state — admin transitions booking state
// Allowed transitions enforced here. DB triggers handle side-effects:
//   • completed   → loyalty points + customer.total_visits++
//   • no_show     → customer.trust_score -= 20
import { authenticateAdmin } from '@/lib/line/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'

type Action = 'check_in' | 'start' | 'complete' | 'no_show' | 'cancel'

const TRANSITIONS: Record<Action, { from: string[]; to: string; extra?: Record<string, unknown> }> = {
  check_in: { from: ['confirmed'], to: 'checked_in' },
  start:    { from: ['checked_in', 'confirmed'], to: 'in_progress' },
  complete: { from: ['in_progress', 'checked_in'], to: 'completed' },
  no_show:  { from: ['confirmed', 'checked_in'], to: 'no_show' },
  cancel:   { from: ['pending', 'confirmed', 'checked_in'], to: 'cancelled' },
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { auth, body } = await authenticateAdmin(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { id } = await ctx.params
  const action = body?.action as Action | undefined
  if (!action || !(action in TRANSITIONS)) {
    return Response.json({ error: 'invalid action' }, { status: 400 })
  }

  const cfg = TRANSITIONS[action]
  const sb = createAdminClient()

  const { data: existing } = await sb
    .from('bookings')
    .select('id, state, barber_id')
    .eq('id', id)
    .maybeSingle()
  if (!existing) return Response.json({ error: 'booking not found' }, { status: 404 })
  if (!cfg.from.includes(existing.state)) {
    return Response.json(
      { error: `cannot ${action} from state=${existing.state}` },
      { status: 409 }
    )
  }
  // Barbers can only operate on their own bookings
  if (auth.role === 'barber' && existing.barber_id !== auth.userId) {
    return Response.json({ error: 'forbidden' }, { status: 403 })
  }

  const now = new Date().toISOString()
  const patch: Record<string, unknown> = { state: cfg.to, ...cfg.extra }
  if (action === 'check_in') patch.checked_in_at = now
  if (action === 'start')    patch.started_at = now
  if (action === 'complete') patch.completed_at = now
  if (action === 'cancel') {
    patch.cancelled_at = now
    patch.cancelled_by = auth.userId
    if (typeof body?.reason === 'string') patch.cancellation_reason = body.reason
  }

  const { error } = await sb.from('bookings').update(patch).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true, state: cfg.to })
}
