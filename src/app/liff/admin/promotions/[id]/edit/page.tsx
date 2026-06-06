'use client'

import { use, useEffect, useState } from 'react'
import { useLiff, useIsAdmin } from '@/lib/liff/provider'
import { LiffFrame } from '@/components/liff/liff-frame'
import { PromoForm, type PromoFormValue } from '@/components/admin/promo-form'

function toLocalDatetime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function EditPromoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { loading, error, idToken, appProfile } = useLiff()
  const isAdmin = useIsAdmin()
  const canEdit = appProfile?.role === 'owner' || appProfile?.role === 'admin'

  const [initial, setInitial] = useState<PromoFormValue | null>(null)

  useEffect(() => {
    if (!idToken || !canEdit) return
    fetch(`/api/admin/promotions?idToken=${encodeURIComponent(idToken)}`)
      .then((r) => r.json())
      .then((j) => {
        const promo = (j.promotions ?? []).find((p: { id: string }) => p.id === id)
        if (!promo) return
        setInitial({
          name: promo.name ?? '',
          description: promo.description ?? '',
          code: promo.code ?? '',
          discount_type: promo.discount_type,
          discount_value: String(promo.discount_value),
          min_amount_thb: String(promo.min_amount_thb ?? 0),
          max_discount_thb: promo.max_discount_thb != null ? String(promo.max_discount_thb) : '',
          valid_from: toLocalDatetime(promo.valid_from),
          valid_until: toLocalDatetime(promo.valid_until),
          max_total_uses: promo.max_total_uses != null ? String(promo.max_total_uses) : '',
          max_uses_per_customer: String(promo.max_uses_per_customer ?? 1),
          trigger_type: promo.trigger_type ?? 'manual',
          is_active: !!promo.is_active,
        })
      })
  }, [id, idToken, canEdit])

  if (loading) return <Centered>กำลังโหลด…</Centered>
  if (error) return <Centered>{error}</Centered>
  if (!isAdmin || !canEdit) return <Centered>ต้องเป็น owner/admin</Centered>
  if (!initial) return <Centered>กำลังโหลดข้อมูลโปร…</Centered>

  return (
    <LiffFrame title="แก้โปร" back="/liff/admin/promotions">
      <PromoForm
        initial={initial}
        cancelHref="/liff/admin/promotions"
        onSubmit={async (payload) => {
          const res = await fetch(`/api/admin/promotions/${id}`, {
            method: 'PATCH',
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
