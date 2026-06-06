'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Phone } from 'lucide-react'
import { useLiff, useIsAdmin } from '@/lib/liff/provider'
import { LiffFrame } from '@/components/liff/liff-frame'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type Schedule = {
  date: string
  day_of_week: number
  branch: {
    open_time: string
    close_time: string
    slot_duration_minutes: number
    is_closed: boolean
  }
  barbers: Array<{
    id: string
    display_name: string
    avatar_url: string | null
    works_today: boolean
    start_time: string | null
    end_time: string | null
  }>
  bookings: Array<{
    id: string
    slot_time: string
    end_time: string
    duration_minutes: number
    total_thb: number
    state: string
    barber_id: string
    customer_id: string
    customer: { profile: { display_name: string; phone: string | null } | null } | null
    booking_services: { service_name: string }[]
  }>
  time_offs: Array<{ barber_id: string; start_at: string; end_at: string; reason: string | null }>
}

const STATE_COLOR: Record<string, string> = {
  pending: 'bg-zinc-400',
  confirmed: 'bg-blue-500',
  checked_in: 'bg-amber-500',
  in_progress: 'bg-purple-500',
  completed: 'bg-emerald-500',
  no_show: 'bg-red-500',
}

const STATE_LABEL: Record<string, string> = {
  pending: 'รอยืนยัน',
  confirmed: 'ยืนยันแล้ว',
  checked_in: 'มาแล้ว',
  in_progress: 'กำลังตัด',
  completed: 'เสร็จ',
  no_show: 'ไม่มา',
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

const TIME_FMT = new Intl.DateTimeFormat('th-TH', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Bangkok',
})

function localDateString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function timeToMinutes(t: string): number {
  // "10:00:00" or "10:00" → 600
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export default function AdminSchedulePage() {
  const { loading, error, idToken } = useLiff()
  const isAdmin = useIsAdmin()

  const [date, setDate] = useState(() => localDateString(new Date()))
  const [data, setData] = useState<Schedule | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!idToken) return
    setRefreshing(true)
    const res = await fetch(
      `/api/admin/schedule?idToken=${encodeURIComponent(idToken)}&date=${date}`
    )
    if (res.ok) {
      setData((await res.json()) as Schedule)
    }
    setRefreshing(false)
  }, [idToken, date])

  useEffect(() => {
    if (idToken && isAdmin) load()
  }, [idToken, isAdmin, load])

  const shiftDay = (n: number) => {
    const d = new Date(`${date}T00:00:00+07:00`)
    d.setUTCDate(d.getUTCDate() + n)
    setDate(localDateString(d))
  }

  const isToday = useMemo(() => date === localDateString(new Date()), [date])
  const friendlyDate = useMemo(() => {
    const d = new Date(`${date}T00:00:00+07:00`)
    return new Intl.DateTimeFormat('th-TH', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      timeZone: 'Asia/Bangkok',
    }).format(d)
  }, [date])

  async function performAction(id: string, action: string) {
    if (!idToken) return
    setBusyId(id)
    await fetch(`/api/admin/bookings/${id}/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, action }),
    })
    setBusyId(null)
    await load()
  }

  if (loading) return <Centered>กำลังโหลด…</Centered>
  if (error) return <Centered>{error}</Centered>
  if (!isAdmin) return <Centered>ต้องเป็นพนักงาน</Centered>

  const shopOpen = data ? timeToMinutes(data.branch.open_time) : 600
  const shopClose = data ? timeToMinutes(data.branch.close_time) : 1260
  const totalMinutes = shopClose - shopOpen

  return (
    <LiffFrame title="ตารางคิวร้าน" back="/liff/admin">
      {/* Day picker */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={() => shiftDay(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <div className="text-sm font-semibold">{friendlyDate}</div>
          {isToday && <div className="text-[10px] text-emerald-600">วันนี้</div>}
        </div>
        <Button variant="outline" size="sm" onClick={() => shiftDay(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {data?.branch.is_closed && (
        <Card className="mb-4 border-amber-200 bg-amber-50">
          <CardContent className="py-3 text-center text-sm text-amber-900">
            ร้านปิดวันนี้
          </CardContent>
        </Card>
      )}

      {refreshing && <p className="text-sm text-muted-foreground">กำลังโหลด…</p>}

      {data?.barbers.map((b) => {
        const myBookings = data.bookings.filter((x) => x.barber_id === b.id)
        const myTimeOffs = data.time_offs.filter((x) => x.barber_id === b.id)
        const completedCount = myBookings.filter((x) => x.state === 'completed').length

        return (
          <Card key={b.id} className="mb-3 border-border">
            <CardContent className="py-3">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">{b.display_name}</div>
                  {b.works_today ? (
                    <div className="text-[10px] text-muted-foreground">
                      {b.start_time?.slice(0, 5)}-{b.end_time?.slice(0, 5)} ·{' '}
                      {myBookings.length} คิว{completedCount > 0 ? ` · เสร็จ ${completedCount}` : ''}
                    </div>
                  ) : (
                    <div className="text-[10px] text-muted-foreground">ไม่ทำงานวันนี้</div>
                  )}
                </div>
              </div>

              {b.works_today && (
                <>
                  {/* Timeline */}
                  <div className="relative h-7 overflow-hidden rounded-md border border-border bg-muted/40">
                    {/* Hour ticks */}
                    {Array.from({ length: Math.ceil(totalMinutes / 60) + 1 }, (_, i) => {
                      const left = ((i * 60) / totalMinutes) * 100
                      return (
                        <div
                          key={i}
                          className="absolute top-0 h-full border-l border-border/50"
                          style={{ left: `${left}%` }}
                        />
                      )
                    })}
                    {/* Time-off blocks */}
                    {myTimeOffs.map((t, idx) => {
                      const startMin = Math.max(
                        shopOpen,
                        timeToMinutesFromDate(new Date(t.start_at))
                      )
                      const endMin = Math.min(
                        shopClose,
                        timeToMinutesFromDate(new Date(t.end_at))
                      )
                      if (endMin <= startMin) return null
                      const left = ((startMin - shopOpen) / totalMinutes) * 100
                      const width = ((endMin - startMin) / totalMinutes) * 100
                      return (
                        <div
                          key={`to-${idx}`}
                          className="absolute top-0 h-full bg-zinc-300/50 [background-image:repeating-linear-gradient(45deg,transparent_0,transparent_3px,rgba(0,0,0,0.1)_3px,rgba(0,0,0,0.1)_6px)]"
                          style={{ left: `${left}%`, width: `${width}%` }}
                          title={`ลา: ${t.reason ?? ''}`}
                        />
                      )
                    })}
                    {/* Booking blocks */}
                    {myBookings.map((bk) => {
                      const startMin = timeToMinutesFromDate(new Date(bk.slot_time))
                      const endMin = startMin + bk.duration_minutes
                      const left = ((startMin - shopOpen) / totalMinutes) * 100
                      const width = ((endMin - startMin) / totalMinutes) * 100
                      const color = STATE_COLOR[bk.state] ?? 'bg-zinc-500'
                      return (
                        <button
                          key={bk.id}
                          type="button"
                          onClick={() =>
                            setExpandedBookingId(expandedBookingId === bk.id ? null : bk.id)
                          }
                          className={`absolute top-0.5 bottom-0.5 ${color} rounded-sm border border-white/30 transition hover:brightness-110`}
                          style={{ left: `${left}%`, width: `${width}%` }}
                          title={`${TIME_FMT.format(new Date(bk.slot_time))} ${bk.customer?.profile?.display_name ?? ''}`}
                        />
                      )
                    })}
                  </div>

                  {/* Hour labels */}
                  <div className="relative mt-1 h-3 text-[9px] text-muted-foreground">
                    {Array.from({ length: Math.ceil(totalMinutes / 60) + 1 }, (_, i) => {
                      const left = ((i * 60) / totalMinutes) * 100
                      const hour = Math.floor(shopOpen / 60) + i
                      return (
                        <div
                          key={i}
                          className="absolute -translate-x-1/2"
                          style={{ left: `${left}%` }}
                        >
                          {hour}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              {/* Expanded booking detail */}
              {expandedBookingId && myBookings.some((x) => x.id === expandedBookingId) && (() => {
                const bk = myBookings.find((x) => x.id === expandedBookingId)!
                const meta = STATE_LABEL[bk.state] ?? bk.state
                const actions = NEXT_ACTIONS[bk.state] ?? []
                return (
                  <div className="mt-3 rounded-md border border-border bg-muted/30 p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-base font-bold">
                        {TIME_FMT.format(new Date(bk.slot_time))}
                      </div>
                      <Badge>{meta}</Badge>
                    </div>
                    <div className="mt-1 text-sm">
                      <span className="font-semibold">
                        {bk.customer?.profile?.display_name ?? '?'}
                      </span>
                      {bk.customer?.profile?.phone && (
                        <a
                          href={`tel:${bk.customer.profile.phone}`}
                          className="ml-2 inline-flex items-center gap-1 text-xs text-blue-600"
                        >
                          <Phone className="h-3 w-3" />
                          {bk.customer.profile.phone}
                        </a>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {bk.booking_services.map((s) => s.service_name).join(' + ')} ·{' '}
                      {bk.duration_minutes} น. · ฿{Number(bk.total_thb).toLocaleString()}
                    </div>
                    {actions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {actions.map((a) => (
                          <Button
                            key={a.action}
                            size="sm"
                            variant={a.primary ? 'default' : 'outline'}
                            disabled={busyId === bk.id}
                            onClick={() => performAction(bk.id, a.action)}
                          >
                            {a.label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}
            </CardContent>
          </Card>
        )
      })}

      {data && data.barbers.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">ยังไม่มีช่าง</p>
      )}

      {/* Legend */}
      <div className="mt-6 rounded-md border border-border bg-card p-3 text-[11px]">
        <div className="mb-1 font-semibold text-muted-foreground">สีบนตาราง</div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {(['confirmed', 'checked_in', 'in_progress', 'completed', 'no_show'] as const).map(
            (s) => (
              <span key={s} className="inline-flex items-center gap-1">
                <span className={`inline-block h-3 w-3 rounded-sm ${STATE_COLOR[s]}`} />
                {STATE_LABEL[s]}
              </span>
            )
          )}
        </div>
      </div>
    </LiffFrame>
  )
}

function timeToMinutesFromDate(d: Date): number {
  // Bangkok wall-clock minutes since midnight
  const local = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
  return local.getHours() * 60 + local.getMinutes()
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6 text-center text-sm text-muted-foreground">
      {children}
    </main>
  )
}
