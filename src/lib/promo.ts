// Shared promo validation + discount calculation logic.
// Used by /api/promos/validate, /api/bookings POST, and admin preview.

export type Promotion = {
  id: string
  code: string | null
  discount_type: 'percent' | 'fixed' | 'combo_price'
  discount_value: number
  min_amount_thb: number
  max_discount_thb: number | null
  applicable_service_ids: string[] | null
  valid_from: string
  valid_until: string
  max_total_uses: number | null
  max_uses_per_customer: number
  current_uses: number
  is_active: boolean
}

export type ValidationError =
  | 'NOT_FOUND'
  | 'INACTIVE'
  | 'NOT_STARTED'
  | 'EXPIRED'
  | 'MIN_AMOUNT'
  | 'SERVICE_NOT_APPLICABLE'
  | 'OVER_TOTAL_LIMIT'
  | 'OVER_CUSTOMER_LIMIT'

const ERROR_TEXT: Record<ValidationError, string> = {
  NOT_FOUND: 'ไม่พบรหัสคูปองนี้',
  INACTIVE: 'คูปองถูกปิดใช้งาน',
  NOT_STARTED: 'คูปองยังไม่เริ่มใช้งาน',
  EXPIRED: 'คูปองหมดอายุแล้ว',
  MIN_AMOUNT: 'ยอดไม่ถึงขั้นต่ำที่ใช้คูปองได้',
  SERVICE_NOT_APPLICABLE: 'คูปองนี้ใช้กับบริการที่เลือกไม่ได้',
  OVER_TOTAL_LIMIT: 'คูปองนี้ถูกใช้ครบจำนวนแล้ว',
  OVER_CUSTOMER_LIMIT: 'คุณใช้คูปองนี้ครบจำนวนครั้งแล้ว',
}

export function describeValidationError(err: ValidationError): string {
  return ERROR_TEXT[err]
}

export function validatePromo(opts: {
  promo: Promotion
  subtotal: number
  serviceIds: string[]
  customerUses: number
}): { ok: true } | { ok: false; reason: ValidationError } {
  const { promo, subtotal, serviceIds, customerUses } = opts
  const now = new Date()

  if (!promo.is_active) return { ok: false, reason: 'INACTIVE' }
  if (new Date(promo.valid_from) > now) return { ok: false, reason: 'NOT_STARTED' }
  if (new Date(promo.valid_until) < now) return { ok: false, reason: 'EXPIRED' }
  if (subtotal < promo.min_amount_thb) return { ok: false, reason: 'MIN_AMOUNT' }

  if (promo.max_total_uses != null && promo.current_uses >= promo.max_total_uses) {
    return { ok: false, reason: 'OVER_TOTAL_LIMIT' }
  }
  if (customerUses >= promo.max_uses_per_customer) {
    return { ok: false, reason: 'OVER_CUSTOMER_LIMIT' }
  }

  if (promo.applicable_service_ids && promo.applicable_service_ids.length > 0) {
    const has = serviceIds.some((id) => promo.applicable_service_ids!.includes(id))
    if (!has) return { ok: false, reason: 'SERVICE_NOT_APPLICABLE' }
  }

  return { ok: true }
}

export function computeDiscount(promo: Promotion, subtotal: number): number {
  switch (promo.discount_type) {
    case 'percent': {
      let d = (subtotal * promo.discount_value) / 100
      if (promo.max_discount_thb != null) d = Math.min(d, promo.max_discount_thb)
      return roundBaht(Math.min(d, subtotal))
    }
    case 'fixed':
      return roundBaht(Math.min(promo.discount_value, subtotal))
    case 'combo_price':
      // discount_value IS the new total; discount = subtotal - new
      return roundBaht(Math.max(0, subtotal - promo.discount_value))
    default:
      return 0
  }
}

function roundBaht(x: number): number {
  return Math.round(x * 100) / 100
}
