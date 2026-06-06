'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Save } from 'lucide-react'
import { useLiff, useIsAdmin } from '@/lib/liff/provider'
import { LiffFrame } from '@/components/liff/liff-frame'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

type Template = {
  id: string
  key: string
  channel: 'line' | 'sms' | 'email' | 'in_app'
  language: string
  subject: string | null
  body: string
  is_active: boolean
  updated_at: string
}

export default function AdminTemplatesPage() {
  const { loading, error, idToken, appProfile } = useLiff()
  const isAdmin = useIsAdmin()
  const canEdit = appProfile?.role === 'owner' || appProfile?.role === 'admin'

  const [templates, setTemplates] = useState<Template[] | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Partial<Template>>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!idToken) return
    const res = await fetch(`/api/admin/templates?idToken=${encodeURIComponent(idToken)}`)
    if (!res.ok) return
    const j = (await res.json()) as { templates: Template[] }
    setTemplates(j.templates)
    setDrafts({})
  }, [idToken])

  useEffect(() => {
    if (isAdmin && idToken) load()
  }, [isAdmin, idToken, load])

  function isDirty(t: Template): boolean {
    const d = drafts[t.id]
    if (!d) return false
    if (d.body != null && d.body !== t.body) return true
    if (d.subject != null && d.subject !== t.subject) return true
    if (d.is_active != null && d.is_active !== t.is_active) return true
    return false
  }

  function update(id: string, patch: Partial<Template>) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  async function save(t: Template) {
    if (!idToken) return
    const d = drafts[t.id]
    if (!d) return
    setBusyId(t.id)
    const res = await fetch('/api/admin/templates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken,
        id: t.id,
        body: d.body,
        subject: d.subject,
        is_active: d.is_active,
      }),
    })
    setBusyId(null)
    if (res.ok) {
      setSavedId(t.id)
      setTimeout(() => setSavedId(null), 2000)
      await load()
    }
  }

  if (loading) return <Centered>กำลังโหลด…</Centered>
  if (error) return <Centered>{error}</Centered>
  if (!isAdmin || !canEdit) return <Centered>ต้องเป็น owner หรือ admin</Centered>

  return (
    <LiffFrame title="ข้อความที่ส่ง" back="/liff/admin">
      <p className="mb-4 text-xs text-muted-foreground">
        ใช้ <code className="rounded bg-muted px-1">{`{{variable}}`}</code> เพื่อแทนค่า เช่น{' '}
        <code className="rounded bg-muted px-1">{`{{date}}`}</code>,{' '}
        <code className="rounded bg-muted px-1">{`{{time}}`}</code>
      </p>

      {templates === null && <p className="text-sm text-muted-foreground">กำลังโหลด…</p>}

      <div className="space-y-3">
        {templates?.map((t) => {
          const d = drafts[t.id] ?? {}
          const body = d.body ?? t.body
          const subject = d.subject ?? t.subject
          const active = d.is_active ?? t.is_active
          const dirty = isDirty(t)
          return (
            <Card key={t.id} className={`border-border ${!active ? 'opacity-60' : ''}`}>
              <CardContent className="space-y-2 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {t.channel}
                    </Badge>
                    <code className="text-xs font-medium">{t.key}</code>
                  </div>
                  <label className="flex cursor-pointer items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={(e) => update(t.id, { is_active: e.target.checked })}
                      className="h-3.5 w-3.5"
                    />
                    เปิดใช้
                  </label>
                </div>

                {(t.channel === 'email' || t.subject != null) && (
                  <div className="space-y-1">
                    <Label htmlFor={`subj-${t.id}`}>หัวข้อ</Label>
                    <Input
                      id={`subj-${t.id}`}
                      value={subject ?? ''}
                      onChange={(e) => update(t.id, { subject: e.target.value })}
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <Label htmlFor={`body-${t.id}`}>ข้อความ</Label>
                  <Textarea
                    id={`body-${t.id}`}
                    rows={4}
                    value={body}
                    onChange={(e) => update(t.id, { body: e.target.value })}
                    className="font-mono text-xs"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-muted-foreground">
                    อัพเดทล่าสุด {new Date(t.updated_at).toLocaleString('th')}
                  </div>
                  {dirty && (
                    <Button size="sm" disabled={busyId === t.id} onClick={() => save(t)}>
                      <Save className="mr-1 h-3.5 w-3.5" />
                      บันทึก
                    </Button>
                  )}
                  {savedId === t.id && !dirty && (
                    <span className="flex items-center gap-1 text-xs text-emerald-600">
                      <Check className="h-3.5 w-3.5" />
                      บันทึกแล้ว
                    </span>
                  )}
                </div>
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
