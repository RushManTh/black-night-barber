'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useLiff } from '@/lib/liff/provider'
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

const STATE_LABEL: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  pending: { label: 'รอยืนยัน', variant: 'outline' },
  confirmed: { label: 'ยืนยันแล้ว', variant: 'default' },
  checked_in: { label: 'มาถึงแล้ว', variant: 'secondary' },
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

  async function load() {
    if (!idToken) return
    setRefreshing(true)
    const res = await fetch(`/api/bookings?idToken=${encodeURIComponent(idToken)}`)
    const data = await res.json()
    setBookings(data.bookings ?? [])
    setRefreshing(false)
  }

  useEffect(() => {
    if (idToken) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idToken])

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

  if (loading) return <main className="p-6 text-sm text-zinc-500">⏳ กำลังโหลด…</main>
  if (error) return <main className="p-6 text-sm text-red-600">{error}</main>
  if (!appProfile) return null

  return (
    <main className="mx-auto max-w-md p-4 pb-12">
      <div className="flex items-center justify-between">
        <Link href="/liff" className="text-sm text-zinc-500">← กลับ</Link>
        <button
          onClick={load}
          disabled={refreshing}
          className="text-xs text-zinc-500 underline disabled:opacity-50"
        >
          {refreshing ? 'โหลด…' : 'รีเฟรช'}
        </button>
      </div>
      <h1 className="mt-2 text-xl font-semibold">คิวของฉัน</h1>

      {bookings === null ? (
        <p className="mt-6 text-sm text-zinc-500">กำลังโหลด…</p>
      ) : bookings.length === 0 ? (
        <Card className="mt-6 border-dashed border-zinc-300">
          <CardContent className="py-8 text-center text-sm text-zinc-500">
            <div className="text-3xl">🗓️</div>
            <p className="mt-2">ยังไม่มีคิว</p>
            <Link href="/liff/booking">
              <Button className="mt-4">จองคิวเลย</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 space-y-3">
          {bookings.map((b) => {
            const meta = STATE_LABEL[b.state] ?? { label: b.state, variant: 'outline' as const }
            const isUpcoming = ['pending', 'confirmed'].includes(b.state) && new Date(b.slot_time) > new Date()
            return (
              <Card key={b.id} className="border-zinc-200">
                <CardContent className="space-y-2 py-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">{FORMATTER.format(new Date(b.slot_time))}</div>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                  </div>
                  <div className="text-xs text-zinc-500">
                    ช่าง: {b.barbers?.profiles?.display_name ?? '-'}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {b.booking_services.map((s) => s.service_name).join(' + ')}
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <div className="text-sm font-bold">฿{Number(b.total_thb).toLocaleString()}</div>
                    {isUpcoming && (
                      <Button size="sm" variant="outline" onClick={() => handleCancel(b.id)}>
                        ยกเลิก
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </main>
  )
}
