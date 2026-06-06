'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Cake, Phone, Shield, Sparkles } from 'lucide-react'
import { useLiff } from '@/lib/liff/provider'
import { LiffFrame } from '@/components/liff/liff-frame'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

const TAG_OPTIONS = ['Low Fade', 'Mid Fade', 'High Fade', 'Undercut', 'Pompadour', 'Side Part', 'Crew Cut']

export default function WelcomePage() {
  const router = useRouter()
  const { loading, error, idToken, appProfile, refresh } = useLiff()

  const [phone, setPhone] = useState('')
  const [birthday, setBirthday] = useState('')
  const [hairstyles, setHairstyles] = useState<Set<string>>(new Set())
  const [pdpa, setPdpa] = useState(false)
  const [marketing, setMarketing] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // If already onboarded (phone exists), go straight to landing
  useEffect(() => {
    if (appProfile?.phone) router.replace('/liff')
  }, [appProfile, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!idToken) return
    setSubmitting(true)
    setSubmitError(null)
    const res = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken,
        phone,
        birthday: birthday || null,
        preferred_hairstyles: [...hairstyles],
        pdpa_consent: pdpa,
        marketing_consent: marketing,
      }),
    })
    setSubmitting(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({ error: 'failed' }))
      setSubmitError(j.error ?? 'บันทึกล้มเหลว')
      return
    }
    await refresh()
    router.push('/liff')
  }

  if (loading) return <Centered>กำลังโหลด…</Centered>
  if (error) return <Centered>{error}</Centered>
  if (!appProfile) return null

  return (
    <LiffFrame title="ยินดีต้อนรับ">
      {/* Hero greeting */}
      <div className="liff-hero">
        <div className="liff-hero-tagline">
          <Sparkles className="h-3 w-3" /> เริ่มใช้งานครั้งแรก
        </div>
        <h1 className="liff-hero-title">ยินดีต้อนรับ</h1>
        <div className="liff-hero-sub">{appProfile.display_name.toUpperCase()}</div>
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-lg border border-border bg-card p-3">
        <Avatar className="h-12 w-12">
          <AvatarImage src={appProfile.avatar_url ?? undefined} alt={appProfile.display_name} />
          <AvatarFallback>{appProfile.display_name.slice(0, 1)}</AvatarFallback>
        </Avatar>
        <div className="text-sm">
          <div className="font-semibold">{appProfile.display_name}</div>
          <div className="text-xs text-muted-foreground">
            กรอกข้อมูลเล็กน้อยเพื่อให้บริการดีขึ้น
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        {/* Phone — required */}
        <div className="space-y-1.5">
          <Label htmlFor="phone" className="flex items-center gap-1">
            <Phone className="h-3.5 w-3.5" />
            เบอร์มือถือ
            <span className="text-red-600">*</span>
          </Label>
          <Input
            id="phone"
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
            placeholder="0812345678"
            maxLength={10}
            required
          />
          <p className="text-xs text-muted-foreground">
            ใช้ติดต่อกรณีฉุกเฉิน · ทางร้านไม่เปิดเผยกับใคร
          </p>
        </div>

        {/* Birthday — optional */}
        <div className="space-y-1.5">
          <Label htmlFor="birthday" className="flex items-center gap-1">
            <Cake className="h-3.5 w-3.5" />
            วันเกิด <span className="text-xs text-muted-foreground">(ไม่บังคับ)</span>
          </Label>
          <Input
            id="birthday"
            type="date"
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
          />
          <p className="text-xs text-muted-foreground">
            🎂 ระบบจะส่งโปรวันเกิดให้อัตโนมัติ
          </p>
        </div>

        {/* Preferred hairstyles */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5" />
            ทรงผมที่ชอบ <span className="text-xs text-muted-foreground">(เลือกได้หลายอัน)</span>
          </Label>
          <div className="flex flex-wrap gap-1.5">
            {TAG_OPTIONS.map((t) => {
              const picked = hairstyles.has(t)
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setHairstyles((prev) => {
                      const next = new Set(prev)
                      next.has(t) ? next.delete(t) : next.add(t)
                      return next
                    })
                  }}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    picked
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-foreground'
                  }`}
                >
                  {t}
                </button>
              )
            })}
          </div>
        </div>

        {/* PDPA + Marketing consents */}
        <Card className="border-border">
          <CardContent className="space-y-3 py-3">
            <div className="flex items-start gap-2 text-xs">
              <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <p className="text-muted-foreground">
                ข้อมูลของคุณจะถูกใช้เพื่อยืนยันการจองและให้บริการเท่านั้น
                ไม่เปิดเผยกับบุคคลภายนอก
              </p>
            </div>

            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={pdpa}
                onChange={(e) => setPdpa(e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0"
                required
              />
              <span>
                ยินยอมให้ร้านเก็บข้อมูลตามนโยบาย PDPA{' '}
                <span className="text-red-600">*</span>
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0"
              />
              <span>รับโปรโมชั่นและข่าวสารผ่าน LINE</span>
            </label>
          </CardContent>
        </Card>

        <Button size="xl" type="submit" disabled={submitting || !pdpa || !phone} className="w-full">
          {submitting ? 'กำลังบันทึก…' : 'เริ่มใช้งาน'}
        </Button>

        {submitError && (
          <p className="rounded bg-red-50 p-2 text-xs text-red-700">{submitError}</p>
        )}
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
