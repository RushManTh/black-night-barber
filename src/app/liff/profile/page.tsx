'use client'

import { useEffect, useState } from 'react'
import { Check, Sparkles } from 'lucide-react'
import { useLiff } from '@/lib/liff/provider'
import { LiffFrame } from '@/components/liff/liff-frame'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const TIER_LABEL: Record<string, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
}

export default function ProfilePage() {
  const { loading, error, appProfile, idToken } = useLiff()

  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone] = useState('')
  const [birthday, setBirthday] = useState('')
  const [hairstyles, setHairstyles] = useState('')

  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!appProfile) return
    setDisplayName(appProfile.display_name ?? '')
    setPhone(appProfile.phone ?? '')
    setBirthday(appProfile.customers?.birthday ?? '')
    setHairstyles((appProfile.customers?.preferred_hairstyles ?? []).join(', '))
  }, [appProfile])

  if (loading) return <Centered>กำลังโหลด…</Centered>
  if (error) return <Centered>{error}</Centered>
  if (!appProfile || !idToken) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)

    const hairstylesArr = hairstyles
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    const res = await fetch('/api/me/update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken,
        display_name: displayName,
        phone: phone || null,
        birthday: birthday || null,
        preferred_hairstyles: hairstylesArr.length > 0 ? hairstylesArr : null,
      }),
    })

    setSaving(false)
    if (!res.ok) {
      const t = await res.text()
      setSaveError(`บันทึกล้มเหลว: ${t}`)
      return
    }
    setSavedAt(new Date())
  }

  const customer = appProfile.customers

  return (
    <LiffFrame title="โปรไฟล์" back="/liff">
      {/* Identity card */}
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
        <Avatar className="h-14 w-14">
          <AvatarImage src={appProfile.avatar_url ?? undefined} alt={appProfile.display_name} />
          <AvatarFallback>{appProfile.display_name.slice(0, 1)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="text-sm font-semibold">{appProfile.display_name}</div>
          <div className="mt-1 flex items-center gap-2">
            {customer && <Badge variant="secondary">{TIER_LABEL[customer.tier]}</Badge>}
            <span className="text-xs text-muted-foreground">
              {customer?.total_visits ?? 0} ครั้ง · {customer?.trust_score ?? 0} pts
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">ชื่อที่จะแสดง</Label>
          <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">เบอร์มือถือ</Label>
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0812345678"
            pattern="[0-9]{9,10}"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="birthday">วันเกิด</Label>
          <Input id="birthday" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            ระบบจะส่งโปรวันเกิดให้อัตโนมัติ
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="hairstyles">ทรงผมที่ชอบ</Label>
          <Input
            id="hairstyles"
            value={hairstyles}
            onChange={(e) => setHairstyles(e.target.value)}
            placeholder="Low Fade, Undercut, Side Part"
          />
          <p className="text-xs text-muted-foreground">คั่นด้วยจุลภาค ( , )</p>
        </div>

        <Button type="submit" size="lg" disabled={saving} className="w-full">
          {saving ? 'กำลังบันทึก…' : 'บันทึก'}
        </Button>

        {saveError && <p className="text-sm text-red-600">{saveError}</p>}
        {savedAt && (
          <p className="flex items-center gap-1 text-sm text-emerald-600">
            <Check className="h-4 w-4" />
            บันทึกแล้ว ({savedAt.toLocaleTimeString('th')})
          </p>
        )}
      </form>

      <div className="mt-8 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        <div>
          LINE userId: <code>{appProfile.line_user_id}</code>
        </div>
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
