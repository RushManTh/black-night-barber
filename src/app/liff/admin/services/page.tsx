'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLiff, useIsAdmin } from '@/lib/liff/provider'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Service = {
  id: string
  name: string
  duration_minutes: number
  price_thb: number
  is_active: boolean
}

export default function AdminServicesPage() {
  const { loading, error, idToken, appProfile } = useLiff()
  const isAdmin = useIsAdmin()
  const canEdit = appProfile?.role === 'owner' || appProfile?.role === 'admin'

  const [services, setServices] = useState<Service[] | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [duration, setDuration] = useState('30')
  const [price, setPrice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const sb = createClient()
    const { data } = await sb
      .from('services')
      .select('id, name, duration_minutes, price_thb, is_active')
      .order('display_order')
    setServices((data ?? []) as Service[])
  }, [])

  useEffect(() => {
    if (isAdmin) load()
  }, [isAdmin, load])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!idToken) return
    setSubmitting(true)
    setSubmitError(null)
    const res = await fetch('/api/admin/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken,
        name,
        duration_minutes: Number(duration),
        price_thb: Number(price),
      }),
    })
    setSubmitting(false)
    if (!res.ok) {
      const t = await res.text()
      setSubmitError(t)
      return
    }
    setName(''); setPrice(''); setDuration('30')
    setShowForm(false)
    await load()
  }

  async function toggleActive(s: Service) {
    if (!idToken) return
    setBusyId(s.id)
    const res = await fetch('/api/admin/services', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, id: s.id, is_active: !s.is_active }),
    })
    if (res.ok) await load()
    setBusyId(null)
  }

  if (loading) return <main className="p-6 text-sm text-zinc-500">⏳ กำลังโหลด…</main>
  if (error) return <main className="p-6 text-sm text-red-600">{error}</main>
  if (!isAdmin) {
    return (
      <main className="p-6 text-center text-sm text-zinc-500">
        ต้องเป็นพนักงาน — <Link className="underline" href="/liff">กลับ</Link>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-md p-4 pb-12">
      <Link href="/liff/admin" className="text-sm text-zinc-500">← กลับ</Link>
      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-xl font-semibold">จัดการบริการ</h1>
        {canEdit && (
          <Button size="sm" onClick={() => setShowForm((s) => !s)}>
            {showForm ? 'ยกเลิก' : '+ เพิ่ม'}
          </Button>
        )}
      </div>

      {showForm && canEdit && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-lg border border-zinc-200 bg-white p-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">ชื่อบริการ *</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dur">ระยะเวลา (นาที) *</Label>
              <Input id="dur" type="number" min="5" step="5" value={duration} onChange={(e) => setDuration(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="price">ราคา (฿) *</Label>
              <Input id="price" type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} required />
            </div>
          </div>
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? 'กำลังเพิ่ม…' : 'เพิ่มบริการ'}
          </Button>
          {submitError && <p className="text-xs text-red-600">{submitError}</p>}
          <p className="text-xs text-zinc-500">บริการใหม่จะเชื่อมโยงกับช่างที่ active ทุกคนอัตโนมัติ</p>
        </form>
      )}

      <div className="mt-6 space-y-2">
        {services === null && <p className="text-sm text-zinc-500">กำลังโหลด…</p>}
        {services?.length === 0 && <p className="text-sm text-zinc-500">ยังไม่มีบริการ</p>}
        {services?.map((s) => (
          <Card key={s.id} className={`border-zinc-200 ${!s.is_active && 'opacity-50'}`}>
            <CardContent className="flex items-center justify-between py-3">
              <div>
                <div className="text-sm font-semibold">{s.name}</div>
                <div className="text-xs text-zinc-500">
                  ⏱ {s.duration_minutes} นาที · ฿{Number(s.price_thb).toLocaleString()}
                </div>
              </div>
              {canEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === s.id}
                  onClick={() => toggleActive(s)}
                >
                  {s.is_active ? 'ปิด' : 'เปิด'}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  )
}
