'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLiff, useIsAdmin } from '@/lib/liff/provider'
import { LiffFrame } from '@/components/liff/liff-frame'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export default function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { loading, error, idToken } = useLiff()
  const isAdmin = useIsAdmin()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('')
  const [duration, setDuration] = useState('30')
  const [price, setPrice] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [loadedOnce, setLoadedOnce] = useState(false)

  useEffect(() => {
    if (!isAdmin) return
    const sb = createClient()
    sb.from('services')
      .select('id, name, description, icon, duration_minutes, price_thb, is_active')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        setName(data.name)
        setDescription(data.description ?? '')
        setIcon(data.icon ?? '')
        setDuration(data.duration_minutes.toString())
        setPrice(data.price_thb.toString())
        setIsActive(data.is_active)
        setLoadedOnce(true)
      })
  }, [id, isAdmin])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!idToken) return
    setSaving(true)
    setSaveError(null)
    const res = await fetch(`/api/admin/services/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken,
        name,
        description: description || null,
        icon: icon || null,
        duration_minutes: Number(duration),
        price_thb: Number(price),
        is_active: isActive,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      setSaveError(await res.text())
      return
    }
    router.push('/liff/admin/services')
  }

  if (loading) return <Centered>กำลังโหลด…</Centered>
  if (error) return <Centered>{error}</Centered>
  if (!isAdmin) return <Centered>ต้องเป็นพนักงาน</Centered>
  if (!loadedOnce) return <Centered>กำลังโหลดข้อมูลบริการ…</Centered>

  return (
    <LiffFrame title="แก้ไขบริการ" back="/liff/admin/services">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">ชื่อบริการ</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="desc">รายละเอียด</Label>
          <Textarea id="desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="icon">ไอคอน (lucide name)</Label>
          <Input id="icon" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="scissors" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="dur">ระยะเวลา (นาที)</Label>
            <Input id="dur" type="number" min="5" step="5" value={duration} onChange={(e) => setDuration(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="price">ราคา (฿)</Label>
            <Input id="price" type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} required />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4"
          />
          เปิดให้ลูกค้าจอง
        </label>

        <Button size="lg" type="submit" disabled={saving} className="w-full">
          {saving ? 'กำลังบันทึก…' : 'บันทึก'}
        </Button>

        {saveError && <p className="rounded bg-red-50 p-2 text-xs text-red-700">{saveError}</p>}
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
