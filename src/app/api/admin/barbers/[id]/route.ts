// PATCH /api/admin/barbers/[id] — edit barber profile fields
import { authenticateAdmin } from '@/lib/line/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { auth, body } = await authenticateAdmin(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  if (auth.role === 'barber') {
    return Response.json({ error: 'only admin/owner can edit barbers' }, { status: 403 })
  }

  const { id } = await ctx.params
  const sb = createAdminClient()

  // profiles table — display_name
  const profilePatch: Record<string, unknown> = {}
  if (typeof body?.display_name === 'string') profilePatch.display_name = body.display_name

  // barbers table — bio, exp, specialties, is_active
  const barberPatch: Record<string, unknown> = {}
  if (typeof body?.bio === 'string' || body?.bio === null) barberPatch.bio = body.bio
  if (body?.experience_years != null) barberPatch.experience_years = Number(body.experience_years)
  if (Array.isArray(body?.specialties) || body?.specialties === null) {
    barberPatch.specialties = body.specialties
  }
  if (body?.is_active != null) barberPatch.is_active = !!body.is_active

  if (Object.keys(profilePatch).length === 0 && Object.keys(barberPatch).length === 0) {
    return Response.json({ error: 'nothing to update' }, { status: 400 })
  }

  if (Object.keys(profilePatch).length > 0) {
    const { error } = await sb.from('profiles').update(profilePatch).eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
  }
  if (Object.keys(barberPatch).length > 0) {
    const { error } = await sb.from('barbers').update(barberPatch).eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}
