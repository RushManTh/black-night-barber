'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLiff } from '@/lib/liff/provider'
import { LiffFrame } from '@/components/liff/liff-frame'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

type Service = { id: string; name: string; duration_minutes: number; price_thb: number }
type Barber = {
  id: string
  profiles: { display_name: string } | null
}

export default function NewWaitlistPage() {
  return (
    <Suspense fallback={<Centered>กำลังโหลด…</Centered>}>
      <NewWaitlistInner />
    </Suspense>
  )
}

function NewWaitlistInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { loading, error, idToken, appProfile } = useLiff()
  const [services, setServices] = useState<Service[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])

  const [serviceId, setServiceId] = useState(searchParams.get('service_id') ?? '')
  const [barberId, setBarberId] = useState(searchParams.get('barber_id') ?? '')
  const [date, setDate] = useState(searchParams.get('date') ?? '')
  const [timeFrom, setTimeFrom] = useState('10:00')
  const [timeTo, setTimeTo] = useState('21:00')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    const sb = createClient()
    Promise.all([
      sb.from('services').select('id, name, duration_minutes, price_thb').eq('is_active', true).order('display_order'),
      sb.from('barbers').select('id, profiles(display_name)').eq('is_active', true).order('display_order'),
    ]).then(([sRes, bRes]) => {
      setServices((sRes.data ?? []) as Service[])
      setBarbers((bRes.data ?? []) as unknown as Barber[])
    })
  }, [])

  const nextDates = useMemo(() => {
    const arr: { iso: string; label: string }[] = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    for (let i = 0; i < 14; i++) {
      const d = new Date(today.getTime() + i * 86400000)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      arr.push({
        iso: `${y}-${m}-${day}`,
        label:
          i === 0
            ? 'วันนี้'
            : i === 1
            ? 'พรุ่งนี้'
            : new Intl.DateTimeFormat('th-TH', { weekday: 'short', day: 'numeric', month: 'short' }).format(d),
      })
    }
    return arr
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!idToken || !serviceId || !date) return
    setSubmitting(true)
    setSubmitError(null)
    const res = await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken,
        service_id: serviceId,
        barber_id: barberId || null,
        preferred_date: date,
        time_from: timeFrom + ':00',
        time_to: timeTo + ':00',
      }),
    })
    setSubmitting(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({ error: 'failed' }))
      setSubmitError(j.error ?? 'ขอรอคิวล้มเหลว')
      return
    }
    router.push('/liff/waitlist')
  }

  if (loading) return <Centered>กำลังโหลด…</Centered>
  if (error) return <Centered>{error}</Centered>
  if (!appProfile) return null

  return (
    <LiffFrame title="ขอรอคิวว่าง" back="/liff/waitlist">
      <p className="mb-5 text-xs text-muted-foreground">
        เมื่อมีคนยกเลิกคิวที่ตรงเงื่อนไข ระบบจะแจ้ง LINE และจองให้คุณอัตโนมัติ
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <Label>บริการที่ต้องการ</Label>
          <select
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            required
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
          >
            <option value="">เลือกบริการ</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · ฿{Number(s.price_thb).toLocaleString()} · {s.duration_minutes}น.
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label>ช่างที่ต้องการ (ไม่บังคับ)</Label>
          <select
            value={barberId}
            onChange={(e) => setBarberId(e.target.value)}
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
          >
            <option value="">ช่างใดก็ได้</option>
            {barbers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.profiles?.display_name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label>วันที่ต้องการ</Label>
          <div className="grid grid-cols-4 gap-2">
            {nextDates.map((d) => {
              const picked = date === d.iso
              return (
                <button
                  key={d.iso}
                  type="button"
                  onClick={() => setDate(d.iso)}
                  className={`rounded-lg border px-2 py-2 text-xs ${
                    picked
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card'
                  }`}
                >
                  {d.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>เวลาเริ่ม</Label>
            <input
              type="time"
              value={timeFrom}
              onChange={(e) => setTimeFrom(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>ถึง</Label>
            <input
              type="time"
              value={timeTo}
              onChange={(e) => setTimeTo(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
              required
            />
          </div>
        </div>

        <Button size="lg" type="submit" disabled={submitting} className="w-full">
          {submitting ? 'กำลังบันทึก…' : 'ขอรอคิว'}
        </Button>

        {submitError && <p className="rounded bg-red-50 p-2 text-xs text-red-700">{submitError}</p>}
      </form>
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
