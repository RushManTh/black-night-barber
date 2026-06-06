// PATCH /api/admin/promotions/[id] — edit
// DELETE /api/admin/promotions/[id] — soft delete (set is_active=false)
import { authenticateAdmin } from '@/lib/line/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'

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
  for (const k of ['name', 'description', 'icon', 'discount_type', 'trigger_type'] as const) {
    if (typeof body?.[k] === 'string') patch[k] = body[k]
  }
  if (typeof body?.code === 'string') patch.code = body.code.toUpperCase().trim() || null
  if (body?.code === null) patch.code = null
  if (body?.discount_value != null) patch.discount_value = Number(body.discount_value)
  if (body?.min_amount_thb != null) patch.min_amount_thb = Number(body.min_amount_thb)
  if (body?.max_discount_thb !== undefined) {
    patch.max_discount_thb = body.max_discount_thb == null ? null : Number(body.max_discount_thb)
  }
  if (Array.isArray(body?.applicable_service_ids) || body?.applicable_service_ids === null) {
    patch.applicable_service_ids = body.applicable_service_ids
  }
  if (typeof body?.valid_from === 'string') patch.valid_from = body.valid_from
  if (typeof body?.valid_until === 'string') patch.valid_until = body.valid_until
  if (body?.max_total_uses !== undefined) {
    patch.max_total_uses = body.max_total_uses == null ? null : Number(body.max_total_uses)
  }
  if (body?.max_uses_per_customer != null) {
    patch.max_uses_per_customer = Number(body.max_uses_per_customer)
  }
  if (body?.is_active != null) patch.is_active = !!body.is_active

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: 'nothing to update' }, { status: 400 })
  }

  const sb = createAdminClient()
  const { error } = await sb.from('promotions').update(patch).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { auth } = await authenticateAdmin(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  if (auth.role === 'barber') {
    return Response.json({ error: 'owner/admin only' }, { status: 403 })
  }

  const { id } = await ctx.params
  const sb = createAdminClient()
  const { error } = await sb.from('promotions').update({ is_active: false }).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}
