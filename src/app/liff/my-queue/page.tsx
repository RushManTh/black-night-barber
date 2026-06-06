'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Calendar, CalendarPlus, Check, RefreshCw, X } from 'lucide-react'
import { useLiff } from '@/lib/liff/provider'
import { LiffFrame } from '@/components/liff/liff-frame'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type Booking = {
  id: string
  slot_time: string
  duration_minutes: number
  total_thb: number
  state: string
  locked_until: string | null
  barbers: { profiles: { display_name: string } | null } | null
  booking_services: { service_name: string }[]
}

const FORMATTER = new Intl.DateTimeFormat('th-TH', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const STATE_META: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  pending: { label: 'รอยืนยัน', variant: 'outline' },
  confirmed: { label: 'ยืนยันแล้ว', variant: 'default' },
  checked_in: { label: 'มาแล้ว', variant: 'secondary' },
  in_progress: { label: 'กำลังตัด', variant: 'secondary' },
  completed: { label: 'เสร็จสิ้น', variant: 'secondary' },
  cancelled: { label: 'ยกเลิก', variant: 'destructive' },
  expired: { label: 'หมดเวลา', variant: 'destructive' },
  no_show: { label: 'ไม่มา', variant: 'destructive' },
}

export default function MyQueuePage() {
  const { loading, error, idToken, appProfile } = useLiff()
  const [bookings, setBookings] = useState<Booking[] | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    if (!idToken) return
    setRefreshing(true)
    const res = await fetch(`/api/bookings?idToken=${encodeURIComponent(idToken)}`)
    const data = await res.json()
    setBookings(data.bookings ?? [])
    setRefreshing(false)
  }, [idToken])

  useEffect(() => {
    if (idToken) load()
  }, [idToken, load])

  async function handleCancel(id: string) {
    if (!idToken) return
    if (!confirm('ยกเลิกคิวนี้ใช่หรือไม่?')) return
    const res = await fetch(`/api/bookings/${id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    })
    if (!res.ok) {
      const t = await res.text()
      alert(`ยกเลิกล้มเหลว: ${t}`)
      return
    }
    await load()
  }

  async function handleConfirm(id: string) {
    if (!idToken) return
    const res = await fetch(`/api/bookings/${id}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    })
    if (!res.ok) {
      const t = await res.text()
      alert(`ยืนยันล้มเหลว: ${t}`)
      return
    }
    await load()
  }

  if (loading) return <Centered>กำลังโหลด…</Centered>
  if (error) return <Centered>{error}</Centered>
  if (!appProfile) return null

  return (
    <LiffFrame
      title="คิวของฉัน"
      back="/liff"
      rightSlot={
        <Button variant="ghost" size="icon" onClick={load} disabled={refreshing} aria-label="refresh">
          <RefreshCw className={refreshing ? 'animate-spin' : ''} />
        </Button>
      }
    >
      {bookings === null && <p className="text-sm text-muted-foreground">กำลังโหลด…</p>}

      {bookings && bookings.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <Calendar className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">ยังไม่มีคิว</p>
            <p className="mt-1 text-xs text-muted-foreground">จองคิวแรกของคุณเลย</p>
            <Link href="/liff/booking">
              <Button className="mt-4" size="sm">
                <CalendarPlus className="mr-2 h-4 w-4" />
                จองคิวเลย
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {bookings && bookings.length > 0 && (
        <div className="space-y-3">
          {bookings.map((b) => {
            const meta = STATE_META[b.state] ?? { label: b.state, variant: 'outline' as const }
            const isPending = b.state === 'pending'
            const isUpcoming =
              ['pending', 'confirmed'].includes(b.state) && new Date(b.slot_time) > new Date()
            const lockActive = isPending && b.locked_until && new Date(b.locked_until) > new Date()
            return (
              <Card key={b.id} className="border-border">
                <CardContent className="space-y-2 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-semibold">
                      {FORMATTER.format(new Date(b.slot_time))}
                    </div>
                    <Badge variant={meta.variant} className="shrink-0">
                      {meta.label}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    ช่าง: {b.barbers?.profiles?.display_name ?? '-'}
                  </div>
                  <div className="text-xs text-foreground/80">
                    {b.booking_services.map((s) => s.service_name).join(' + ')}
                  </div>
                  {lockActive && (
                    <div className="rounded bg-amber-50 p-2 text-xs text-amber-700">
                      ⏳ ยืนยันภายใน {new Date(b.locked_until!).toLocaleTimeString('th-TH', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="text-sm font-bold">฿{Number(b.total_thb).toLocaleString()}</div>
                    <div className="flex gap-1">
                      {isPending && (
                        <Button size="sm" onClick={() => handleConfirm(b.id)}>
                          <Check className="mr-1 h-3.5 w-3.5" />
                          ยืนยัน
                        </Button>
                      )}
                      {isUpcoming && (
                        <Button size="sm" variant="outline" onClick={() => handleCancel(b.id)}>
                          <X className="mr-1 h-3.5 w-3.5" />
                          ยกเลิก
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
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
