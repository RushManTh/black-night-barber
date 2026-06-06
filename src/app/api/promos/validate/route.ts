// POST /api/promos/validate — { idToken?, code, service_ids[] }
// Returns discount + promo details if applicable. Anonymous calls allowed
// (returns generic info) but customer-specific limits only verified when idToken provided.

import { verifyLineIdToken } from '@/lib/line/verify'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  computeDiscount,
  describeValidationError,
  validatePromo,
  type Promotion,
} from '@/lib/promo'

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    idToken?: string
    code?: string
    service_ids?: string[]
  } | null

  const code = body?.code?.toUpperCase().trim()
  const serviceIds = Array.isArray(body?.service_ids) ? body!.service_ids : []
  if (!code || serviceIds.length === 0) {
    return Response.json({ error: 'code and service_ids required' }, { status: 400 })
  }

  const sb = createAdminClient()

  // Look up promo by code
  const { data: promo } = await sb
    .from('promotions')
    .select('*')
    .eq('code', code)
    .maybeSingle()
  if (!promo) {
    return Response.json({ ok: false, error: describeValidationError('NOT_FOUND') }, { status: 404 })
  }

  // Sum subtotal from services
  const { data: services } = await sb
    .from('services')
    .select('price_thb')
    .in('id', serviceIds)
  const subtotal = (services ?? []).reduce((a, s) => a + Number(s.price_thb), 0)

  // Resolve customer + their usage count (if idToken given)
  let customerUses = 0
  if (body?.idToken) {
    const verified = await verifyLineIdToken(body.idToken)
    if (verified.ok) {
      const { data: prof } = await sb
        .from('profiles')
        .select('id')
        .eq('line_user_id', verified.userId)
        .maybeSingle()
      if (prof) {
        const { count } = await sb
          .from('promotion_usages')
          .select('id', { count: 'exact', head: true })
          .eq('promotion_id', promo.id)
          .eq('customer_id', prof.id)
        customerUses = count ?? 0
      }
    }
  }

  const result = validatePromo({
    promo: promo as Promotion,
    subtotal,
    serviceIds,
    customerUses,
  })

  if (!result.ok) {
    return Response.json({ ok: false, error: describeValidationError(result.reason) }, { status: 409 })
  }

  const discount = computeDiscount(promo as Promotion, subtotal)
  return Response.json({
    ok: true,
    promotion: {
      id: promo.id,
      name: promo.name,
      code: promo.code,
      discount_type: promo.discount_type,
      discount_value: promo.discount_value,
    },
    subtotal,
    discount,
    total: Math.max(0, subtotal - discount),
  })
}
