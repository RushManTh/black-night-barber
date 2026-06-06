'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useLiff, useIsAdmin } from '@/lib/liff/provider'
import { LiffFrame } from '@/components/liff/liff-frame'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type Promo = {
  id: string
  name: string
  code: string | null
  discount_type: 'percent' | 'fixed' | 'combo_price'
  discount_value: number
  current_uses: number
  max_total_uses: number | null
  valid_from: string
  valid_until: string
  is_active: boolean
  trigger_type: string
}

const DATE_FMT = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })

export default function AdminPromosPage() {
  const { loading, error, idToken, appProfile } = useLiff()
  const isAdmin = useIsAdmin()
  const canEdit = appProfile?.role === 'owner' || appProfile?.role === 'admin'

  const [promos, setPromos] = useState<Promo[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!idToken) return
    const res = await fetch(`/api/admin/promotions?idToken=${encodeURIComponent(idToken)}`)
    if (!res.ok) return
    const data = await res.json()
    setPromos((data.promotions ?? []) as Promo[])
  }, [idToken])

  useEffect(() => {
    if (isAdmin && idToken) load()
  }, [isAdmin, idToken, load])

  async function softDelete(id: string) {
    if (!idToken) return
    if (!confirm('ปิดใช้งานโปรนี้?')) return
    setBusyId(id)
    await fetch(`/api/admin/promotions/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    })
    setBusyId(null)
    await load()
  }

  if (loading) return <Centered>กำลังโหลด…</Centered>
  if (error) return <Centered>{error}</Centered>
  if (!isAdmin) return <Centered>ต้องเป็นพนักงาน</Centered>

  return (
    <LiffFrame
      title="โปรโมชั่น"
      back="/liff/admin"
      rightSlot={
        canEdit ? (
          <Link href="/liff/admin/promotions/new">
            <Button size="sm">
              <Plus className="mr-1 h-3.5 w-3.5" />
              เพิ่ม
            </Button>
          </Link>
        ) : null
      }
    >
      <div className="space-y-2">
        {promos === null && <p className="text-sm text-muted-foreground">กำลังโหลด…</p>}
        {promos?.length === 0 && (
          <p className="text-sm text-muted-foreground">ยังไม่มีโปรโมชั่น</p>
        )}
        {promos?.map((p) => {
          const now = new Date()
          const expired = new Date(p.valid_until) < now
          const upcoming = new Date(p.valid_from) > now
          return (
            <Card key={p.id} className={`border-border ${!p.is_active ? 'opacity-50' : ''}`}>
              <CardContent className="space-y-2 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <div className="text-sm font-semibold">{p.name}</div>
                      {p.code && (
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {p.code}
                        </Badge>
                      )}
                      {p.trigger_type !== 'manual' && (
                        <Badge variant="secondary" className="text-[10px]">
                          {p.trigger_type}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {discountLabel(p)} · ใช้แล้ว {p.current_uses}
                      {p.max_total_uses != null ? `/${p.max_total_uses}` : ''}
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {DATE_FMT.format(new Date(p.valid_from))} → {DATE_FMT.format(new Date(p.valid_until))}
                    </div>
                  </div>
                  <Badge variant={expired ? 'destructive' : upcoming ? 'outline' : 'default'} className="shrink-0 text-[10px]">
                    {expired ? 'หมดอายุ' : upcoming ? 'จะมา' : p.is_active ? 'ใช้ได้' : 'ปิด'}
                  </Badge>
                </div>
                {canEdit && (
                  <div className="flex gap-1">
                    <Link href={`/liff/admin/promotions/${p.id}/edit`}>
                      <Button size="sm" variant="outline">
                        <Pencil className="mr-1 h-3 w-3" />
                        แก้
                      </Button>
                    </Link>
                    {p.is_active && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === p.id}
                        onClick={() => softDelete(p.id)}
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        ปิด
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </LiffFrame>
  )
}

function discountLabel(p: Promo): string {
  switch (p.discount_type) {
    case 'percent': return `ลด ${p.discount_value}%`
    case 'fixed': return `ลด ฿${p.discount_value}`
    case 'combo_price': return `ราคารวม ฿${p.discount_value}`
  }
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6 text-center text-sm text-muted-foreground">
      {children}
    </main>
  )
}
