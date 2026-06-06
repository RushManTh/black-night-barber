// Verify LIFF id_token via LINE's public endpoint.
// Returns the LINE userId (sub) plus optional profile claims when valid.

type VerifyOk = {
  ok: true
  userId: string
  name?: string
  picture?: string
  email?: string
}
type VerifyErr = { ok: false; error: string }
export type VerifyResult = VerifyOk | VerifyErr

export async function verifyLineIdToken(idToken: string): Promise<VerifyResult> {
  // LIFF id_tokens are issued by the linked LINE Login channel, not the
  // Messaging API channel — so the `aud` claim is LINE_LOGIN_CHANNEL_ID.
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID
  if (!channelId) return { ok: false, error: 'LINE_LOGIN_CHANNEL_ID not configured' }
  if (!idToken) return { ok: false, error: 'idToken missing' }

  const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
  })

  if (!res.ok) {
    const text = await res.text()
    // Decode aud from JWT payload (unverified) to help debug audience mismatch.
    let aud: string | undefined
    try {
      const payload = JSON.parse(
        atob(idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))
      )
      aud = payload.aud
    } catch { /* ignore */ }
    return {
      ok: false,
      error: `LINE verify ${res.status}: ${text}${aud ? ` | token.aud=${aud} | sent client_id=${channelId}` : ''}`,
    }
  }

  const data = (await res.json()) as {
    sub: string
    name?: string
    picture?: string
    email?: string
  }
  return {
    ok: true,
    userId: data.sub,
    name: data.name,
    picture: data.picture,
    email: data.email,
  }
}
