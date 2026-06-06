// POST /api/cron/remind
// Called by Supabase pg_cron every 5 minutes via pg_net.http_post.
// Finds confirmed bookings within 30 minutes that haven't been reminded yet,
// sends LINE push, and marks reminder_sent_at.

import { createAdminClient } from '@/lib/supabase/admin'
import { bookingReminderText, pushText } from '@/lib/line/notify'

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

type Row = {
  id: string
  slot_time: string
  customer_id: string
  customer: { profile: { line_user_id: string | null } | null } | null
  barber: { profile: { display_name: string } | null } | null
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const sb = createAdminClient()

  // Confirmed bookings starting within the next 35 minutes (5 min buffer to
  // catch slots that fall between cron runs)
  const now = new Date()
  const cutoff = new Date(now.getTime() + 35 * 60 * 1000)

  const { data, error } = await sb
    .from('bookings')
    .select(
      'id, slot_time, customer_id, ' +
        'customer:customers(profile:profiles(line_user_id)), ' +
        'barber:barbers(profile:profiles(display_name))'
    )
    .eq('state', 'confirmed')
    .is('reminder_sent_at', null)
    .gt('slot_time', now.toISOString())
    .lte('slot_time', cutoff.toISOString())

  if (error) {
    console.error('[cron/remind] query failed', error)
    return Response.json({ error: error.message }, { status: 500 })
  }

  const rows = (data ?? []) as unknown as Row[]
  let sent = 0
  let failed = 0

  for (const r of rows) {
    const lineId = r.customer?.profile?.line_user_id
    if (!lineId) continue
    const result = await pushText({
      to: lineId,
      customerId: r.customer_id,
      bookingId: r.id,
      templateKey: 'reminder_30min',
      text: bookingReminderText({
        slotTime: r.slot_time,
        barber: r.barber?.profile?.display_name ?? 'ช่างของเรา',
      }),
    })
    if (result.ok) {
      sent++
      await sb
        .from('bookings')
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq('id', r.id)
    } else {
      failed++
    }
  }

  return Response.json({ checked: rows.length, sent, failed })
}

// Health check endpoint (no auth required)
export async function GET() {
  return Response.json({ status: 'reminder cron ready' })
}
