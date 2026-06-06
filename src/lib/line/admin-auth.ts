// Admin auth helper — verifies the caller is barber/admin/owner before allowing
// privileged mutations.
import { authenticate } from '@/lib/line/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_ROLES = ['barber', 'admin', 'owner'] as const
type AdminRole = (typeof ADMIN_ROLES)[number]

export type AdminAuthOk = {
  ok: true
  userId: string
  lineUserId: string
  role: AdminRole
}
export type AdminAuthErr = { ok: false; status: number; error: string }

export async function authenticateAdmin(
  req: Request
): Promise<{ auth: AdminAuthOk | AdminAuthErr; body: Record<string, unknown> | null }> {
  const { auth, body } = await authenticate(req)
  if (!auth.ok) return { auth, body }

  const sb = createAdminClient()
  const { data: profile } = await sb
    .from('profiles')
    .select('role')
    .eq('id', auth.userId)
    .single()

  const role = profile?.role
  if (!role || !ADMIN_ROLES.includes(role as AdminRole)) {
    return {
      auth: { ok: false, status: 403, error: 'admin access required' },
      body,
    }
  }

  return {
    auth: { ok: true, userId: auth.userId, lineUserId: auth.lineUserId, role: role as AdminRole },
    body,
  }
}
