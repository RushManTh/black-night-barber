// GET /api/admin/notifications?idToken=...&status=...&channel=...&template=...&q=...
import { verifyLineIdToken } from '@/lib/line/verify'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_ROLES = ['admin', 'owner']

export async function GET(req: Request) {
  const url = new URL(req.url)
  const idToken = url.searchParams.get('idToken')
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

  const status = url.searchParams.get('status')
  const channel = url.searchParams.get('channel')
  const template = url.searchParams.get('template')

  let q = sb
    .from('notifications')
    .select(
      'id, channel, template_key, recipient, subject, body, status, error_message, sent_at, delivered_at, created_at, ' +
        'customer:customers(profile:profiles(display_name))'
    )
    .order('created_at', { ascending: false })
    .limit(100)

  if (status) q = q.eq('status', status)
  if (channel) q = q.eq('channel', channel)
  if (template) q = q.eq('template_key', template)

  const { data, error } = await q
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ notifications: data ?? [] })
}
