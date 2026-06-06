// POST /api/cron/waitlist
// Picks up newly 'notified' waitlist entries that haven't been LINE-pushed yet
// (no notifications row with template 'waitlist_offered' for this booking),
// sends a LINE push to the customer with a confirm link.

import { createAdminClient } from '@/lib/supabase/admin'
import { pushText } from '@/lib/line/notify'

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

type Row = {
  id: string
  customer_id: string
  reserved_booking_id: string | null
  expires_at: string | null
  customer: { profile: { line_user_id: string | null } | null } | null
  booking: {
    slot_time: string
    barber: { profile: { display_name: string } | null } | null
  } | null
}

const DATE_FMT = new Intl.DateTimeFormat('th-TH', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Bangkok',
})

export async function POST(req: Request) {
  if (!isAuthorized(req)) return new Response('Unauthorized', { status: 401 })

  const sb = createAdminClient()

  const { data, error } = await sb
    .from('waitlist')
    .select(
      'id, customer_id, reserved_booking_id, expires_at, ' +
        'customer:customers(profile:profiles(line_user_id)), ' +
        'booking:bookings!waitlist_reserved_booking_id_fkey(slot_time, barber:barbers(profile:profiles(display_name)))'
    )
    .eq('status', 'notified')
    .gt('expires_at', new Date().toISOString())

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []) as unknown as Row[]
  let sent = 0
  let skipped = 0

  for (const r of rows) {
    const bookingId = r.reserved_booking_id
    if (!bookingId) continue

    // Skip if we already pushed for this booking
    const { count } = await sb
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('booking_id', bookingId)
      .eq('template_key', 'waitlist_offered')
      .eq('status', 'sent')
    if ((count ?? 0) > 0) {
      skipped++
      continue
    }

    const lineId = r.customer?.profile?.line_user_id
    const slotTime = r.booking?.slot_time
    const barberName = r.booking?.barber?.profile?.display_name ?? 'ช่างของเรา'
    if (!lineId || !slotTime) continue

    const liffId = process.env.NEXT_PUBLIC_LIFF_ID
    const confirmUrl = liffId ? `https://liff.line.me/${liffId}/my-queue` : ''
    const text =
      `🎉 มีคิวว่างแล้ว!\n` +
      `📅 ${DATE_FMT.format(new Date(slotTime))}\n` +
      `💈 ช่าง: ${barberName}\n\n` +
      `⏳ ยืนยันภายในเวลาที่กำหนด ที่:\n${confirmUrl}`

    const res = await pushText({
      to: lineId,
      customerId: r.customer_id,
      bookingId,
      templateKey: 'waitlist_offered',
      text,
    })
    if (res.ok) sent++
  }

  return Response.json({ checked: rows.length, sent, skipped })
}

export async function GET() {
  return Response.json({ status: 'waitlist cron ready' })
}
