'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { useLiff, useIsAdmin } from '@/lib/liff/provider'
import { LiffFrame } from '@/components/liff/liff-frame'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Setting = { key: string; value: unknown; description: string | null }

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

  return (
    <LiffFrame title="ตั้งค่าร้าน" back="/liff/admin">
      {settings === null ? (
        <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
      ) : (
        <div className="space-y-3">
          {settings.map((s) => (
            <Card key={s.key} className="border-border">
              <CardContent className="space-y-1.5 py-3">
                <Label htmlFor={s.key} className="text-xs uppercase tracking-wider text-muted-foreground">
                  {s.key}
                </Label>
                <Input
                  id={s.key}
                  value={draft[s.key] ?? ''}
                  onChange={(e) => setDraft({ ...draft, [s.key]: e.target.value })}
                />
                {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
              </CardContent>
            </Card>
          ))}

          <Button size="lg" className="w-full" disabled={saving} onClick={handleSave}>
            {saving ? 'กำลังบันทึก…' : 'บันทึก'}
          </Button>

          {savedAt && (
            <p className="flex items-center gap-1 text-sm text-emerald-600">
              <Check className="h-4 w-4" />
              บันทึกแล้ว ({savedAt.toLocaleTimeString('th')})
            </p>
          )}
          {saveError && <p className="rounded bg-red-50 p-2 text-xs text-red-700">{saveError}</p>}
        </div>
      )}
    </LiffFrame>
  )
}

function stringifyValue(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return JSON.stringify(v)
}

function parseValue(input: string, original: unknown): unknown {
  // preserve original type
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
