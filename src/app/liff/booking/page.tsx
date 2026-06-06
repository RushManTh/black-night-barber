'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLiff } from '@/lib/liff/provider'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type Service = {
  id: string
  name: string
  icon: string | null
  duration_minutes: number
  price_thb: number
}

type Barber = {
  id: string
  profiles: { display_name: string; avatar_url: string | null } | null
  experience_years: number | null
}

type Slot = { slot_start: string; is_available: boolean }

const FORMATTER_DATE = new Intl.DateTimeFormat('th-TH', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})
const FORMATTER_TIME = new Intl.DateTimeFormat('th-TH', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export default function BookingWizard() {
  const router = useRouter()
  const { loading, error, idToken, appProfile } = useLiff()

  const [step, setStep] = useState(1)
  const [services, setServices] = useState<Service[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [pickedServiceIds, setPickedServiceIds] = useState<Set<string>>(new Set())
  const [pickedBarberId, setPickedBarberId] = useState<string | null>(null)
  const [pickedDate, setPickedDate] = useState<string>('')
  const [pickedSlot, setPickedSlot] = useState<string | null>(null)
  const [slots, setSlots] = useState<Slot[] | null>(null)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Load services + barbers on mount
  useEffect(() => {
    const sb = createClient()
    Promise.all([
      sb.from('services').select('id, name, icon, duration_minutes, price_thb').order('display_order'),
      sb.from('barbers')
        .select('id, experience_years, profiles(display_name, avatar_url)')
        .eq('is_active', true)
        .order('display_order'),
    ]).then(([sRes, bRes]) => {
      setServices((sRes.data ?? []) as Service[])
      setBarbers((bRes.data ?? []) as unknown as Barber[])
    })
  }, [])

  const pickedServices = useMemo(
    () => services.filter((s) => pickedServiceIds.has(s.id)),
    [services, pickedServiceIds]
  )
  const totalDuration = pickedServices.reduce((a, s) => a + s.duration_minutes, 0)
  const totalPrice = pickedServices.reduce((a, s) => a + Number(s.price_thb), 0)
  const pickedBarber = barbers.find((b) => b.id === pickedBarberId)

  // Fetch slots when step 4 + barber + date set
  useEffect(() => {
    if (step !== 4 || !pickedBarberId || !pickedDate || totalDuration <= 0) return
    setSlotsLoading(true)
    setSlots(null)
    fetch(`/api/slots?barber_id=${pickedBarberId}&date=${pickedDate}&duration=${totalDuration}`)
      .then((r) => r.json())
      .then((d) => setSlots(d.slots ?? []))
      .finally(() => setSlotsLoading(false))
  }, [step, pickedBarberId, pickedDate, totalDuration])

  const nextDates = useMemo(() => {
    const arr: { iso: string; label: string }[] = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    for (let i = 0; i < 14; i++) {
      const d = new Date(today.getTime() + i * 86400000)
      arr.push({
        iso: d.toISOString().slice(0, 10),
        label: i === 0 ? 'วันนี้' : i === 1 ? 'พรุ่งนี้' : FORMATTER_DATE.format(d),
      })
    }
    return arr
  }, [])

  async function handleConfirm() {
    if (!idToken || !pickedBarberId || !pickedSlot || pickedServiceIds.size === 0) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const createRes = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken,
          barber_id: pickedBarberId,
          slot_time: pickedSlot,
          service_ids: [...pickedServiceIds],
        }),
      })
      if (!createRes.ok) {
        const t = await createRes.text()
        throw new Error(t)
      }
      const { booking } = (await createRes.json()) as { booking: { id: string } }

      const confirmRes = await fetch(`/api/bookings/${booking.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      })
      if (!confirmRes.ok) {
        const t = await confirmRes.text()
        throw new Error(t)
      }

      router.push(`/liff/booking/${booking.id}/success`)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'จองล้มเหลว')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <main className="p-6 text-sm text-zinc-500">⏳ กำลังโหลด…</main>
  if (error) return <main className="p-6 text-sm text-red-600">{error}</main>
  if (!appProfile) return null

  return (
    <main className="mx-auto max-w-md p-4 pb-24">
      <div className="flex items-center justify-between">
        <Link href="/liff" className="text-sm text-zinc-500">← กลับ</Link>
        <div className="text-xs text-zinc-500">ขั้นที่ {step} / 5</div>
      </div>
      <h1 className="mt-2 text-xl font-semibold">{STEP_TITLES[step - 1]}</h1>

      <div className="mt-6 space-y-3">
        {step === 1 && (
          <>
            {services.map((s) => {
              const picked = pickedServiceIds.has(s.id)
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setPickedServiceIds((prev) => {
                      const next = new Set(prev)
                      next.has(s.id) ? next.delete(s.id) : next.add(s.id)
                      return next
                    })
                  }}
                  className={`w-full rounded-lg border px-4 py-3 text-left transition ${
                    picked ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">{s.name}</div>
                      <div className="text-xs text-zinc-500">⏱ {s.duration_minutes} นาที</div>
                    </div>
                    <div className="text-sm font-bold">฿{Number(s.price_thb).toLocaleString()}</div>
                  </div>
                </button>
              )
            })}
          </>
        )}

        {step === 2 && (
          <>
            {barbers.length === 0 && (
              <p className="text-center text-sm text-zinc-500">ยังไม่มีช่าง</p>
            )}
            {barbers.map((b) => {
              const picked = pickedBarberId === b.id
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setPickedBarberId(b.id)}
                  className={`w-full rounded-lg border px-4 py-3 text-left transition ${
                    picked ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200 bg-white'
                  }`}
                >
                  <div className="text-sm font-semibold">{b.profiles?.display_name}</div>
                  {b.experience_years != null && (
                    <div className="text-xs text-zinc-500">ประสบการณ์ {b.experience_years} ปี</div>
                  )}
                </button>
              )
            })}
          </>
        )}

        {step === 3 && (
          <div className="grid grid-cols-3 gap-2">
            {nextDates.map((d) => {
              const picked = pickedDate === d.iso
              return (
                <button
                  key={d.iso}
                  type="button"
                  onClick={() => setPickedDate(d.iso)}
                  className={`rounded-lg border px-3 py-3 text-center text-xs transition ${
                    picked ? 'border-zinc-900 bg-zinc-50 font-semibold' : 'border-zinc-200 bg-white'
                  }`}
                >
                  {d.label}
                </button>
              )
            })}
          </div>
        )}

        {step === 4 && (
          <>
            {slotsLoading && <p className="text-sm text-zinc-500">กำลังโหลดเวลาว่าง…</p>}
            {!slotsLoading && slots && slots.length === 0 && (
              <p className="text-sm text-zinc-500">วันนี้ไม่มีคิวว่าง ลองวันอื่น</p>
            )}
            {!slotsLoading && slots && slots.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {slots.map((s) => {
                  const picked = pickedSlot === s.slot_start
                  const disabled = !s.is_available
                  return (
                    <button
                      key={s.slot_start}
                      type="button"
                      disabled={disabled}
                      onClick={() => setPickedSlot(s.slot_start)}
                      className={`rounded-lg border px-3 py-2 text-center text-sm transition ${
                        disabled
                          ? 'cursor-not-allowed border-dashed border-zinc-200 bg-zinc-50 text-zinc-300 line-through'
                          : picked
                          ? 'border-zinc-900 bg-zinc-50 font-semibold'
                          : 'border-zinc-200 bg-white'
                      }`}
                    >
                      {FORMATTER_TIME.format(new Date(s.slot_start))}
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}

        {step === 5 && (
          <Card className="border-zinc-200">
            <CardContent className="space-y-3 py-4">
              <Row label="ช่าง">{pickedBarber?.profiles?.display_name}</Row>
              <Row label="วัน-เวลา">
                {pickedSlot && FORMATTER_DATE.format(new Date(pickedSlot))} ·{' '}
                {pickedSlot && FORMATTER_TIME.format(new Date(pickedSlot))}
              </Row>
              <Row label="บริการ">
                <div className="space-y-1">
                  {pickedServices.map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-sm">
                      <span>{s.name}</span>
                      <span>฿{Number(s.price_thb).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </Row>
              <div className="border-t pt-3">
                <div className="flex items-center justify-between text-base font-semibold">
                  <span>รวม</span>
                  <span>฿{totalPrice.toLocaleString()}</span>
                </div>
                <Badge variant="secondary" className="mt-1">
                  ⏱ {totalDuration} นาที
                </Badge>
              </div>
              {submitError && (
                <p className="rounded bg-red-50 p-2 text-xs text-red-700">{submitError}</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Sticky bottom nav */}
      <div className="fixed inset-x-0 bottom-0 border-t bg-white p-3">
        <div className="mx-auto flex max-w-md gap-2">
          {step > 1 && (
            <Button variant="outline" className="flex-1" onClick={() => setStep((s) => s - 1)}>
              ย้อนกลับ
            </Button>
          )}
          {step < 5 && (
            <Button
              className="flex-1"
              disabled={!canAdvance(step, {
                pickedServiceIds,
                pickedBarberId,
                pickedDate,
                pickedSlot,
              })}
              onClick={() => setStep((s) => s + 1)}
            >
              ถัดไป
            </Button>
          )}
          {step === 5 && (
            <Button className="flex-1" disabled={submitting} onClick={handleConfirm}>
              {submitting ? 'กำลังจอง…' : 'ยืนยันการจอง'}
            </Button>
          )}
        </div>
      </div>
    </main>
  )
}

const STEP_TITLES = ['เลือกบริการ', 'เลือกช่าง', 'เลือกวัน', 'เลือกเวลา', 'ตรวจสอบและยืนยัน']

function canAdvance(
  step: number,
  s: {
    pickedServiceIds: Set<string>
    pickedBarberId: string | null
    pickedDate: string
    pickedSlot: string | null
  }
): boolean {
  if (step === 1) return s.pickedServiceIds.size > 0
  if (step === 2) return !!s.pickedBarberId
  if (step === 3) return !!s.pickedDate
  if (step === 4) return !!s.pickedSlot
  return true
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  )
}
