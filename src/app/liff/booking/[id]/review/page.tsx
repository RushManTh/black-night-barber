'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Star } from 'lucide-react'
import { useLiff } from '@/lib/liff/provider'
import { createClient } from '@/lib/supabase/client'
import { LiffFrame } from '@/components/liff/liff-frame'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

const TAG_OPTIONS = ['ฝีมือดี', 'ตรงเวลา', 'สุภาพ', 'สะอาด', 'แนะนำ', 'ราคาดี']

type BookingPreview = {
  id: string
  slot_time: string
  state: string
  total_thb: number
  barbers: { profiles: { display_name: string } | null } | null
  booking_services: { service_name: string }[]
}

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { loading, error, idToken, appProfile } = useLiff()

  const [booking, setBooking] = useState<BookingPreview | null>(null)
  const [existing, setExisting] = useState<boolean>(false)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [tags, setTags] = useState<Set<string>>(new Set())
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!appProfile) return
    const sb = createClient()
    sb.from('bookings')
      .select('id, slot_time, state, total_thb, barbers(profiles(display_name)), booking_services(service_name)')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => setBooking((data as unknown as BookingPreview) ?? null))

    sb.from('reviews')
      .select('id')
      .eq('booking_id', id)
      .maybeSingle()
      .then(({ data }) => setExisting(!!data))
  }, [id, appProfile])

  async function handleSubmit() {
    if (!idToken || rating === 0) return
    setSubmitting(true)
    setSubmitError(null)
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken,
        booking_id: id,
        rating,
        comment: comment.trim() || null,
        tags: [...tags],
        is_anonymous: isAnonymous,
      }),
    })
    setSubmitting(false)
    if (!res.ok) {
      const t = await res.text()
      setSubmitError(t)
      return
    }
    setDone(true)
    setTimeout(() => router.push('/liff'), 2000)
  }

  if (loading) return <Centered>กำลังโหลด…</Centered>
  if (error) return <Centered>{error}</Centered>
  if (!appProfile) return null

  if (done) {
    return (
      <LiffFrame back="/liff">
        <div className="py-16 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
          <p className="mt-3 text-lg font-semibold">ขอบคุณสำหรับรีวิว!</p>
          <p className="mt-1 text-sm text-muted-foreground">ความเห็นของคุณช่วยลูกค้าคนอื่นได้มาก</p>
        </div>
      </LiffFrame>
    )
  }

  if (existing) {
    return (
      <LiffFrame title="รีวิว" back="/liff">
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            คุณได้รีวิวคิวนี้แล้ว 🙏
          </CardContent>
        </Card>
      </LiffFrame>
    )
  }

  if (booking && booking.state !== 'completed') {
    return (
      <LiffFrame title="รีวิว" back="/liff">
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            รีวิวได้หลังบริการเสร็จเรียบร้อยเท่านั้น
          </CardContent>
        </Card>
      </LiffFrame>
    )
  }

  return (
    <LiffFrame title="ให้คะแนนช่าง" back="/liff">
      {booking && (
        <Card className="mb-5 border-border">
          <CardContent className="space-y-1 py-3 text-sm">
            <div className="font-semibold">{booking.barbers?.profiles?.display_name}</div>
            <div className="text-xs text-muted-foreground">
              {booking.booking_services.map((s) => s.service_name).join(' + ')} · ฿
              {Number(booking.total_thb).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mb-6 flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            className="p-1"
            aria-label={`${n} star`}
          >
            <Star
              className={`h-10 w-10 ${
                n <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'
              }`}
            />
          </button>
        ))}
      </div>
      <p className="mb-5 text-center text-xs text-muted-foreground">
        {rating === 0 && 'แตะดาวเพื่อให้คะแนน'}
        {rating === 1 && 'ไม่พอใจ'}
        {rating === 2 && 'พอใจน้อย'}
        {rating === 3 && 'พอใช้'}
        {rating === 4 && 'ดี'}
        {rating === 5 && 'ยอดเยี่ยม'}
      </p>

      <div className="mb-5">
        <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
          แท็กที่ตรงกับประสบการณ์
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TAG_OPTIONS.map((t) => {
            const picked = tags.has(t)
            return (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTags((prev) => {
                    const next = new Set(prev)
                    next.has(t) ? next.delete(t) : next.add(t)
                    return next
                  })
                }}
              >
                <Badge variant={picked ? 'default' : 'outline'} className="cursor-pointer">
                  {t}
                </Badge>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mb-5">
        <div className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">
          ความเห็นเพิ่มเติม
        </div>
        <Textarea
          rows={4}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="เล่าประสบการณ์ของคุณ (ไม่บังคับ)"
          maxLength={500}
        />
      </div>

      <label className="mb-5 flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isAnonymous}
          onChange={(e) => setIsAnonymous(e.target.checked)}
          className="h-4 w-4"
        />
        ส่งแบบไม่ระบุชื่อ
      </label>

      <Button
        size="lg"
        className="w-full"
        disabled={rating === 0 || submitting}
        onClick={handleSubmit}
      >
        {submitting ? 'กำลังส่ง…' : 'ส่งรีวิว'}
      </Button>

      {submitError && (
        <p className="mt-3 rounded bg-red-50 p-2 text-xs text-red-700">{submitError}</p>
      )}
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
