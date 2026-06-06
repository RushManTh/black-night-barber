// Helper — verify idToken and ensure the caller is a barber/owner-with-barber-row
import { authenticate } from '@/lib/line/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function authenticateBarber(req: Request) {
  const { auth, body } = await authenticate(req)
  if (!auth.ok) return { auth, body }

  const sb = createAdminClient()
  const { data: prof } = await sb
    .from('profiles')
    .select('role')
    .eq('id', auth.userId)
    .maybeSingle()
  if (!prof) {
    return { auth: { ok: false as const, status: 404, error: 'profile not found' }, body }
  }
  if (!['barber', 'admin', 'owner'].includes(prof.role)) {
    return { auth: { ok: false as const, status: 403, error: 'staff only' }, body }
  }

  // Verify they have a barber row (owner may also be a barber)
  const { data: barber } = await sb.from('barbers').select('id').eq('id', auth.userId).maybeSingle()
  if (!barber) {
    return {
      auth: { ok: false as const, status: 403, error: 'not registered as barber' },
      body,
    }
  }

  return { auth: { ok: true as const, userId: auth.userId, role: prof.role }, body }
}
