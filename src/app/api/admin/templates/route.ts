// GET /api/admin/templates   — list notification templates
// PATCH                       — update body/subject/is_active for one template
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
    .from('notification_templates')
    .select('id, key, channel, language, subject, body, is_active, updated_at')
    .order('key')
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ templates: data ?? [] })
}

export async function PATCH(req: Request) {
  const { auth, body } = await authenticateAdmin(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  if (auth.role === 'barber') {
    return Response.json({ error: 'owner/admin only' }, { status: 403 })
  }

  const id = typeof body?.id === 'string' ? body.id : null
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })

  const patch: Record<string, unknown> = {}
  if (typeof body?.body === 'string') patch.body = body.body
  if (typeof body?.subject === 'string' || body?.subject === null) patch.subject = body.subject
  if (body?.is_active != null) patch.is_active = !!body.is_active
  patch.updated_at = new Date().toISOString()

  if (Object.keys(patch).length === 1) {
    return Response.json({ error: 'nothing to update' }, { status: 400 })
  }

  const sb = createAdminClient()
  const { error } = await sb.from('notification_templates').update(patch).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}
