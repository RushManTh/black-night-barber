'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLiff, useIsAdmin } from '@/lib/liff/provider'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type BarberRow = {
  id: string
  bio: string | null
  experience_years: number | null
  specialties: string[] | null
  is_owner: boolean
  is_active: boolean
  profiles: { display_name: string } | null
}

export default function AdminBarbersPage() {
  const { loading, error, idToken, appProfile } = useLiff()
  const isAdmin = useIsAdmin()
  const canEdit = appProfile?.role === 'owner' || appProfile?.role === 'admin'

  const [barbers, setBarbers] = useState<BarberRow[] | null>(null)
  const [showForm, setShowForm] = useState(false)

  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [experienceYears, setExperienceYears] = useState('')
  const [specialties, setSpecialties] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const sb = createClient()
    const { data } = await sb
      .from('barbers')
      .select('id, bio, experience_years, specialties, is_owner, is_active, profiles(display_name)')
      .order('display_order')
    setBarbers((data ?? []) as unknown as BarberRow[])
  }, [])

  useEffect(() => {
    if (isAdmin) load()
  }, [isAdmin, load])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!idToken) return
    setSubmitting(true)
    setSubmitError(null)
    const specialtiesArr = specialties.split(',').map((s) => s.trim()).filter(Boolean)
    const res = await fetch('/api/admin/barbers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken,
        display_name: displayName,
        bio: bio || null,
        experience_years: experienceYears ? Number(experienceYears) : null,
        specialties: specialtiesArr.length > 0 ? specialtiesArr : null,
      }),
    })
    setSubmitting(false)
    if (!res.ok) {
      const t = await res.text()
      setSubmitError(t)
      return
    }
    setDisplayName(''); setBio(''); setExperienceYears(''); setSpecialties('')
    setShowForm(false)
    await load()
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
        <h1 className="text-xl font-semibold">จัดการช่าง</h1>
        {canEdit && (
          <Button size="sm" onClick={() => setShowForm((s) => !s)}>
            {showForm ? 'ยกเลิก' : '+ เพิ่ม'}
          </Button>
        )}
      </div>

      {showForm && canEdit && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-lg border border-zinc-200 bg-white p-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">ชื่อช่าง *</Label>
            <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exp">ประสบการณ์ (ปี)</Label>
            <Input id="exp" type="number" min="0" value={experienceYears} onChange={(e) => setExperienceYears(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" rows={2} value={bio} onChange={(e) => setBio(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sp">ทรงที่ถนัด (คั่นจุลภาค)</Label>
            <Input id="sp" value={specialties} onChange={(e) => setSpecialties(e.target.value)} placeholder="Fade, Undercut" />
          </div>
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? 'กำลังเพิ่ม…' : 'เพิ่มช่าง'}
          </Button>
          {submitError && <p className="text-xs text-red-600">{submitError}</p>}
          <p className="text-xs text-zinc-500">ช่างใหม่จะได้ตารางทำงาน 10:00-21:00 ทุกวัน + ทำได้ทุกบริการ</p>
        </form>
      )}

      <div className="mt-6 space-y-2">
        {barbers === null && <p className="text-sm text-zinc-500">กำลังโหลด…</p>}
        {barbers?.length === 0 && <p className="text-sm text-zinc-500">ยังไม่มีช่าง</p>}
        {barbers?.map((b) => (
          <Card key={b.id} className="border-zinc-200">
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">
                    {b.profiles?.display_name ?? '?'} {b.is_owner && '👑'}
                  </div>
                  {b.experience_years != null && (
                    <div className="text-xs text-zinc-500">ประสบการณ์ {b.experience_years} ปี</div>
                  )}
                  {b.bio && <div className="mt-1 text-xs text-zinc-600">{b.bio}</div>}
                </div>
                <div className="text-xs text-zinc-500">{b.is_active ? '✓ active' : '✗ inactive'}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  )
}
