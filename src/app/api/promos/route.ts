// GET /api/promos — currently-active promotions (anyone can read)
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const sb = await createClient()
  const now = new Date().toISOString()

  const { data, error } = await sb
    .from('promotions')
    .select(
      'id, name, description, code, icon, discount_type, discount_value, min_amount_thb, max_discount_thb, valid_from, valid_until, trigger_type'
    )
    .eq('is_active', true)
    .lte('valid_from', now)
    .gte('valid_until', now)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ promos: data ?? [] })
}
