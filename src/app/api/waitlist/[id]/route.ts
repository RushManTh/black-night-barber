// DELETE /api/waitlist/[id] — customer cancels their own waitlist entry
import { authenticate } from '@/lib/line/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { auth } = await authenticate(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { id } = await ctx.params
  const sb = createAdminClient()

  const { data: existing } = await sb
    .from('waitlist')
    .select('customer_id, status')
    .eq('id', id)
    .maybeSingle()
  if (!existing) return Response.json({ error: 'not found' }, { status: 404 })
  if (existing.customer_id !== auth.userId) {
    return Response.json({ error: 'forbidden' }, { status: 403 })
  }
  if (!['waiting', 'notified'].includes(existing.status)) {
    return Response.json({ error: `cannot cancel ${existing.status}` }, { status: 409 })
  }

  const { error } = await sb.from('waitlist').update({ status: 'cancelled' }).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}
