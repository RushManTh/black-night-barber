'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Phone, RefreshCw } from 'lucide-react'
import { useLiff, useIsAdmin } from '@/lib/liff/provider'
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
  customer: { profile: { display_name: string; phone: string | null } | null } | null
  barber: { profile: { display_name: string } | null } | null
  booking_services: { service_name: string }[]
}

type Stats = {
  total: number
  completed: number
  noShows: number
  upcoming: number
  revenue: number
}

const FORMATTER = new Intl.DateTimeFormat('th-TH', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const STATE_META: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  pending: { label: 'รอยืนยัน', variant: 'outline' },
  confirmed: { label: 'ยืนยันแล้ว', variant: 'default' },
  checked_in: { label: 'มาแล้ว', variant: 'secondary' },
  in_progress: { label: 'กำลังตัด', variant: 'secondary' },
  completed: { label: 'เสร็จ', variant: 'secondary' },
  cancelled: { label: 'ยกเลิก', variant: 'destructive' },
  expired: { label: 'หมดเวลา', variant: 'destructive' },
  no_show: { label: 'ไม่มา', variant: 'destructive' },
}

const NEXT_ACTIONS: Record<string, { action: string; label: string; primary?: boolean }[]> = {
  confirmed: [
    { action: 'check_in', label: 'เช็คอิน', primary: true },
    { action: 'no_show', label: 'ไม่มา' },
    { action: 'cancel', label: 'ยกเลิก' },
  ],
  checked_in: [
    { action: 'start', label: 'เริ่ม', primary: true },
    { action: 'no_show', label: 'ไม่มา' },
  ],
  in_progress: [{ action: 'complete', label: 'เสร็จ', primary: true }],
  pending: [{ action: 'cancel', label: 'ยกเลิก' }],
}

export default function AdminTodayPage() {
  const { loading, error, idToken } = useLiff()
  const isAdmin = useIsAdmin()
  const [bookings, setBookings] = useState<Booking[] | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!idToken) return
    const res = await fetch(`/api/admin/today?idToken=${encodeURIComponent(idToken)}`)
    const data = await res.json()
    if (res.ok) {
      setBookings(data.bookings ?? [])
      setStats(data.stats ?? null)
    } else {
      setActionError(data.error ?? 'load failed')
    }
  }, [idToken])

  useEffect(() => {
    if (idToken && isAdmin) load()
  }, [idToken, isAdmin, load])

  async function performAction(id: string, action: string) {
    if (!idToken) return
    setBusyId(id)
    setActionError(null)
    const res = await fetch(`/api/admin/bookings/${id}/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, action }),
    })
    if (!res.ok) {
      const t = await res.text()
      setActionError(t)
    } else {
      await load()
    }
    setBusyId(null)
  }

  if (loading) return <Centered>กำลังโหลด…</Centered>
  if (error) return <Centered>{error}</Centered>
  if (!isAdmin) {
    return (
      <Centered>
        ต้องเป็นพนักงาน — <Link className="ml-1 underline" href="/liff">กลับ</Link>
      </Centered>
    )
  }

  return (
    <LiffFrame
      title="คิววันนี้"
      back="/liff/admin"
      rightSlot={
        <Button variant="ghost" size="icon" onClick={load} aria-label="refresh">
          <RefreshCw />
        </Button>
      }
    >
      {stats && (
        <>
          <div className="grid grid-cols-4 gap-2 text-center">
            <Stat label="ทั้งหมด" value={stats.total} />
            <Stat label="รอ" value={stats.upcoming} />
            <Stat label="เสร็จ" value={stats.completed} />
            <Stat label="ไม่มา" value={stats.noShows} />
          </div>
          {stats.revenue > 0 && (
            <Card className="mt-3 border-emerald-200 bg-emerald-50">
              <CardContent className="flex items-center justify-between py-3">
                <span className="text-sm text-emerald-700">รายได้วันนี้</span>
                <span className="text-base font-bold text-emerald-700">
                  ฿{stats.revenue.toLocaleString()}
                </span>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {actionError && (
        <p className="mt-3 rounded bg-red-50 p-2 text-xs text-red-700">{actionError}</p>
      )}

      <div className="mt-5 space-y-3">
        {bookings === null && <p className="text-sm text-muted-foreground">กำลังโหลด…</p>}
        {bookings && bookings.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              ไม่มีคิววันนี้
            </CardContent>
          </Card>
        )}
        {bookings?.map((b) => {
          const meta = STATE_META[b.state] ?? { label: b.state, variant: 'outline' as const }
          const actions = NEXT_ACTIONS[b.state] ?? []
          return (
            <Card key={b.id} className="border-border">
              <CardContent className="space-y-2 py-3">
                <div className="flex items-center justify-between">
                  <div className="text-base font-bold">{FORMATTER.format(new Date(b.slot_time))}</div>
                  <Badge variant={meta.variant}>{meta.label}</Badge>
                </div>
                <div className="text-sm">
                  <span className="font-semibold">{b.customer?.profile?.display_name ?? '?'}</span>
                  {b.customer?.profile?.phone && (
                    <a
                      href={`tel:${b.customer.profile.phone}`}
                      className="ml-2 inline-flex items-center gap-1 text-xs text-blue-600"
                    >
                      <Phone className="h-3 w-3" />
                      {b.customer.profile.phone}
                    </a>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  ช่าง: {b.barber?.profile?.display_name} · {b.duration_minutes} นาที · ฿{Number(b.total_thb).toLocaleString()}
                </div>
                <div className="text-xs text-foreground/80">
                  {b.booking_services.map((s) => s.service_name).join(' + ')}
                </div>
                {actions.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {actions.map((a) => (
                      <Button
                        key={a.action}
                        size="sm"
                        variant={a.primary ? 'default' : 'outline'}
                        disabled={busyId === b.id}
                        onClick={() => performAction(b.id, a.action)}
                      >
                        {a.label}
                      </Button>
                    ))}
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-card py-2">
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6 text-center text-sm text-muted-foreground">
      {children}
    </main>
  )
}
