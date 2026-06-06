'use client'

import { useLiff, useIsAdmin } from '@/lib/liff/provider'
import { LiffFrame } from '@/components/liff/liff-frame'
import { PromoForm, type PromoFormValue } from '@/components/admin/promo-form'

function initial(): PromoFormValue {
  const now = new Date()
  const month = new Date(now.getTime() + 30 * 86400000)
  const fmt = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  return {
    name: '',
    description: '',
    code: '',
    discount_type: 'percent',
    discount_value: '10',
    min_amount_thb: '0',
    max_discount_thb: '',
    valid_from: fmt(now),
    valid_until: fmt(month),
    max_total_uses: '',
    max_uses_per_customer: '1',
    trigger_type: 'manual',
    is_active: true,
  }
}

export default function NewPromoPage() {
  const { loading, error, idToken, appProfile } = useLiff()
  const isAdmin = useIsAdmin()
  const canEdit = appProfile?.role === 'owner' || appProfile?.role === 'admin'

  if (loading) return <Centered>กำลังโหลด…</Centered>
  if (error) return <Centered>{error}</Centered>
  if (!isAdmin || !canEdit) return <Centered>ต้องเป็น owner/admin</Centered>

  return (
    <LiffFrame title="โปรใหม่" back="/liff/admin/promotions">
      <PromoForm
        initial={initial()}
        cancelHref="/liff/admin/promotions"
        onSubmit={async (payload) => {
          const res = await fetch('/api/admin/promotions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken, ...payload }),
          })
          if (res.ok) return { ok: true }
          const j = await res.json().catch(() => ({ error: 'failed' }))
          return { ok: false, error: j.error ?? 'ผิดพลาด' }
        }}
      />
    </LiffFrame>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6 text-center text-sm text-muted-foreground">
      {children}
    </main>
  )
}
