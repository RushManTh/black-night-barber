'use client'

import { useCallback, useEffect, useState } from 'react'
import { MessageSquareReply, Star } from 'lucide-react'
import { useLiff } from '@/lib/liff/provider'
import { LiffFrame } from '@/components/liff/liff-frame'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'

const STAFF_ROLES = ['barber', 'admin', 'owner']

const DATE_FMT = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'short',
  year: '2-digit',
})

type Review = {
  id: string
  rating: number
  comment: string | null
  tags: string[] | null
  is_anonymous: boolean
  admin_reply: string | null
  created_at: string
  customer: { profile: { display_name: string } | null } | null
}

export default function BarberReviewsPage() {
  const { loading, error, idToken, appProfile } = useLiff()
  const isStaff = appProfile != null && STAFF_ROLES.includes(appProfile.role)

  const [reviews, setReviews] = useState<Review[] | null>(null)
  const [stats, setStats] = useState<{ avg: number; count: number } | null>(null)
  const [replyOpen, setReplyOpen] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!idToken) return
    const res = await fetch(`/api/barber/reviews?idToken=${encodeURIComponent(idToken)}`)
    if (!res.ok) return
    const j = (await res.json()) as { reviews: Review[] }
    const rows = j.reviews
    setReviews(rows)
    if (rows.length > 0) {
      const avg = rows.reduce((a, r) => a + r.rating, 0) / rows.length
      setStats({ avg: Math.round(avg * 10) / 10, count: rows.length })
    } else {
      setStats({ avg: 0, count: 0 })
    }
  }, [idToken])

  useEffect(() => {
    if (isStaff && idToken) load()
  }, [isStaff, idToken, load])

  async function submitReply(id: string) {
    if (!idToken || !replyText.trim()) return
    setBusyId(id)
    await fetch(`/api/admin/reviews/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, admin_reply: replyText.trim() }),
    })
    setBusyId(null)
    setReplyOpen(null)
    setReplyText('')
    await load()
  }

  if (loading) return <Centered>กำลังโหลด…</Centered>
  if (error) return <Centered>{error}</Centered>
  if (!isStaff) return <Centered>ต้องเป็นช่าง</Centered>

  return (
    <LiffFrame title="รีวิวของฉัน" back="/liff/barber">
      {stats && (
        <Card className="mb-5 border-border">
          <CardContent className="flex items-center justify-between py-3">
            <div className="flex items-center gap-1">
              <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
              <span className="text-lg font-bold">{stats.avg.toFixed(1)}</span>
              <span className="text-xs text-muted-foreground">/ 5</span>
            </div>
            <span className="text-sm text-muted-foreground">{stats.count} รีวิว</span>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {reviews === null && <p className="text-sm text-muted-foreground">กำลังโหลด…</p>}
        {reviews && reviews.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              ยังไม่มีรีวิว
            </CardContent>
          </Card>
        )}
        {reviews?.map((r) => (
          <Card key={r.id} className="border-border">
            <CardContent className="space-y-2 py-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={`h-3.5 w-3.5 ${
                          n <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    {r.is_anonymous ? 'ลูกค้าไม่เปิดเผยชื่อ' : r.customer?.profile?.display_name ?? '?'}
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {DATE_FMT.format(new Date(r.created_at))}
                </div>
              </div>

              {r.comment && <p className="rounded bg-muted/40 p-2 text-sm">{r.comment}</p>}

              {r.tags && r.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {r.tags.map((t) => (
                    <Badge key={t} variant="outline" className="text-[10px]">
                      {t}
                    </Badge>
                  ))}
                </div>
              )}

              {r.admin_reply && (
                <div className="border-l-2 border-primary pl-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    คำตอบของฉัน
                  </div>
                  <p className="text-sm">{r.admin_reply}</p>
                </div>
              )}

              {replyOpen === r.id ? (
                <div className="space-y-2">
                  <Textarea
                    rows={2}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="ตอบกลับลูกค้า"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={!replyText.trim() || busyId === r.id}
                      onClick={() => submitReply(r.id)}
                    >
                      ส่ง
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setReplyOpen(null)}>
                      ยกเลิก
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setReplyText(r.admin_reply ?? '')
                    setReplyOpen(r.id)
                  }}
                >
                  <MessageSquareReply className="mr-1 h-3.5 w-3.5" />
                  {r.admin_reply ? 'แก้คำตอบ' : 'ตอบ'}
                </Button>
              )}
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
