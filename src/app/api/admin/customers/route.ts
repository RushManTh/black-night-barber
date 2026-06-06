// GET /api/admin/customers?idToken=...&q=...  — list customers, optional name/phone search
import { verifyLineIdToken } from '@/lib/line/verify'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_ROLES = ['barber', 'admin', 'owner']

export async function GET(req: Request) {
  const url = new URL(req.url)
  const idToken = url.searchParams.get('idToken')
  const search = (url.searchParams.get('q') ?? '').trim()
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

  // Show everyone who has a customer row, regardless of profile.role — the shop
  // owner may also have booked services themselves and should appear in the list.
  let q = sb
    .from('customers')
    .select(
      'id, birthday, tier, trust_score, total_visits, total_spent_thb, no_show_count, last_visit_at, ' +
        'profile:profiles!inner(display_name, phone, line_user_id, role)'
    )
    .order('last_visit_at', { ascending: false, nullsFirst: false })
    .limit(100)

  if (search) {
    q = q.or(`display_name.ilike.%${search}%,phone.ilike.%${search}%`, { referencedTable: 'profile' })
  }

  const { data, error } = await q
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ customers: data ?? [] })
}
