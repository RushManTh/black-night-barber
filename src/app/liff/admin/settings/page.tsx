'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Bell, Check, Clock, Coins, Shield, Wallet } from 'lucide-react'
import { useLiff, useIsAdmin } from '@/lib/liff/provider'
import { LiffFrame } from '@/components/liff/liff-frame'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Setting = { key: string; value: unknown; description: string | null }

type FieldDef = {
  key: string
  label: string
  hint?: string
  type: 'number' | 'boolean' | 'text'
  suffix?: string
  min?: number
  max?: number
}

type Section = {
  title: string
  icon: React.ComponentType<{ className?: string }>
  fields: FieldDef[]
}

const SECTIONS: Section[] = [
  {
    title: 'การจอง',
    icon: Clock,
    fields: [
      {
        key: 'slot_lock_minutes',
        label: 'เวลา lock slot ตอนจอง',
        hint: 'ลูกค้ามีเวลายืนยันเท่านี้ก่อน slot หลุด',
        type: 'number',
        suffix: 'นาที',
        min: 1,
        max: 60,
      },
      {
        key: 'cancellation_window_hours',
        label: 'ยกเลิกได้ล่วงหน้า',
        hint: 'ลูกค้ายกเลิกเองได้ก่อนคิว ≥ ค่านี้',
        type: 'number',
        suffix: 'ชั่วโมง',
        min: 0,
        max: 48,
      },
      {
        key: 'max_bookings_per_day_per_user',
        label: 'จองได้สูงสุดต่อวัน/คน',
        type: 'number',
        suffix: 'คิว',
        min: 1,
        max: 10,
      },
    ],
  },
  {
    title: 'การชำระเงิน',
    icon: Wallet,
    fields: [
      { key: 'require_deposit', label: 'บังคับวางมัดจำ', type: 'boolean' },
      {
        key: 'default_deposit_thb',
        label: 'มัดจำเริ่มต้น',
        type: 'number',
        suffix: '฿',
        min: 0,
      },
    ],
  },
  {
    title: 'รอคิวว่าง (Waitlist)',
    icon: Bell,
    fields: [
      {
        key: 'waitlist_notify_window_minutes',
        label: 'เวลายืนยันหลังได้รับ offer',
        type: 'number',
        suffix: 'นาที',
        min: 5,
        max: 60,
      },
    ],
  },
  {
    title: 'แต้มสะสม (Loyalty)',
    icon: Coins,
    fields: [
      {
        key: 'loyalty_points_per_visit',
        label: 'แต้มที่ได้ต่อการใช้บริการ 1 ครั้ง',
        type: 'number',
        min: 0,
      },
      {
        key: 'loyalty_free_service_threshold',
        label: 'ครบกี่ครั้งได้บริการฟรี',
        type: 'number',
        suffix: 'ครั้ง',
        min: 0,
      },
    ],
  },
  {
    title: 'ความปลอดภัย',
    icon: Shield,
    fields: [
      {
        key: 'no_show_strike_threshold',
        label: 'No-show ที่ถูกแบนอัตโนมัติ',
        type: 'number',
        suffix: 'ครั้ง',
        min: 0,
      },
      {
        key: 'review_request_delay_minutes',
        label: 'เวลาส่งขอรีวิวหลังเสร็จ',
        type: 'number',
        suffix: 'นาที',
        min: 0,
      },
    ],
  },
]

export default function AdminSettingsPage() {
  const { loading, error, idToken, appProfile } = useLiff()
  const isAdmin = useIsAdmin()
  const canEdit = appProfile?.role === 'owner' || appProfile?.role === 'admin'

  const [settings, setSettings] = useState<Setting[] | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!idToken) return
    const res = await fetch(`/api/admin/settings?idToken=${encodeURIComponent(idToken)}`)
    if (!res.ok) {
      setSaveError(await res.text())
      return
    }
    const data = await res.json()
    const rows = (data.settings ?? []) as Setting[]
    setSettings(rows)
    const init: Record<string, string> = {}
    for (const r of rows) init[r.key] = stringifyValue(r.value)
    setDraft(init)
  }, [idToken])

  useEffect(() => {
    if (idToken && isAdmin) load()
  }, [idToken, isAdmin, load])

  async function handleSave() {
    if (!idToken || !settings) return
    setSaving(true)
    setSaveError(null)
    const updates = settings
      .filter((s) => draft[s.key] !== stringifyValue(s.value))
      .map((s) => ({ key: s.key, value: parseValue(draft[s.key], s.value) }))
    if (updates.length === 0) {
      setSaving(false)
      return
    }
    const res = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, updates }),
    })
    setSaving(false)
    if (!res.ok) {
      setSaveError(await res.text())
      return
    }
    setSavedAt(new Date())
    await load()
  }

  if (loading) return <Centered>กำลังโหลด…</Centered>
  if (error) return <Centered>{error}</Centered>
  if (!isAdmin) return <Centered>ต้องเป็นพนักงาน</Centered>
  if (!canEdit) return <Centered>ต้องเป็น owner หรือ admin</Centered>

  if (settings === null) {
    return (
      <LiffFrame title="ตั้งค่าร้าน" back="/liff/admin">
        <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
      </LiffFrame>
    )
  }

  const settingMap = new Map(settings.map((s) => [s.key, s]))

  // Collect unknown keys not covered by SECTIONS
  const known = new Set(SECTIONS.flatMap((s) => s.fields.map((f) => f.key)))
  const extras = settings.filter((s) => !known.has(s.key))

  const hasChanges = settings.some((s) => draft[s.key] !== stringifyValue(s.value))

  return (
    <LiffFrame title="ตั้งค่าร้าน" back="/liff/admin">
      {SECTIONS.map((section) => {
        const fields = section.fields.filter((f) => settingMap.has(f.key))
        if (fields.length === 0) return null
        const Icon = section.icon
        return (
          <Card key={section.title} className="mb-3 border-border">
            <CardContent className="space-y-3 py-3">
              <h3 className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
                <Icon className="h-3.5 w-3.5" />
                {section.title}
              </h3>
              {fields.map((f) => (
                <FieldInput
                  key={f.key}
                  field={f}
                  setting={settingMap.get(f.key)!}
                  value={draft[f.key] ?? ''}
                  onChange={(v) => setDraft({ ...draft, [f.key]: v })}
                />
              ))}
            </CardContent>
          </Card>
        )
      })}

      {extras.length > 0 && (
        <Card className="mb-3 border-dashed border-amber-300 bg-amber-50">
          <CardContent className="space-y-2 py-3">
            <h3 className="flex items-center gap-1 text-xs uppercase tracking-wider text-amber-900">
              <AlertTriangle className="h-3.5 w-3.5" />
              ค่าอื่นๆ (จัดหมวดยังไม่ได้)
            </h3>
            {extras.map((s) => (
              <div key={s.key} className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {s.key}
                </Label>
                <Input
                  value={draft[s.key] ?? ''}
                  onChange={(e) => setDraft({ ...draft, [s.key]: e.target.value })}
                />
                {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Button size="lg" className="w-full" disabled={saving || !hasChanges} onClick={handleSave}>
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

function FieldInput({
  field,
  setting,
  value,
  onChange,
}: {
  field: FieldDef
  setting: Setting
  value: string
  onChange: (v: string) => void
}) {
  if (field.type === 'boolean') {
    const on = value === 'true' || value === '1'
    return (
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => onChange(e.target.checked ? 'true' : 'false')}
          className="h-4 w-4"
        />
        <div className="flex-1">
          <div className="text-sm font-medium">{field.label}</div>
          {field.hint && <div className="text-xs text-muted-foreground">{field.hint}</div>}
        </div>
      </label>
    )
  }
  return (
    <div className="space-y-1">
      <Label htmlFor={field.key}>{field.label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={field.key}
          type={field.type === 'number' ? 'number' : 'text'}
          min={field.min}
          max={field.max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {field.suffix && <span className="text-xs text-muted-foreground">{field.suffix}</span>}
      </div>
      {field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
      {setting.description && setting.description !== field.hint && (
        <p className="text-[10px] text-muted-foreground">{setting.description}</p>
      )}
    </div>
  )
}

function stringifyValue(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return JSON.stringify(v)
}

function parseValue(input: string, original: unknown): unknown {
  if (typeof original === 'number') {
    const n = Number(input)
    return Number.isFinite(n) ? n : input
  }
  if (typeof original === 'boolean') return input === 'true' || input === '1'
  if (input === 'true') return true
  if (input === 'false') return false
  const asNum = Number(input)
  if (input.trim() !== '' && Number.isFinite(asNum)) return asNum
  try {
    return JSON.parse(input)
  } catch {
    return input
  }
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6 text-center text-sm text-muted-foreground">
      {children}
    </main>
  )
}
