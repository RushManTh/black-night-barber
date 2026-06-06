'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Crown, Pencil, Plus, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useLiff, useIsAdmin } from '@/lib/liff/provider'
import { LiffFrame } from '@/components/liff/liff-frame'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

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

  if (loading) return <Centered>กำลังโหลด…</Centered>
  if (error) return <Centered>{error}</Centered>
  if (!isAdmin) {
    return (
      <Centered>
        ต้องเป็นพนักงาน — <Link className="ml-1 underline" href="/liff">กลับ</Link>
      </Centered>
    )
  }

  return (
    <LiffFrame
      title="จัดการช่าง"
      back="/liff/admin"
      rightSlot={
        canEdit ? (
          <Button size="sm" variant={showForm ? 'outline' : 'default'} onClick={() => setShowForm((s) => !s)}>
            {showForm ? <X className="mr-1 h-3.5 w-3.5" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
            {showForm ? 'ยกเลิก' : 'เพิ่ม'}
          </Button>
        ) : null
      }
    >
      {showForm && canEdit && (
        <form onSubmit={handleSubmit} className="mb-5 space-y-3 rounded-lg border border-border bg-card p-4">
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
          <Button type="submit" size="lg" disabled={submitting} className="w-full">
            {submitting ? 'กำลังเพิ่ม…' : 'เพิ่มช่าง'}
          </Button>
          {submitError && <p className="text-xs text-red-600">{submitError}</p>}
          <p className="text-xs text-muted-foreground">
            ช่างใหม่จะได้ตารางทำงาน 10:00-21:00 ทุกวัน + ทำได้ทุกบริการ
          </p>
        </form>
      )}

      <div className="space-y-2">
        {barbers === null && <p className="text-sm text-muted-foreground">กำลังโหลด…</p>}
        {barbers?.length === 0 && <p className="text-sm text-muted-foreground">ยังไม่มีช่าง</p>}
        {barbers?.map((b) => (
          <Card key={b.id} className="border-border">
            <CardContent className="py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <div className="truncate text-sm font-semibold">{b.profiles?.display_name ?? '?'}</div>
                    {b.is_owner && (
                      <Badge variant="secondary" className="gap-1 text-[10px]">
                        <Crown className="h-3 w-3" />
                        เจ้าของ
                      </Badge>
                    )}
                  </div>
                  {b.experience_years != null && (
                    <div className="text-xs text-muted-foreground">ประสบการณ์ {b.experience_years} ปี</div>
                  )}
                  {b.bio && <div className="mt-1 text-xs text-foreground/80">{b.bio}</div>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge variant={b.is_active ? 'default' : 'outline'} className="text-[10px]">
                    {b.is_active ? 'active' : 'inactive'}
                  </Badge>
                  {canEdit && (
                    <Link href={`/liff/admin/barbers/${b.id}/edit`}>
                      <Button size="sm" variant="outline">
                        <Pencil className="mr-1 h-3 w-3" />
                        แก้
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
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
