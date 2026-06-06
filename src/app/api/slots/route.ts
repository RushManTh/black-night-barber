// GET /api/slots?barber_id=...&date=YYYY-MM-DD&duration=30
// Returns available slot starts for the given barber + date + service total duration.
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const barberId = url.searchParams.get('barber_id')
  const date = url.searchParams.get('date')
  const duration = Number(url.searchParams.get('duration') ?? '30')

  if (!barberId || !date) {
    return Response.json({ error: 'barber_id and date required' }, { status: 400 })
  }
  if (!Number.isFinite(duration) || duration < 5) {
    return Response.json({ error: 'invalid duration' }, { status: 400 })
  }

  const sb = await createClient()
  const { data, error } = await sb.rpc('get_available_slots', {
    p_barber_id: barberId,
    p_date: date,
    p_duration: duration,
  })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ slots: data ?? [] })
}
