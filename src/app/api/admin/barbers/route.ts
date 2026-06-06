// POST /api/admin/barbers — create a new barber (auth user + profile + barber + schedule + services)
import { authenticateAdmin } from '@/lib/line/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'

const BRANCH_ID = '00000000-0000-0000-0000-000000000001'

type Body = {
  display_name: string
  bio?: string | null
  experience_years?: number | null
  specialties?: string[] | null
}

export async function POST(req: Request) {
  const { auth, body } = await authenticateAdmin(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  if (auth.role === 'barber') {
    return Response.json({ error: 'only admin/owner can add barbers' }, { status: 403 })
  }

  const b = body as unknown as Body
  if (!b?.display_name) {
    return Response.json({ error: 'display_name required' }, { status: 400 })
  }

  const sb = createAdminClient()

  // 1. auth user
  const fakeEmail = `barber.${Date.now()}.${Math.floor(Math.random() * 1e6)}@blacknight.local`
  const { data: authUser, error: authErr } = await sb.auth.admin.createUser({
    email: fakeEmail,
    email_confirm: true,
    user_metadata: { source: 'admin_create_barber' },
  })
  if (authErr || !authUser.user) {
    return Response.json({ error: authErr?.message ?? 'createUser failed' }, { status: 500 })
  }
  const userId = authUser.user.id

  // 2. profile
  const { error: profileErr } = await sb.from('profiles').insert({
    id: userId,
    display_name: b.display_name,
    role: 'barber',
  })
  if (profileErr) return Response.json({ error: profileErr.message }, { status: 500 })

  // 3. barber
  const { error: barberErr } = await sb.from('barbers').insert({
    id: userId,
    branch_id: BRANCH_ID,
    bio: b.bio ?? null,
    experience_years: b.experience_years ?? null,
    specialties: b.specialties ?? null,
    is_owner: false,
    display_order: 99,
  })
  if (barberErr) return Response.json({ error: barberErr.message }, { status: 500 })

  // 4. default weekly schedule (7 days, 10-21)
  const schedules = Array.from({ length: 7 }, (_, day) => ({
    barber_id: userId,
    day_of_week: day,
    start_time: '10:00',
    end_time: '21:00',
  }))
  await sb.from('barber_schedules').insert(schedules)

  // 5. link to all current services
  const { data: services } = await sb.from('services').select('id').eq('is_active', true)
  if (services && services.length > 0) {
    await sb.from('barber_services').insert(
      services.map((s) => ({ barber_id: userId, service_id: s.id }))
    )
  }

  return Response.json({ ok: true, barber_id: userId })
}
