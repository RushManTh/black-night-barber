'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  Baby,
  Check,
  Clock,
  Droplet,
  Palette,
  Scissors,
  Sparkles,
  WandSparkles,
  type LucideIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useLiff } from '@/lib/liff/provider'
import { LiffFrame } from '@/components/liff/liff-frame'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tag } from 'lucide-react'

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

const ICON_MAP: Record<string, LucideIcon> = {
  scissors: Scissors,
  droplet: Droplet,
  palette: Palette,
  'wand-sparkles': WandSparkles,
  sparkles: Sparkles,
  baby: Baby,
}

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

const STEP_TITLES = ['เลือกบริการ', 'เลือกช่าง', 'เลือกวัน', 'เลือกเวลา', 'ตรวจสอบ']

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
  const [promoCode, setPromoCode] = useState('')
  const [promoChecking, setPromoChecking] = useState(false)
  const [promoApplied, setPromoApplied] = useState<{ discount: number; total: number; name: string } | null>(null)
  const [promoError, setPromoError] = useState<string | null>(null)

  useEffect(() => {
    const sb = createClient()
    Promise.all([
      sb.from('services').select('id, name, icon, duration_minutes, price_thb').eq('is_active', true).order('display_order'),
      sb
        .from('barbers')
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
    const arr: { iso: string; label: string; sub: string }[] = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    for (let i = 0; i < 14; i++) {
      const d = new Date(today.getTime() + i * 86400000)
      // Use LOCAL date components — toISOString() returns UTC and shifts the
      // date back by one day for users east of UTC (e.g., Bangkok UTC+7).
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      arr.push({
        iso: `${y}-${m}-${day}`,
        label: i === 0 ? 'วันนี้' : i === 1 ? 'พรุ่งนี้' : new Intl.DateTimeFormat('th-TH', { weekday: 'short' }).format(d),
        sub: new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' }).format(d),
      })
    }
    return arr
  }, [])

  async function checkPromo() {
    if (!promoCode.trim() || pickedServiceIds.size === 0) return
    setPromoChecking(true)
    setPromoError(null)
    setPromoApplied(null)
    const res = await fetch('/api/promos/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken,
        code: promoCode.trim(),
        service_ids: [...pickedServiceIds],
      }),
    })
    setPromoChecking(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({ error: 'failed' }))
      setPromoError(j.error ?? 'ใช้คูปองไม่ได้')
      return
    }
    const j = await res.json()
    setPromoApplied({
      discount: j.discount,
      total: j.total,
      name: j.promotion.name,
    })
  }

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
          promo_code: promoApplied ? promoCode.trim() : null,
        }),
      })
      if (!createRes.ok) {
        const raw = await createRes.text()
        throw new Error(humanizeBookingError(raw))
      }
      const { booking } = (await createRes.json()) as { booking: { id: string } }

      const confirmRes = await fetch(`/api/bookings/${booking.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      })
      if (!confirmRes.ok) {
        const raw = await confirmRes.text()
        throw new Error(humanizeBookingError(raw))
      }

      router.push(`/liff/booking/${booking.id}/success`)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'จองล้มเหลว')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <Centered>กำลังโหลด…</Centered>
  if (error) return <Centered>{error}</Centered>
  if (!appProfile) return null

  return (
    <LiffFrame title="จองคิว" back="/liff">
      {/* Step indicator */}
      <div className="mb-5">
        <div className="flex items-center justify-between">
          {STEP_TITLES.map((_, i) => (
            <div key={i} className="flex flex-1 items-center">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                  i + 1 < step
                    ? 'bg-primary text-primary-foreground'
                    : i + 1 === step
                    ? 'border-2 border-primary bg-background text-primary'
                    : 'bg-secondary text-muted-foreground'
                }`}
              >
                {i + 1 < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              {i < STEP_TITLES.length - 1 && (
                <div className={`mx-1 h-px flex-1 ${i + 1 < step ? 'bg-primary' : 'bg-border'}`} />
              )}
            </div>
          ))}
        </div>
        <h2 className="mt-3 text-base font-semibold">{STEP_TITLES[step - 1]}</h2>
      </div>

      <div className="space-y-2">
        {step === 1 &&
          services.map((s) => {
            const picked = pickedServiceIds.has(s.id)
            const Icon = ICON_MAP[s.icon ?? ''] ?? Scissors
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
                className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition ${
                  picked ? 'border-primary bg-secondary/50' : 'border-border bg-card'
                }`}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    picked ? 'bg-primary text-primary-foreground' : 'bg-secondary'
                  }`}
                >
                  {picked ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{s.name}</div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {s.duration_minutes} นาที
                  </div>
                </div>
                <div className="text-sm font-bold">฿{Number(s.price_thb).toLocaleString()}</div>
              </button>
            )
          })}

        {step === 2 && (
          <>
            {barbers.length === 0 && (
              <p className="text-center text-sm text-muted-foreground">ยังไม่มีช่าง</p>
            )}
            {barbers.map((b) => {
              const picked = pickedBarberId === b.id
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setPickedBarberId(b.id)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition ${
                    picked ? 'border-primary bg-secondary/50' : 'border-border bg-card'
                  }`}
                >
                  <div className="text-sm font-semibold flex-1">
                    {b.profiles?.display_name}
                    {b.experience_years != null && (
                      <div className="text-xs font-normal text-muted-foreground">
                        ประสบการณ์ {b.experience_years} ปี
                      </div>
                    )}
                  </div>
                  {picked && <Check className="h-4 w-4 text-primary" />}
                </button>
              )
            })}
          </>
        )}

        {step === 3 && (
          <div className="grid grid-cols-4 gap-2">
            {nextDates.map((d) => {
              const picked = pickedDate === d.iso
              return (
                <button
                  key={d.iso}
                  type="button"
                  onClick={() => setPickedDate(d.iso)}
                  className={`rounded-lg border px-2 py-3 text-center transition ${
                    picked
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card'
                  }`}
                >
                  <div className="text-xs font-medium">{d.label}</div>
                  <div className="mt-1 text-[10px] opacity-70">{d.sub}</div>
                </button>
              )
            })}
          </div>
        )}

        {step === 4 && (
          <>
            {slotsLoading && <p className="text-sm text-muted-foreground">กำลังโหลดเวลาว่าง…</p>}
            {!slotsLoading && slots && slots.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  ไม่มีคิวว่างในวันนี้ ลองเลือกวันอื่น
                </CardContent>
              </Card>
            )}
            {!slotsLoading && slots && slots.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {slots.map((s) => {
                  const picked = pickedSlot === s.slot_start
                  const disabled = !s.is_available
                  return (
                    <button
                      key={s.slot_start}
                      type="button"
                      disabled={disabled}
                      onClick={() => setPickedSlot(s.slot_start)}
                      className={`rounded-lg border px-2 py-2 text-center text-sm transition ${
                        disabled
                          ? 'cursor-not-allowed border-dashed border-border bg-muted/40 text-muted-foreground/40 line-through'
                          : picked
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-card'
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
          <Card className="border-border">
            <CardContent className="space-y-3 py-4">
              <SummaryRow label="ช่าง">{pickedBarber?.profiles?.display_name}</SummaryRow>
              <SummaryRow label="วัน-เวลา">
                {pickedSlot && FORMATTER_DATE.format(new Date(pickedSlot))} ·{' '}
                {pickedSlot && FORMATTER_TIME.format(new Date(pickedSlot))}
              </SummaryRow>
              <SummaryRow label="บริการ">
                <div className="space-y-1">
                  {pickedServices.map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-sm">
                      <span>{s.name}</span>
                      <span>฿{Number(s.price_thb).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </SummaryRow>

              <div className="border-t pt-3">
                <Label htmlFor="promo" className="flex items-center gap-1 text-xs uppercase tracking-wider text-muted-foreground">
                  <Tag className="h-3 w-3" />
                  รหัสคูปอง
                </Label>
                <div className="mt-1 flex gap-2">
                  <Input
                    id="promo"
                    value={promoCode}
                    onChange={(e) => {
                      setPromoCode(e.target.value.toUpperCase())
                      setPromoApplied(null)
                      setPromoError(null)
                    }}
                    placeholder="ใส่รหัสถ้ามี"
                    className="font-mono uppercase"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!promoCode.trim() || promoChecking}
                    onClick={checkPromo}
                  >
                    {promoChecking ? '…' : 'ใช้'}
                  </Button>
                </div>
                {promoApplied && (
                  <p className="mt-1 text-xs text-emerald-700">
                    ✓ ใช้โปร &ldquo;{promoApplied.name}&rdquo; — ลด ฿{promoApplied.discount.toLocaleString()}
                  </p>
                )}
                {promoError && <p className="mt-1 text-xs text-red-700">{promoError}</p>}
              </div>

              <div className="border-t pt-3">
                {promoApplied && (
                  <>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>ราคาเต็ม</span>
                      <span className="line-through">฿{totalPrice.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-emerald-700">
                      <span>ส่วนลด</span>
                      <span>-฿{promoApplied.discount.toLocaleString()}</span>
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between text-base font-semibold">
                  <span>รวม</span>
                  <span>฿{(promoApplied?.total ?? totalPrice).toLocaleString()}</span>
                </div>
                <Badge variant="secondary" className="mt-1 gap-1">
                  <Clock className="h-3 w-3" /> {totalDuration} นาที
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
      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-md gap-2">
          {step > 1 && (
            <Button size="lg" variant="outline" className="flex-1" onClick={() => setStep((s) => s - 1)}>
              ย้อนกลับ
            </Button>
          )}
          {step < 5 && (
            <Button
              size="lg"
              className="flex-1"
              disabled={!canAdvance(step, { pickedServiceIds, pickedBarberId, pickedDate, pickedSlot })}
              onClick={() => setStep((s) => s + 1)}
            >
              ถัดไป
            </Button>
          )}
          {step === 5 && (
            <Button size="lg" className="flex-1" disabled={submitting} onClick={handleConfirm}>
              {submitting ? 'กำลังจอง…' : 'ยืนยันการจอง'}
            </Button>
          )}
        </div>
      </div>
    </LiffFrame>
  )
}

/** Map raw RPC error strings to user-friendly Thai messages */
function humanizeBookingError(raw: string): string {
  if (raw.includes('ALREADY_BOOKED')) {
    return 'คุณมีคิวที่เวลานี้อยู่แล้ว ดูได้ที่ "คิวของฉัน"'
  }
  if (raw.includes('SLOT_UNAVAILABLE')) {
    return 'ขออภัย คิวนี้ถูกจองไปแล้วโดยลูกค้าท่านอื่น กรุณาเลือกเวลาอื่น'
  }
  if (raw.includes('LOCK_EXPIRED_OR_INVALID_STATE')) {
    return 'หมดเวลาการจองชั่วคราว กรุณาลองใหม่อีกครั้ง'
  }
  if (raw.includes('bookings_check')) {
    return 'ไม่สามารถจองเวลาในอดีต กรุณาเลือกเวลาในอนาคต'
  }
  return raw.slice(0, 200) // fallback — show raw but truncated
}

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

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm">{children}</div>
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
