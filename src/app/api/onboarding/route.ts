// POST /api/onboarding — first-time setup: phone (required) + birthday + consents
import { authenticate } from '@/lib/line/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const CONSENT_VERSION = '1.0'

export async function POST(req: Request) {
  const { auth, body } = await authenticate(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const phone = typeof body?.phone === 'string' ? body.phone.trim() : null
  const birthday = typeof body?.birthday === 'string' ? body.birthday : null
  const hairstyles = Array.isArray(body?.preferred_hairstyles)
    ? (body!.preferred_hairstyles as string[]).filter(Boolean)
    : []
  const pdpaOk = body?.pdpa_consent === true
  const marketingOk = body?.marketing_consent === true

  if (!phone || !/^\d{9,10}$/.test(phone)) {
    return Response.json({ error: 'phone required (9-10 digits)' }, { status: 400 })
  }
  if (!pdpaOk) {
    return Response.json({ error: 'pdpa_consent required' }, { status: 400 })
  }

  const sb = createAdminClient()

  // Update profile + customer
  const { error: profileErr } = await sb
    .from('profiles')
    .update({ phone })
    .eq('id', auth.userId)
  if (profileErr) return Response.json({ error: profileErr.message }, { status: 500 })

  const customerPatch: Record<string, unknown> = {
    phone_verified: false, // OTP later (Phase 2)
  }
  if (birthday) customerPatch.birthday = birthday
  if (hairstyles.length > 0) customerPatch.preferred_hairstyles = hairstyles

  await sb.from('customers').update(customerPatch).eq('id', auth.userId)

  // Record consents
  const now = new Date().toISOString()
  const consents: Array<Record<string, unknown>> = [
    {
      customer_id: auth.userId,
      consent_type: 'pdpa_general',
      consent_version: CONSENT_VERSION,
      is_granted: true,
      granted_at: now,
    },
  ]
  if (marketingOk) {
    consents.push({
      customer_id: auth.userId,
      consent_type: 'marketing',
      consent_version: CONSENT_VERSION,
      is_granted: true,
      granted_at: now,
    })
  }
  await sb.from('consent_records').insert(consents)

  return Response.json({ ok: true })
}
