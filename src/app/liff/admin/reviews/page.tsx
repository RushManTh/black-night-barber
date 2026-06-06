'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Eye, EyeOff, MessageSquareReply, Star } from 'lucide-react'
import { useLiff, useIsAdmin } from '@/lib/liff/provider'
import { LiffFrame } from '@/components/liff/liff-frame'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

const DATE_FMT = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

type Review = {
  id: string
  rating: number
  comment: string | null
  tags: string[] | null
  is_anonymous: boolean
  is_published: boolean
  admin_reply: string | null
  admin_replied_at: string | null
  created_at: string
  customer: { profile: { display_name: string } | null } | null
  barber: { profile: { display_name: string } | null } | null
}

export default function AdminReviewsPage() {
  const { loading, error, idToken } = useLiff()
  const isAdmin = useIsAdmin()
  const [reviews, setReviews] = useState<Review[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [replyOpen, setReplyOpen] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')

  const load = useCallback(async () => {
    if (!idToken) return
    const res = await fetch(`/api/admin/reviews?idToken=${encodeURIComponent(idToken)}`)
    if (!res.ok) return
    const data = await res.json()
    setReviews((data.reviews ?? []) as Review[])
  }, [idToken])

  useEffect(() => {
    if (isAdmin && idToken) load()
  }, [isAdmin, idToken, load])

  async function patch(id: string, body: Record<string, unknown>) {
    if (!idToken) return
    setBusyId(id)
    const res = await fetch(`/api/admin/reviews/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, ...body }),
    })
    if (res.ok) await load()
    setBusyId(null)
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
    <LiffFrame title="จัดการรีวิว" back="/liff/admin">
      {reviews === null && <p className="text-sm text-muted-foreground">กำลังโหลด…</p>}
      {reviews && reviews.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            ยังไม่มีรีวิว
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {reviews?.map((r) => (
          <Card key={r.id} className={`border-border ${!r.is_published ? 'opacity-50' : ''}`}>
            <CardContent className="space-y-2 py-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={`h-3.5 w-3.5 ${
                          n <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {r.is_anonymous ? 'ลูกค้าไม่เปิดเผยชื่อ' : r.customer?.profile?.display_name ?? '?'}
                    {' · '}ช่าง {r.barber?.profile?.display_name ?? '?'}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">{DATE_FMT.format(new Date(r.created_at))}</div>
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
                <div className="mt-2 border-l-2 border-primary pl-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    ทางร้านตอบ
                  </div>
                  <p className="text-sm">{r.admin_reply}</p>
                </div>
              )}

              {replyOpen === r.id && (
                <div className="mt-2 space-y-2">
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
                      onClick={async () => {
                        await patch(r.id, { admin_reply: replyText.trim() })
                        setReplyOpen(null)
                        setReplyText('')
                      }}
                    >
                      ส่ง
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setReplyOpen(null)}>
                      ยกเลิก
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex gap-1 pt-1">
                {replyOpen !== r.id && (
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
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === r.id}
                  onClick={() => patch(r.id, r.is_published ? { unpublish: true } : { publish: true })}
                >
                  {r.is_published ? (
                    <>
                      <EyeOff className="mr-1 h-3.5 w-3.5" />
                      ซ่อน
                    </>
                  ) : (
                    <>
                      <Eye className="mr-1 h-3.5 w-3.5" />
                      แสดง
                    </>
                  )}
                </Button>
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
