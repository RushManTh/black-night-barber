'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Clock, Plus, Ticket, X } from 'lucide-react'
import { useLiff } from '@/lib/liff/provider'
import { LiffFrame } from '@/components/liff/liff-frame'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type WaitlistItem = {
  id: string
  preferred_date: string
  time_from: string
  time_to: string
  position: number
  status: 'waiting' | 'notified' | 'expired' | 'cancelled' | 'converted'
  notified_at: string | null
  expires_at: string | null
  reserved_booking_id: string | null
  service: { name: string } | null
  barber: { profile: { display_name: string } | null } | null
}

const DATE_FMT = new Intl.DateTimeFormat('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })

export default function WaitlistPage() {
  const { loading, error, idToken, appProfile } = useLiff()
  const [items, setItems] = useState<WaitlistItem[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!idToken) return
    const res = await fetch(`/api/waitlist?idToken=${encodeURIComponent(idToken)}`)
    const data = await res.json()
    setItems(data.items ?? [])
  }, [idToken])

  useEffect(() => {
    if (idToken) load()
  }, [idToken, load])

  async function handleCancel(id: string) {
    if (!idToken) return
    if (!confirm('ยกเลิกรายการรอคิวนี้?')) return
    setBusyId(id)
    const res = await fetch(`/api/waitlist/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    })
    setBusyId(null)
    if (!res.ok) {
      alert(await res.text())
      return
    }
    await load()
  }

  if (loading) return <Centered>กำลังโหลด…</Centered>
  if (error) return <Centered>{error}</Centered>
  if (!appProfile) return null

  return (
    <LiffFrame
      title="รอคิวว่าง"
      back="/liff"
      rightSlot={
        <Link href="/liff/waitlist/new">
          <Button size="sm">
            <Plus className="mr-1 h-3.5 w-3.5" />
            ขอ
          </Button>
        </Link>
      }
    >
      <p className="text-xs text-muted-foreground">
        เมื่อมีคนยกเลิกคิวที่ตรงเงื่อนไขของคุณ ระบบจะแจ้งทาง LINE ทันที
      </p>

      <div className="mt-5 space-y-3">
        {items === null && <p className="text-sm text-muted-foreground">กำลังโหลด…</p>}
        {items && items.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              <Ticket className="mx-auto h-8 w-8" />
              <p className="mt-2">ยังไม่มีรายการรอคิว</p>
              <Link href="/liff/waitlist/new">
                <Button size="sm" className="mt-4">ขอรอคิว</Button>
              </Link>
            </CardContent>
          </Card>
        )}
        {items?.map((w) => (
          <Card key={w.id} className="border-border">
            <CardContent className="space-y-2 py-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-semibold">
                    {DATE_FMT.format(new Date(w.preferred_date + 'T00:00:00+07:00'))} ·{' '}
                    {w.time_from.slice(0, 5)}-{w.time_to.slice(0, 5)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {w.service?.name} · {w.barber?.profile?.display_name ?? 'ช่างใดก็ได้'}
                  </div>
                </div>
                <StatusBadge status={w.status} position={w.position} />
              </div>
              {w.status === 'notified' && w.expires_at && (
                <div className="rounded bg-emerald-50 p-2 text-xs text-emerald-700">
                  <Clock className="mr-1 inline h-3 w-3" />
                  มีคิวให้คุณแล้ว! ยืนยันที่ <Link href="/liff/my-queue" className="underline">คิวของฉัน</Link> ก่อนหมดเวลา
                </div>
              )}
              {(w.status === 'waiting' || w.status === 'notified') && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === w.id}
                  onClick={() => handleCancel(w.id)}
                >
                  <X className="mr-1 h-3.5 w-3.5" />
                  ยกเลิก
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </LiffFrame>
  )
}

function StatusBadge({ status, position }: { status: string; position: number }) {
  if (status === 'notified') {
    return <Badge className="bg-emerald-500">มีคิวว่าง!</Badge>
  }
  if (status === 'waiting') {
    return <Badge variant="outline">ลำดับ #{position}</Badge>
  }
  return <Badge variant="secondary">{status}</Badge>
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6 text-center text-sm text-muted-foreground">
      {children}
    </main>
  )
}
