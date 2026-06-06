// POST /api/reviews — customer creates review for a completed booking
// GET  /api/reviews?barber_id=... — public list (no auth)
import { authenticate } from '@/lib/line/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const VALID_TAGS = ['ฝีมือดี', 'ตรงเวลา', 'สุภาพ', 'สะอาด', 'แนะนำ', 'ราคาดี']

export async function POST(req: Request) {
  const { auth, body } = await authenticate(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const bookingId = typeof body?.booking_id === 'string' ? body.booking_id : null
  const rating = Number(body?.rating ?? 0)
  const comment = typeof body?.comment === 'string' ? body.comment : null
  const tagsRaw = Array.isArray(body?.tags) ? (body!.tags as string[]) : []
  const tags = tagsRaw.filter((t) => VALID_TAGS.includes(t))
  const isAnonymous = !!body?.is_anonymous

  if (!bookingId) return Response.json({ error: 'booking_id required' }, { status: 400 })
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return Response.json({ error: 'rating must be 1..5' }, { status: 400 })
  }

  const sb = createAdminClient()

  // Verify the booking belongs to the caller, is completed, and has no review
  const { data: booking } = await sb
    .from('bookings')
    .select('id, customer_id, barber_id, state')
    .eq('id', bookingId)
    .maybeSingle()
  if (!booking) return Response.json({ error: 'booking not found' }, { status: 404 })
  if (booking.customer_id !== auth.userId) {
    return Response.json({ error: 'forbidden' }, { status: 403 })
  }
  if (booking.state !== 'completed') {
    return Response.json({ error: 'can only review completed bookings' }, { status: 409 })
  }

  const { data: existing } = await sb
    .from('reviews')
    .select('id')
    .eq('booking_id', bookingId)
    .maybeSingle()
  if (existing) {
    return Response.json({ error: 'already reviewed' }, { status: 409 })
  }

  const { data: created, error: insertErr } = await sb
    .from('reviews')
    .insert({
      booking_id: bookingId,
      customer_id: auth.userId,
      barber_id: booking.barber_id,
      rating,
      comment,
      tags: tags.length > 0 ? tags : null,
      is_anonymous: isAnonymous,
    })
    .select('id')
    .single()
  if (insertErr) return Response.json({ error: insertErr.message }, { status: 500 })

  // Update barber aggregate stats
  await refreshBarberStats(sb, booking.barber_id)

  return Response.json({ ok: true, review_id: created.id })
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const barberId = url.searchParams.get('barber_id')
  const sb = await createClient()

  let q = sb
    .from('reviews')
    .select(
      'id, rating, comment, tags, is_anonymous, created_at, ' +
        'customer:customers(profile:profiles(display_name)), ' +
        'admin_reply, admin_replied_at'
    )
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .limit(50)

  if (barberId) q = q.eq('barber_id', barberId)

  const { data, error } = await q
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ reviews: data ?? [] })
}

async function refreshBarberStats(
  sb: ReturnType<typeof createAdminClient>,
  barberId: string
) {
  const { data } = await sb
    .from('reviews')
    .select('rating')
    .eq('barber_id', barberId)
    .eq('is_published', true)
  const ratings = (data ?? []) as Array<{ rating: number }>
  const count = ratings.length
  const avg = count > 0
    ? Math.round((ratings.reduce((a, r) => a + r.rating, 0) / count) * 10) / 10
    : 0
  await sb
    .from('barbers')
    .update({ total_reviews: count, avg_rating: avg })
    .eq('id', barberId)
}
