// LINE Messaging — push (paid quota) + reply (free within 60s of an event).
// Both helpers log to the `notifications` table for audit/debug.

import { createAdminClient } from '@/lib/supabase/admin'

type Message = { type: 'text'; text: string } | Record<string, unknown>

async function callLine(endpoint: string, body: unknown): Promise<{ ok: boolean; error?: string; raw?: unknown }> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) return { ok: false, error: 'LINE_CHANNEL_ACCESS_TOKEN not configured' }

  const res = await fetch(`https://api.line.me/v2/bot/message/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    return { ok: false, error: `LINE ${endpoint} ${res.status}: ${text}` }
  }
  return { ok: true }
}

/**
 * Send a push message to a LINE user. Costs 1 message from your monthly quota.
 * Use for things the user wouldn't reasonably expect a webhook response to (e.g.,
 * "your booking is confirmed" after LIFF interaction, reminders, admin actions).
 */
export async function pushText(opts: {
  to: string                         // LINE userId (from profiles.line_user_id)
  text: string
  customerId?: string                // for notifications.customer_id
  bookingId?: string
  templateKey?: string
}): Promise<{ ok: boolean; error?: string }> {
  const result = await callLine('push', { to: opts.to, messages: [{ type: 'text', text: opts.text }] })
  await logNotification({
    channel: 'line',
    recipient: opts.to,
    body: opts.text,
    customerId: opts.customerId,
    bookingId: opts.bookingId,
    templateKey: opts.templateKey,
    status: result.ok ? 'sent' : 'failed',
    error: result.error,
  })
  return result
}

/**
 * Reply within 60 seconds of receiving a webhook event. FREE — does not count
 * toward push quota. Always prefer this when possible.
 */
export async function replyText(opts: {
  replyToken: string
  text: string
  customerId?: string
  bookingId?: string
  templateKey?: string
  recipientLineId?: string
}): Promise<{ ok: boolean; error?: string }> {
  const result = await callLine('reply', {
    replyToken: opts.replyToken,
    messages: [{ type: 'text', text: opts.text }],
  })
  await logNotification({
    channel: 'line',
    recipient: opts.recipientLineId ?? 'reply-token',
    body: opts.text,
    customerId: opts.customerId,
    bookingId: opts.bookingId,
    templateKey: opts.templateKey,
    status: result.ok ? 'sent' : 'failed',
    error: result.error,
  })
  return result
}

async function logNotification(row: {
  channel: 'line' | 'sms' | 'email' | 'in_app'
  recipient: string
  body: string
  customerId?: string
  bookingId?: string
  templateKey?: string
  status: 'sent' | 'failed' | 'pending'
  error?: string
}) {
  try {
    const sb = createAdminClient()
    await sb.from('notifications').insert({
      channel: row.channel,
      recipient: row.recipient,
      body: row.body,
      customer_id: row.customerId ?? null,
      booking_id: row.bookingId ?? null,
      template_key: row.templateKey ?? null,
      status: row.status,
      error_message: row.error ?? null,
      sent_at: row.status === 'sent' ? new Date().toISOString() : null,
    })
  } catch {
    // never fail the parent operation because of a logging error
  }
}

/* ------------------------------------------------------------------ */
/* Pre-built message bodies                                            */
/* ------------------------------------------------------------------ */

const DATE_FMT = new Intl.DateTimeFormat('th-TH', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export function bookingConfirmedText(data: {
  slotTime: string
  services: string[]
  barber: string
  total: number
}) {
  return (
    `✅ ยืนยันการจองเรียบร้อย\n` +
    `📅 ${DATE_FMT.format(new Date(data.slotTime))}\n` +
    `✂️ ${data.services.join(' + ')}\n` +
    `💈 ช่าง: ${data.barber}\n` +
    `💰 ฿${data.total.toLocaleString()}\n\n` +
    `BLACK NIGHT BARBER SHOP · สทิงหม้อ สงขลา`
  )
}

export function bookingCancelledText(data: { slotTime: string; byAdmin: boolean }) {
  if (data.byAdmin) {
    return (
      `❌ คิวของคุณ ${DATE_FMT.format(new Date(data.slotTime))} ถูกยกเลิกโดยทางร้าน\n` +
      `ขออภัยในความไม่สะดวก สามารถจองคิวใหม่ได้ทันที`
    )
  }
  return `✓ ยกเลิกคิว ${DATE_FMT.format(new Date(data.slotTime))} เรียบร้อย`
}

export function bookingCompletedText(data: { total: number; pointsEarned: number }) {
  return (
    `🎉 ขอบคุณที่ใช้บริการ!\n` +
    `💰 ยอด ฿${data.total.toLocaleString()}\n` +
    `⭐ ได้รับ ${data.pointsEarned} แต้ม\n\n` +
    `รีวิวให้คะแนนช่างเพื่อช่วยเหลือลูกค้าคนอื่น 🙏`
  )
}

export function bookingReminderText(data: { slotTime: string; barber: string }) {
  return (
    `⏰ คิวของคุณอีก 30 นาที!\n` +
    `📅 ${DATE_FMT.format(new Date(data.slotTime))}\n` +
    `💈 ช่าง: ${data.barber}\n\n` +
    `เจอกันที่ร้านนะครับ 🙏`
  )
}

export function welcomeText() {
  return (
    `👋 ยินดีต้อนรับสู่ BLACK NIGHT BARBER SHOP\n` +
    `🌙 ร้านตัดผมพรีเมียม สทิงหม้อ สงขลา\n` +
    `📅 จองคิวง่ายๆ ผ่านเมนูด้านล่าง\n` +
    `📞 ติดต่อ 099-448-9663`
  )
}
