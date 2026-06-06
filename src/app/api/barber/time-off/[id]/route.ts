// DELETE /api/barber/time-off/[id] — cancel a time-off entry
import { authenticateBarber } from '@/lib/line/barber-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { auth } = await authenticateBarber(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { id } = await ctx.params
  const sb = createAdminClient()

  const { data: existing } = await sb
    .from('barber_time_off')
    .select('barber_id')
    .eq('id', id)
    .maybeSingle()
  if (!existing) return Response.json({ error: 'not found' }, { status: 404 })
  if (existing.barber_id !== auth.userId && auth.role === 'barber') {
    return Response.json({ error: 'forbidden' }, { status: 403 })
  }

  const { error } = await sb.from('barber_time_off').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
