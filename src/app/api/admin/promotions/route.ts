// GET  /api/admin/promotions?idToken=... — list all promotions (incl. inactive)
// POST /api/admin/promotions — create
import { authenticateAdmin } from '@/lib/line/admin-auth'
import { verifyLineIdToken } from '@/lib/line/verify'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_ROLES = ['admin', 'owner']

export async function GET(req: Request) {
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
    return Response.json({ error: 'admin/owner required' }, { status: 403 })
  }

  const { data, error } = await sb
    .from('promotions')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ promotions: data ?? [] })
}

export async function POST(req: Request) {
  const { auth, body } = await authenticateAdmin(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  if (auth.role === 'barber') {
    return Response.json({ error: 'owner/admin only' }, { status: 403 })
  }

  const name = typeof body?.name === 'string' ? body.name : null
  const discountType = typeof body?.discount_type === 'string' ? body.discount_type : null
  const discountValue = Number(body?.discount_value ?? 0)
  const validFrom = typeof body?.valid_from === 'string' ? body.valid_from : null
  const validUntil = typeof body?.valid_until === 'string' ? body.valid_until : null

  if (!name || !discountType || !validFrom || !validUntil) {
    return Response.json(
      { error: 'name, discount_type, discount_value, valid_from, valid_until required' },
      { status: 400 }
    )
  }
  if (!['percent', 'fixed', 'combo_price'].includes(discountType)) {
    return Response.json({ error: 'discount_type invalid' }, { status: 400 })
  }

  const sb = createAdminClient()
  const { data: created, error } = await sb
    .from('promotions')
    .insert({
      name,
      description: typeof body?.description === 'string' ? body.description : null,
      code: typeof body?.code === 'string' ? body.code.toUpperCase().trim() : null,
      icon: typeof body?.icon === 'string' ? body.icon : null,
      discount_type: discountType,
      discount_value: discountValue,
      min_amount_thb: Number(body?.min_amount_thb ?? 0),
      max_discount_thb: body?.max_discount_thb != null ? Number(body.max_discount_thb) : null,
      applicable_service_ids: Array.isArray(body?.applicable_service_ids)
        ? body.applicable_service_ids
        : null,
      valid_from: validFrom,
      valid_until: validUntil,
      max_total_uses: body?.max_total_uses != null ? Number(body.max_total_uses) : null,
      max_uses_per_customer: Number(body?.max_uses_per_customer ?? 1),
      trigger_type: typeof body?.trigger_type === 'string' ? body.trigger_type : 'manual',
      is_active: body?.is_active !== false,
      created_by: auth.userId,
    })
    .select('id')
    .single()

  if (error) {
    const dupe = error.message.includes('unique') || error.code === '23505'
    return Response.json(
      { error: dupe ? 'รหัสคูปองนี้ใช้ไปแล้ว' : error.message },
      { status: dupe ? 409 : 500 }
    )
  }

  return Response.json({ ok: true, id: created.id })
}
