// GET /api/barber/reviews?idToken=... — list own reviews (customer names included)
import { verifyLineIdToken } from '@/lib/line/verify'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: Request) {
  const idToken = new URL(req.url).searchParams.get('idToken')
  if (!idToken) return Response.json({ error: 'idToken required' }, { status: 400 })

  const verified = await verifyLineIdToken(idToken)
  if (!verified.ok) return Response.json({ error: verified.error }, { status: 401 })

  const sb = createAdminClient()
  const { data: prof } = await sb
    .from('profiles')
    .select('id, role')
    .eq('line_user_id', verified.userId)
    .maybeSingle()
  if (!prof || !['barber', 'admin', 'owner'].includes(prof.role)) {
    return Response.json({ error: 'staff only' }, { status: 403 })
  }

  const { data, error } = await sb
    .from('reviews')
    .select(
      'id, rating, comment, tags, is_anonymous, is_published, admin_reply, admin_replied_at, created_at, ' +
        'customer:customers(profile:profiles(display_name))'
    )
    .eq('barber_id', prof.id)
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ reviews: data ?? [] })
}
