// GET /api/admin/settings   — read all shop_settings
// PATCH /api/admin/settings — update one or more keys
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
    .from('shop_settings')
    .select('key, value, description')
    .order('key')
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ settings: data ?? [] })
}

export async function PATCH(req: Request) {
  const { auth, body } = await authenticateAdmin(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  if (auth.role === 'barber') {
    return Response.json({ error: 'owner/admin only' }, { status: 403 })
  }

  const updates = body?.updates as Array<{ key: string; value: unknown }> | undefined
  if (!Array.isArray(updates) || updates.length === 0) {
    return Response.json({ error: 'updates[] required' }, { status: 400 })
  }

  const sb = createAdminClient()
  for (const u of updates) {
    if (typeof u.key !== 'string') continue
    const { error } = await sb
      .from('shop_settings')
      .update({ value: u.value, updated_by: auth.userId, updated_at: new Date().toISOString() })
      .eq('key', u.key)
    if (error) return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true, updated: updates.length })
}
