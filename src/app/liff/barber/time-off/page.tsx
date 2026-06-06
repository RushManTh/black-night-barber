'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useLiff } from '@/lib/liff/provider'
import { LiffFrame } from '@/components/liff/liff-frame'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const STAFF_ROLES = ['barber', 'admin', 'owner']

type TimeOff = {
  id: string
  start_at: string
  end_at: string
  reason: string | null
  created_at: string
}

const FMT = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Bangkok',
})

function localDt(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function BarberTimeOffPage() {
  const { loading, error, idToken, appProfile } = useLiff()
  const isStaff = appProfile != null && STAFF_ROLES.includes(appProfile.role)

  const [items, setItems] = useState<TimeOff[] | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [startAt, setStartAt] = useState(localDt(new Date()))
  const [endAt, setEndAt] = useState(localDt(new Date(Date.now() + 86400000)))
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!idToken) return
    const res = await fetch(`/api/barber/time-off?idToken=${encodeURIComponent(idToken)}`)
    if (!res.ok) return
    const j = (await res.json()) as { items: TimeOff[] }
    setItems(j.items)
  }, [idToken])

  useEffect(() => {
    if (isStaff && idToken) load()
  }, [isStaff, idToken, load])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!idToken) return
    setSubmitting(true)
    setSubmitError(null)
    const res = await fetch('/api/barber/time-off', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken,
        start_at: new Date(startAt).toISOString(),
        end_at: new Date(endAt).toISOString(),
        reason: reason || null,
      }),
    })
    setSubmitting(false)
    if (!res.ok) {
      const t = await res.text()
      setSubmitError(t)
      return
    }
    setReason('')
    setShowForm(false)
    await load()
  }

  async function cancel(id: string) {
    if (!idToken) return
    if (!confirm('ยกเลิกการลานี้?')) return
    setBusy(id)
    await fetch(`/api/barber/time-off/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    })
    setBusy(null)
    await load()
  }

  if (loading) return <Centered>กำลังโหลด…</Centered>
  if (error) return <Centered>{error}</Centered>
  if (!isStaff) return <Centered>ต้องเป็นช่าง</Centered>

  return (
    <LiffFrame
      title="วันหยุด / ลา"
      back="/liff/barber"
      rightSlot={
        <Button size="sm" variant={showForm ? 'outline' : 'default'} onClick={() => setShowForm((s) => !s)}>
          {showForm ? <X className="mr-1 h-3.5 w-3.5" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
          {showForm ? 'ยกเลิก' : 'ขอลา'}
        </Button>
      }
    >
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-5 space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="space-y-1.5">
            <Label htmlFor="sa">เริ่ม *</Label>
            <Input id="sa" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ea">สิ้นสุด *</Label>
            <Input id="ea" type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reason">เหตุผล</Label>
            <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เช่น พบหมอ, ลาป่วย" />
          </div>
          <Button size="lg" type="submit" disabled={submitting} className="w-full">
            {submitting ? 'กำลังบันทึก…' : 'บันทึก'}
          </Button>
          {submitError && <p className="rounded bg-red-50 p-2 text-xs text-red-700">{submitError}</p>}
          <p className="text-xs text-muted-foreground">
            ช่วงเวลาที่ลาจะ block slot อัตโนมัติ ลูกค้าจองทับไม่ได้
          </p>
        </form>
      )}

      <div className="space-y-2">
        {items === null && <p className="text-sm text-muted-foreground">กำลังโหลด…</p>}
        {items && items.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              ยังไม่มีการลา
            </CardContent>
          </Card>
        )}
        {items?.map((t) => {
          const now = new Date()
          const past = new Date(t.end_at) < now
          return (
            <Card key={t.id} className={`border-border ${past ? 'opacity-60' : ''}`}>
              <CardContent className="space-y-1 py-3">
                <div className="text-sm font-medium">
                  {FMT.format(new Date(t.start_at))} — {FMT.format(new Date(t.end_at))}
                </div>
                {t.reason && <div className="text-xs text-muted-foreground">{t.reason}</div>}
                {!past && (
                  <Button size="sm" variant="outline" disabled={busy === t.id} onClick={() => cancel(t.id)}>
                    <X className="mr-1 h-3.5 w-3.5" />
                    ยกเลิก
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
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
