// LINE Messaging API webhook — validates signature with Web Crypto and dispatches
// events to handlers.

import { replyText, welcomeText } from '@/lib/line/notify'

type LineEvent = {
  type: string
  timestamp: number
  replyToken?: string
  source?: { type: string; userId?: string }
  message?: { type: string; text?: string }
  [key: string]: unknown
}

async function verifyLineSignature(body: string, signature: string, secret: string): Promise<boolean> {
  if (!signature) return false
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  const expected = btoa(String.fromCharCode(...new Uint8Array(sigBuf)))
  return expected === signature
}

export async function POST(req: Request) {
  const body = await req.text()
  const signature = req.headers.get('x-line-signature') ?? ''
  const channelSecret = process.env.LINE_CHANNEL_SECRET

  if (!channelSecret) {
    return new Response('LINE_CHANNEL_SECRET not configured', { status: 500 })
  }

  const valid = await verifyLineSignature(body, signature, channelSecret)
  if (!valid) return new Response('Invalid signature', { status: 401 })

  let events: LineEvent[] = []
  try {
    const parsed = JSON.parse(body) as { events?: LineEvent[] }
    events = parsed.events ?? []
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  // Handle events in parallel — LINE expects a fast 200 reply
  await Promise.allSettled(events.map(handleEvent))

  return Response.json({ ok: true })
}

async function handleEvent(event: LineEvent) {
  const replyToken = event.replyToken
  const userId = event.source?.userId
  console.log('[LINE webhook]', event.type, userId ?? '-')

  if (!replyToken) return

  switch (event.type) {
    case 'follow':
      // User added the OA as a friend
      await replyText({
        replyToken,
        text: welcomeText(),
        recipientLineId: userId,
        templateKey: 'welcome',
      })
      return

    case 'message':
      if (event.message?.type === 'text') {
        await handleTextMessage(replyToken, userId, event.message.text ?? '')
      }
      return

    default:
      return
  }
}

const LIFF_URL = process.env.NEXT_PUBLIC_LIFF_ID
  ? `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}`
  : ''

async function handleTextMessage(replyToken: string, userId: string | undefined, text: string) {
  const t = text.trim().toLowerCase()

  let reply: string
  if (/(จอง|book|คิว|queue)/.test(t)) {
    reply = `📅 จองคิวได้ที่นี่:\n${LIFF_URL}`
  } else if (/(เวลา|เปิด|hours)/.test(t)) {
    reply = '🕙 เราเปิดทุกวัน 10:00 — 21:00\n📍 สทิงหม้อ สงขลา'
  } else if (/(ราคา|price|บริการ)/.test(t)) {
    reply = `✂️ ดูบริการ + ราคาทั้งหมดได้ที่:\n${LIFF_URL}/services`
  } else if (/(ติดต่อ|เบอร์|contact|phone)/.test(t)) {
    reply = '📞 ติดต่อร้าน: 099-448-9663'
  } else {
    reply = `👋 สวัสดีครับ!\nจองคิวได้ที่ ${LIFF_URL}\nหรือพิมพ์ "เวลา", "ราคา", "ติดต่อ"`
  }

  await replyText({
    replyToken,
    text: reply,
    recipientLineId: userId,
    templateKey: 'auto_reply',
  })
}

// LINE Console GET-pings before allowing Verify
export async function GET() {
  return Response.json({ status: 'webhook ready' })
}
