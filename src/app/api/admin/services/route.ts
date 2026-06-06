// POST /api/admin/services        — create service (linked to all active barbers)
// PATCH /api/admin/services        — update service { id, ...patch }
import { authenticateAdmin } from '@/lib/line/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'

const BRANCH_ID = '00000000-0000-0000-0000-000000000001'

export async function POST(req: Request) {
  const { auth, body } = await authenticateAdmin(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  if (auth.role === 'barber') {
    return Response.json({ error: 'only admin/owner can add services' }, { status: 403 })
  }

  const name = typeof body?.name === 'string' ? body.name : null
  const duration = Number(body?.duration_minutes ?? 0)
  const price = Number(body?.price_thb ?? 0)
  if (!name || duration <= 0 || price < 0) {
    return Response.json({ error: 'name, duration_minutes, price_thb required' }, { status: 400 })
  }

  const sb = createAdminClient()
  const { data: created, error } = await sb
    .from('services')
    .insert({
      branch_id: BRANCH_ID,
      name,
      description: typeof body?.description === 'string' ? body.description : null,
      icon: typeof body?.icon === 'string' ? body.icon : null,
      duration_minutes: duration,
      price_thb: price,
      display_order: 99,
    })
    .select('id')
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Link to all current active barbers
  const { data: barbers } = await sb.from('barbers').select('id').eq('is_active', true)
  if (barbers && barbers.length > 0 && created) {
    await sb.from('barber_services').insert(
      barbers.map((b) => ({ barber_id: b.id, service_id: created.id }))
    )
  }

  return Response.json({ ok: true, id: created?.id })
}

export async function PATCH(req: Request) {
  const { auth, body } = await authenticateAdmin(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  if (auth.role === 'barber') {
    return Response.json({ error: 'only admin/owner can edit services' }, { status: 403 })
  }

  const id = typeof body?.id === 'string' ? body.id : null
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })

  const patch: Record<string, unknown> = {}
  for (const k of ['name', 'description', 'icon'] as const) {
    if (typeof body?.[k] === 'string') patch[k] = body[k]
  }
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
