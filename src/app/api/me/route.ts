// POST /api/me — verifies LIFF id_token, upserts profile + customer,
// returns the merged record. Acts as the LINE→Supabase identity bridge.

import { verifyLineIdToken } from '@/lib/line/verify'
import { createAdminClient } from '@/lib/supabase/admin'

type SyncBody = {
  idToken: string
  displayName?: string
  pictureUrl?: string
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as SyncBody | null
  if (!body?.idToken) {
    return Response.json({ error: 'idToken required' }, { status: 400 })
  }

  const verified = await verifyLineIdToken(body.idToken)
  if (!verified.ok) {
    return Response.json({ error: verified.error }, { status: 401 })
  }

  const lineUserId = verified.userId
  const fallbackName = body.displayName ?? verified.name ?? 'ลูกค้า'
  const fallbackPic = body.pictureUrl ?? verified.picture

  const sb = createAdminClient()

  // Look up existing profile by LINE userId
  const { data: existing, error: lookupErr } = await sb
    .from('profiles')
    .select('id, display_name, avatar_url, phone, line_user_id, role, customers(*)')
    .eq('line_user_id', lineUserId)
    .maybeSingle()

  if (lookupErr) {
    return Response.json({ error: lookupErr.message }, { status: 500 })
  }

  if (existing) {
    return Response.json({ profile: existing, isNew: false })
  }

  // Create auth user (profiles.id FKs auth.users.id)
  const { data: authUser, error: authErr } = await sb.auth.admin.createUser({
    email: `line.${lineUserId}@blacknight.local`,
    email_confirm: true,
    user_metadata: { line_user_id: lineUserId, source: 'liff' },
  })
  if (authErr || !authUser.user) {
    return Response.json({ error: authErr?.message ?? 'createUser failed' }, { status: 500 })
  }

  const userId = authUser.user.id

  // Insert profile
  const { error: profileErr } = await sb.from('profiles').insert({
    id: userId,
    display_name: fallbackName,
    avatar_url: fallbackPic,
    line_user_id: lineUserId,
    role: 'customer',
  })
  if (profileErr) {
    return Response.json({ error: profileErr.message }, { status: 500 })
  }

  // Insert customer row
  const { error: custErr } = await sb.from('customers').insert({ id: userId })
  if (custErr) {
    return Response.json({ error: custErr.message }, { status: 500 })
  }

  // Return merged record
  const { data: created } = await sb
    .from('profiles')
    .select('id, display_name, avatar_url, phone, line_user_id, role, customers(*)')
    .eq('id', userId)
    .single()

  return Response.json({ profile: created, isNew: true })
}
