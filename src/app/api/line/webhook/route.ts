// LINE Messaging API webhook — validates signature with Web Crypto
// (avoid importing @line/bot-sdk to keep bundle workers-friendly)

type LineWebhookEvent = {
  type: string
  timestamp: number
  source?: { type: string; userId?: string; groupId?: string; roomId?: string }
  replyToken?: string
  message?: { type: string; id: string; text?: string }
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
    console.error('[LINE webhook] LINE_CHANNEL_SECRET not configured')
    return new Response('LINE_CHANNEL_SECRET not configured', { status: 500 })
  }

  const valid = await verifyLineSignature(body, signature, channelSecret)
  if (!valid) {
    console.warn('[LINE webhook] Invalid signature')
    return new Response('Invalid signature', { status: 401 })
  }

  let events: LineWebhookEvent[] = []
  try {
    const parsed = JSON.parse(body) as { events?: LineWebhookEvent[] }
    events = parsed.events ?? []
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  for (const event of events) {
    console.log('[LINE webhook]', event.type, event.source?.userId ?? '-')
    // TODO: route by event.type — follow, message, postback, etc.
  }

  return Response.json({ ok: true })
}

// LINE Console ใช้ GET เพื่อ ping ก่อนกด Verify
export async function GET() {
  return Response.json({ status: 'webhook ready' })
}
