// PATCH /api/me/update — update authenticated user's profile + customer fields
import { verifyLineIdToken } from '@/lib/line/verify'
import { createAdminClient } from '@/lib/supabase/admin'

type UpdateBody = {
  idToken: string
  display_name?: string
  phone?: string | null
  birthday?: string | null              // YYYY-MM-DD
  preferred_hairstyles?: string[] | null
}

export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => null)) as UpdateBody | null
  if (!body?.idToken) {
    return Response.json({ error: 'idToken required' }, { status: 400 })
  }

  const verified = await verifyLineIdToken(body.idToken)
  if (!verified.ok) {
    return Response.json({ error: verified.error }, { status: 401 })
  }

  const sb = createAdminClient()

  // Resolve profile id from line userId
  const { data: prof, error: lookupErr } = await sb
    .from('profiles')
    .select('id')
    .eq('line_user_id', verified.userId)
    .maybeSingle()

  if (lookupErr) return Response.json({ error: lookupErr.message }, { status: 500 })
  if (!prof) return Response.json({ error: 'profile not found — call /api/me first' }, { status: 404 })

  // Patch profile (display_name, phone)
  const profilePatch: Record<string, unknown> = {}
  if (body.display_name !== undefined) profilePatch.display_name = body.display_name
  if (body.phone !== undefined) profilePatch.phone = body.phone

  if (Object.keys(profilePatch).length > 0) {
    const { error } = await sb.from('profiles').update(profilePatch).eq('id', prof.id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
  }

  // Patch customer (birthday, preferred_hairstyles)
  const customerPatch: Record<string, unknown> = {}
  if (body.birthday !== undefined) customerPatch.birthday = body.birthday
  if (body.preferred_hairstyles !== undefined) customerPatch.preferred_hairstyles = body.preferred_hairstyles

  if (Object.keys(customerPatch).length > 0) {
    const { error } = await sb.from('customers').update(customerPatch).eq('id', prof.id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
  }

  // Return updated record
  const { data: updated } = await sb
    .from('profiles')
    .select('id, display_name, avatar_url, phone, line_user_id, role, customers(*)')
    .eq('id', prof.id)
    .single()

  return Response.json({ profile: updated })
}
