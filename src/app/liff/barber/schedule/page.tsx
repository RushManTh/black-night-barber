'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { useLiff } from '@/lib/liff/provider'
import { LiffFrame } from '@/components/liff/liff-frame'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

const DAY_NAMES = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์']
const STAFF_ROLES = ['barber', 'admin', 'owner']

type Entry = {
  day_of_week: number
  start_time: string // "10:00:00"
  end_time: string
  is_active: boolean
}

const DEFAULT_ENTRY: Omit<Entry, 'day_of_week'> = {
  start_time: '10:00:00',
  end_time: '21:00:00',
  is_active: false,
}

function timeOnly(t: string): string {
  return t.length >= 5 ? t.slice(0, 5) : t
}

export default function BarberSchedulePage() {
  const { loading, error, idToken, appProfile } = useLiff()
  const isStaff = appProfile != null && STAFF_ROLES.includes(appProfile.role)

  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!idToken) return
    const res = await fetch(`/api/barber/schedule?idToken=${encodeURIComponent(idToken)}`)
    if (!res.ok) return
    const j = (await res.json()) as { schedule: Entry[] }
    // Build 7-day list, fill from server
    const map = new Map(j.schedule.map((e) => [e.day_of_week, e]))
    setEntries(
      Array.from({ length: 7 }, (_, d) => ({
        day_of_week: d,
        ...(map.get(d) ?? DEFAULT_ENTRY),
      }))
    )
  }, [idToken])

  useEffect(() => {
    if (isStaff && idToken) load()
  }, [isStaff, idToken, load])

  function update(day: number, patch: Partial<Entry>) {
    setEntries((prev) => prev?.map((e) => (e.day_of_week === day ? { ...e, ...patch } : e)) ?? null)
  }

  async function save() {
    if (!idToken || !entries) return
    setSaving(true)
    setSaveError(null)
    const res = await fetch('/api/barber/schedule', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken,
        entries: entries.filter((e) => e.is_active),
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const t = await res.text()
      setSaveError(t)
      return
    }
    setSavedAt(new Date())
    await load()
  }

  if (loading) return <Centered>กำลังโหลด…</Centered>
  if (error) return <Centered>{error}</Centered>
  if (!isStaff) return <Centered>ต้องเป็นช่าง</Centered>

  return (
    <LiffFrame title="ตารางทำงานของฉัน" back="/liff/barber">
      <p className="mb-4 text-xs text-muted-foreground">
        ติ๊กวันที่ทำงาน + กำหนดเวลาเปิด-ปิดของแต่ละวัน
      </p>

      {entries === null && <p className="text-sm text-muted-foreground">กำลังโหลด…</p>}

      <div className="space-y-2">
        {entries?.map((e) => (
          <Card key={e.day_of_week} className={`border-border ${!e.is_active ? 'opacity-60' : ''}`}>
            <CardContent className="py-3">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={e.is_active}
                  onChange={(ev) => update(e.day_of_week, { is_active: ev.target.checked })}
                  className="h-4 w-4"
                />
                <span className="flex-1 text-sm font-medium">{DAY_NAMES[e.day_of_week]}</span>
              </label>
              {e.is_active && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="time"
                    value={timeOnly(e.start_time)}
                    onChange={(ev) => update(e.day_of_week, { start_time: ev.target.value + ':00' })}
                    className="rounded-md border border-border bg-card px-2 py-1 text-sm"
                  />
                  <span className="text-xs text-muted-foreground">ถึง</span>
                  <input
                    type="time"
                    value={timeOnly(e.end_time)}
                    onChange={(ev) => update(e.day_of_week, { end_time: ev.target.value + ':00' })}
                    className="rounded-md border border-border bg-card px-2 py-1 text-sm"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Button size="lg" className="mt-5 w-full" disabled={saving || !entries} onClick={save}>
        {saving ? 'กำลังบันทึก…' : 'บันทึก'}
      </Button>

      {savedAt && (
        <p className="mt-2 flex items-center gap-1 text-sm text-emerald-600">
          <Check className="h-4 w-4" />
          บันทึกแล้ว ({savedAt.toLocaleTimeString('th')})
        </p>
      )}
      {saveError && <p className="mt-2 rounded bg-red-50 p-2 text-xs text-red-700">{saveError}</p>}
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
