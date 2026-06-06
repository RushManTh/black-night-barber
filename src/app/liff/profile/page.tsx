'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useLiff } from '@/lib/liff/provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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

  if (loading) return <main className="p-6 text-sm text-zinc-500">⏳ กำลังโหลด…</main>
  if (error) return <main className="p-6 text-sm text-red-600">{error}</main>
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

  return (
    <main className="mx-auto max-w-md p-4 pb-12">
      <Link href="/liff" className="text-sm text-zinc-500">← กลับ</Link>
      <h1 className="mt-2 text-xl font-semibold">โปรไฟล์ของฉัน</h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
          <p className="text-xs text-zinc-500">ระบบจะส่งโปรวันเกิดให้อัตโนมัติ 🎉</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="hairstyles">ทรงผมที่ชอบ</Label>
          <Input
            id="hairstyles"
            value={hairstyles}
            onChange={(e) => setHairstyles(e.target.value)}
            placeholder="Low Fade, Undercut, Side Part"
          />
          <p className="text-xs text-zinc-500">คั่นด้วยจุลภาค ( , )</p>
        </div>

        <Button type="submit" disabled={saving} className="w-full">
          {saving ? 'กำลังบันทึก…' : 'บันทึก'}
        </Button>

        {saveError && <p className="text-sm text-red-600">{saveError}</p>}
        {savedAt && <p className="text-sm text-emerald-600">✅ บันทึกแล้ว ({savedAt.toLocaleTimeString('th')})</p>}
      </form>

      <div className="mt-8 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-500">
        <div>LINE userId: <code>{appProfile.line_user_id}</code></div>
        <div className="mt-1">Tier: {appProfile.customers?.tier ?? '—'}</div>
        <div>Trust score: {appProfile.customers?.trust_score ?? '—'}</div>
      </div>
    </main>
  )
}
