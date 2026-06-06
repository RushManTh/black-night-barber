'use client'

import { use, useCallback, useEffect, useState } from 'react'
import { Calendar, Cake, Coins, MessageSquare, Phone, Star } from 'lucide-react'
import { useLiff, useIsAdmin } from '@/lib/liff/provider'
import { LiffFrame } from '@/components/liff/liff-frame'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'

type Detail = {
  customer: {
    id: string
    birthday: string | null
    preferred_hairstyles: string[] | null
    tier: 'bronze' | 'silver' | 'gold'
    trust_score: number
    total_visits: number
    total_spent_thb: number
    no_show_count: number
    admin_notes: string | null
    first_visit_at: string | null
    last_visit_at: string | null
    profile: { display_name: string; avatar_url: string | null; phone: string | null; line_user_id: string }
  }
  bookings: Array<{
    id: string
    slot_time: string
    duration_minutes: number
    total_thb: number
    state: string
    barber: { profile: { display_name: string } | null } | null
    booking_services: { service_name: string }[]
  }>
  reviews: Array<{
    id: string
    rating: number
    comment: string | null
    tags: string[] | null
    created_at: string
    barber: { profile: { display_name: string } | null } | null
  }>
  loyalty: Array<{
    id: string
    points: number
    type: string
    description: string | null
    created_at: string
  }>
  loyalty_balance: number
}

const STATE_LABEL: Record<string, string> = {
  pending: 'รอ',
  confirmed: 'ยืนยัน',
  completed: 'เสร็จ',
  cancelled: 'ยกเลิก',
  no_show: 'ไม่มา',
  expired: 'หมดเวลา',
  checked_in: 'มาแล้ว',
  in_progress: 'กำลังตัด',
}

const FMT = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'short',
  year: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Bangkok',
})

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { loading, error, idToken, appProfile } = useLiff()
  const isAdmin = useIsAdmin()
  const canEdit = appProfile?.role === 'owner' || appProfile?.role === 'admin'

  const [data, setData] = useState<Detail | null>(null)
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  const load = useCallback(async () => {
    if (!idToken) return
    const res = await fetch(`/api/admin/customers/${id}?idToken=${encodeURIComponent(idToken)}`)
    if (!res.ok) return
    const j = (await res.json()) as Detail
    setData(j)
    setNotes(j.customer.admin_notes ?? '')
  }, [id, idToken])

  useEffect(() => {
    if (idToken && isAdmin) load()
  }, [idToken, isAdmin, load])

  async function saveNotes() {
    if (!idToken) return
    setSavingNotes(true)
    await fetch(`/api/admin/customers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, admin_notes: notes }),
    })
    setSavingNotes(false)
    await load()
  }

  if (loading) return <Centered>กำลังโหลด…</Centered>
  if (error) return <Centered>{error}</Centered>
  if (!isAdmin) return <Centered>ต้องเป็นพนักงาน</Centered>
  if (!data) return <Centered>กำลังโหลดข้อมูลลูกค้า…</Centered>

  const c = data.customer

  return (
    <LiffFrame title="ข้อมูลลูกค้า" back="/liff/admin/customers">
      {/* Header card */}
      <Card className="border-border">
        <CardContent className="space-y-2 py-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-14 w-14">
              <AvatarImage src={c.profile.avatar_url ?? undefined} alt={c.profile.display_name} />
              <AvatarFallback>{c.profile.display_name.slice(0, 1)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{c.profile.display_name}</div>
              <div className="mt-0.5 flex items-center gap-2 text-xs">
                <Badge variant="secondary">{c.tier}</Badge>
                <span className="text-muted-foreground">Trust {c.trust_score}</span>
              </div>
            </div>
          </div>
          {c.profile.phone && (
            <a
              href={`tel:${c.profile.phone}`}
              className="inline-flex items-center gap-1 text-sm text-blue-600"
            >
              <Phone className="h-3.5 w-3.5" />
              {c.profile.phone}
            </a>
          )}
          {c.birthday && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Cake className="h-3 w-3" />
              เกิด {c.birthday}
            </div>
          )}
          {c.preferred_hairstyles && c.preferred_hairstyles.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {c.preferred_hairstyles.map((h) => (
                <Badge key={h} variant="outline" className="text-[10px]">
                  {h}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="ใช้บริการ" value={`${c.total_visits} ครั้ง`} />
        <Stat label="ยอดสะสม" value={`฿${Number(c.total_spent_thb).toLocaleString()}`} />
        <Stat label="No-show" value={c.no_show_count} flag={c.no_show_count > 0} />
      </div>
      <div className="mt-3 flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
        <span className="text-amber-900">
          <Coins className="mr-1 inline h-4 w-4" />
          แต้มสะสม
        </span>
        <span className="font-bold text-amber-900">{data.loyalty_balance} แต้ม</span>
      </div>

      {/* Admin notes */}
      {canEdit && (
        <div className="mt-5">
          <div className="mb-1.5 flex items-center gap-1 text-xs uppercase tracking-wider text-muted-foreground">
            <MessageSquare className="h-3 w-3" />
            บันทึกภายใน (ลูกค้าไม่เห็น)
          </div>
          <Textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="เช่น ชอบเฟดสั้นข้าง, แพ้น้ำมัน X, มาแต่บ่าย"
          />
          <Button
            size="sm"
            className="mt-2 w-full"
            disabled={savingNotes || notes === (c.admin_notes ?? '')}
            onClick={saveNotes}
          >
            {savingNotes ? 'กำลังบันทึก…' : 'บันทึก'}
          </Button>
        </div>
      )}

      {/* Booking history */}
      <h2 className="mt-6 mb-2 flex items-center gap-1 text-xs uppercase tracking-wider text-muted-foreground">
        <Calendar className="h-3 w-3" />
        ประวัติการจอง ({data.bookings.length})
      </h2>
      <Card className="border-border">
        <CardContent className="space-y-2 py-3">
          {data.bookings.length === 0 && <p className="text-sm text-muted-foreground">ยังไม่มี</p>}
          {data.bookings.map((b) => (
            <div key={b.id} className="flex items-start justify-between border-b border-border pb-2 last:border-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{FMT.format(new Date(b.slot_time))}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {b.booking_services.map((s) => s.service_name).join(' + ')} · {b.barber?.profile?.display_name ?? '?'}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <Badge variant={badgeVariantFor(b.state)} className="text-[10px]">
                  {STATE_LABEL[b.state] ?? b.state}
                </Badge>
                <div className="mt-0.5 text-xs font-semibold">
                  ฿{Number(b.total_thb).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Reviews */}
      <h2 className="mt-6 mb-2 flex items-center gap-1 text-xs uppercase tracking-wider text-muted-foreground">
        <Star className="h-3 w-3" />
        รีวิวที่เขียน ({data.reviews.length})
      </h2>
      <Card className="border-border">
        <CardContent className="space-y-2 py-3">
          {data.reviews.length === 0 && <p className="text-sm text-muted-foreground">ยังไม่มี</p>}
          {data.reviews.map((r) => (
            <div key={r.id} className="border-b border-border pb-2 last:border-0 last:pb-0">
              <div className="flex items-center justify-between">
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={`h-3 w-3 ${
                        n <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-[10px] text-muted-foreground">
                  ช่าง {r.barber?.profile?.display_name ?? '?'}
                </span>
              </div>
              {r.comment && <p className="mt-1 text-xs">{r.comment}</p>}
            </div>
          ))}
        </CardContent>
      </Card>
    </LiffFrame>
  )
}

function Stat({ label, value, flag }: { label: string; value: string | number; flag?: boolean }) {
  return (
    <div className={`rounded-md border ${flag ? 'border-red-200 bg-red-50' : 'border-border bg-card'} py-2`}>
      <div className={`text-base font-bold ${flag ? 'text-red-700' : ''}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  )
}

function badgeVariantFor(state: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (['cancelled', 'no_show', 'expired'].includes(state)) return 'destructive'
  if (['completed'].includes(state)) return 'secondary'
  if (state === 'pending') return 'outline'
  return 'default'
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6 text-center text-sm text-muted-foreground">
      {children}
    </main>
  )
}
