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

export default function EditBarberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { loading, error, idToken } = useLiff()
  const isAdmin = useIsAdmin()

  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [exp, setExp] = useState('')
  const [specialties, setSpecialties] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [loadedOnce, setLoadedOnce] = useState(false)

  useEffect(() => {
    if (!isAdmin) return
    const sb = createClient()
    sb.from('barbers')
      .select('id, bio, experience_years, specialties, is_active, profiles(display_name)')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        const row = data as unknown as {
          bio: string | null
          experience_years: number | null
          specialties: string[] | null
          is_active: boolean
          profiles: { display_name: string } | null
        }
        setDisplayName(row.profiles?.display_name ?? '')
        setBio(row.bio ?? '')
        setExp(row.experience_years?.toString() ?? '')
        setSpecialties((row.specialties ?? []).join(', '))
        setIsActive(row.is_active)
        setLoadedOnce(true)
      })
  }, [id, isAdmin])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!idToken) return
    setSaving(true)
    setSaveError(null)
    const specialtiesArr = specialties.split(',').map((s) => s.trim()).filter(Boolean)
    const res = await fetch(`/api/admin/barbers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken,
        display_name: displayName,
        bio: bio || null,
        experience_years: exp ? Number(exp) : null,
        specialties: specialtiesArr.length > 0 ? specialtiesArr : null,
        is_active: isActive,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      setSaveError(await res.text())
      return
    }
    router.push('/liff/admin/barbers')
  }

  if (loading) return <Centered>กำลังโหลด…</Centered>
  if (error) return <Centered>{error}</Centered>
  if (!isAdmin) return <Centered>ต้องเป็นพนักงาน</Centered>
  if (!loadedOnce) return <Centered>กำลังโหลดข้อมูลช่าง…</Centered>

  return (
    <LiffFrame title="แก้ไขช่าง" back="/liff/admin/barbers">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">ชื่อช่าง</Label>
          <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="exp">ประสบการณ์ (ปี)</Label>
          <Input id="exp" type="number" min="0" value={exp} onChange={(e) => setExp(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bio">Bio</Label>
          <Textarea id="bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sp">ทรงที่ถนัด (คั่นจุลภาค)</Label>
          <Input id="sp" value={specialties} onChange={(e) => setSpecialties(e.target.value)} />
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
