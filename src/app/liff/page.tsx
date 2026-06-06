'use client'

import { useLiff } from '@/lib/liff/provider'

export default function LiffHomePage() {
  const { ready, loading, error, profile, isInClient } = useLiff()

  if (loading) {
    return (
      <main style={{ padding: 24, fontFamily: 'system-ui' }}>
        <p>⏳ กำลังเชื่อมต่อ LINE…</p>
      </main>
    )
  }

  if (error) {
    return (
      <main style={{ padding: 24, fontFamily: 'system-ui' }}>
        <h1 style={{ color: 'crimson' }}>❌ LIFF Error</h1>
        <pre>{error}</pre>
        <p style={{ marginTop: 16, color: '#666' }}>
          หน้านี้ต้องเปิดผ่าน LINE Official Account หรือ LIFF URL จึงจะใช้งานได้
        </p>
      </main>
    )
  }

  if (!ready || !profile) return null

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 480 }}>
      <h1>👋 สวัสดี {profile.displayName}</h1>

      {profile.pictureUrl && (
        <img
          src={profile.pictureUrl}
          alt={profile.displayName}
          width={96}
          height={96}
          style={{ borderRadius: '50%', marginTop: 16 }}
        />
      )}

      <dl style={{ marginTop: 24, lineHeight: 1.8 }}>
        <dt style={{ fontWeight: 600 }}>LINE userId</dt>
        <dd style={{ fontFamily: 'monospace', fontSize: 13 }}>{profile.userId}</dd>

        <dt style={{ fontWeight: 600, marginTop: 8 }}>Status message</dt>
        <dd>{profile.statusMessage ?? '—'}</dd>

        <dt style={{ fontWeight: 600, marginTop: 8 }}>เปิดในแอป LINE?</dt>
        <dd>{isInClient ? '✅ ใช่' : '❌ ไม่ใช่ (external browser)'}</dd>
      </dl>

      <p style={{ marginTop: 24, color: '#666', fontSize: 14 }}>
        ถ้าเห็นข้อมูลครบ = LIFF ต่อสำเร็จ ✅
      </p>
    </main>
  )
}
