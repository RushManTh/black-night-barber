// GET /api/admin/reviews?idToken=... — list all reviews (incl. unpublished) for admin moderation
import { verifyLineIdToken } from '@/lib/line/verify'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_ROLES = ['barber', 'admin', 'owner']

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
    return Response.json({ error: 'admin access required' }, { status: 403 })
  }

  const { data, error } = await sb
    .from('reviews')
    .select(
      'id, rating, comment, tags, is_anonymous, is_published, admin_reply, admin_replied_at, created_at, ' +
        'customer:customers(profile:profiles(display_name)), ' +
        'barber:barbers(profile:profiles(display_name))'
    )
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ reviews: data ?? [] })
}
