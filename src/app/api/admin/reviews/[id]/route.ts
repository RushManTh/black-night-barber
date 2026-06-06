// PATCH /api/admin/reviews/[id] — admin reply or unpublish
import { authenticateAdmin } from '@/lib/line/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { auth, body } = await authenticateAdmin(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { id } = await ctx.params
  const reply = typeof body?.admin_reply === 'string' ? body.admin_reply : undefined
  const unpublish = body?.unpublish === true
  const publish = body?.publish === true

  const patch: Record<string, unknown> = {}
  if (reply !== undefined) {
    patch.admin_reply = reply
    patch.admin_replied_at = new Date().toISOString()
    patch.admin_replied_by = auth.userId
  }
  if (unpublish) patch.is_published = false
  if (publish) patch.is_published = true

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: 'nothing to update' }, { status: 400 })
  }

  const sb = createAdminClient()
  const { data: review } = await sb
    .from('reviews')
    .update(patch)
    .eq('id', id)
    .select('barber_id')
    .single()
  if (!review) return Response.json({ error: 'review not found' }, { status: 404 })

  // Recompute barber stats if publish state changed
  if (unpublish || publish) {
    const { data } = await sb
      .from('reviews')
      .select('rating')
      .eq('barber_id', review.barber_id)
      .eq('is_published', true)
    const ratings = (data ?? []) as Array<{ rating: number }>
    const count = ratings.length
    const avg = count > 0
      ? Math.round((ratings.reduce((a, r) => a + r.rating, 0) / count) * 10) / 10
      : 0
    await sb.from('barbers').update({ total_reviews: count, avg_rating: avg }).eq('id', review.barber_id)
  }

  return Response.json({ ok: true })
}
