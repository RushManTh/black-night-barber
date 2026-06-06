// Shared helper — verify LIFF idToken + resolve our internal user id
import { verifyLineIdToken } from '@/lib/line/verify'
import { createAdminClient } from '@/lib/supabase/admin'

export type AuthOk = { ok: true; userId: string; lineUserId: string }
export type AuthErr = { ok: false; status: number; error: string }

/**
 * Reads JSON body, validates `idToken`, verifies with LINE, and resolves
 * the profile id we created during /api/me sync.
 *
 * Returns auth result + parsed body. Caller decides what to do with the body fields.
 */
export async function authenticate(req: Request): Promise<{
  auth: AuthOk | AuthErr
  body: Record<string, unknown> | null
}> {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  const idToken = typeof body?.idToken === 'string' ? body.idToken : null
  if (!idToken) {
    return { auth: { ok: false, status: 400, error: 'idToken required' }, body }
  }

  const verified = await verifyLineIdToken(idToken)
  if (!verified.ok) {
    return { auth: { ok: false, status: 401, error: verified.error }, body }
  }

  const sb = createAdminClient()
  const { data: profile } = await sb
    .from('profiles')
    .select('id')
    .eq('line_user_id', verified.userId)
    .maybeSingle()

  if (!profile) {
    return {
      auth: { ok: false, status: 404, error: 'profile not found — call /api/me first' },
      body,
    }
  }

  return {
    auth: { ok: true, userId: profile.id, lineUserId: verified.userId },
    body,
  }
}
