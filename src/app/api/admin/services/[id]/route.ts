// PATCH /api/admin/services/[id] — edit any field on an existing service
import { authenticateAdmin } from '@/lib/line/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { auth, body } = await authenticateAdmin(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  if (auth.role === 'barber') {
    return Response.json({ error: 'only admin/owner can edit services' }, { status: 403 })
  }

  const { id } = await ctx.params
  const patch: Record<string, unknown> = {}
  if (typeof body?.name === 'string') patch.name = body.name
  if (typeof body?.description === 'string' || body?.description === null) {
    patch.description = body.description
  }
  if (typeof body?.icon === 'string' || body?.icon === null) patch.icon = body.icon
  if (body?.duration_minutes != null) patch.duration_minutes = Number(body.duration_minutes)
  if (body?.price_thb != null) patch.price_thb = Number(body.price_thb)
  if (body?.is_active != null) patch.is_active = !!body.is_active

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: 'nothing to update' }, { status: 400 })
  }

  const sb = createAdminClient()
  const { error } = await sb.from('services').update(patch).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}
