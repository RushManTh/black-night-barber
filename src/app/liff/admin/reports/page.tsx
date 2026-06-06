'use client'

import { useCallback, useEffect, useState } from 'react'
import { Award, CalendarRange, CircleDollarSign, UserX } from 'lucide-react'
import { useLiff, useIsAdmin } from '@/lib/liff/provider'
import { LiffFrame } from '@/components/liff/liff-frame'
import { Card, CardContent } from '@/components/ui/card'

type Report = {
  totals: {
    bookings: number
    completed: number
    no_shows: number
    cancelled: number
    revenue: number
    no_show_rate: number
  }
  daily: { date: string; revenue: number; count: number }[]
  top_services: { name: string; count: number; revenue: number }[]
}

const FMT_DATE = new Intl.DateTimeFormat('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })

export default function AdminReportsPage() {
  const { loading, error, idToken } = useLiff()
  const isAdmin = useIsAdmin()
  const [report, setReport] = useState<Report | null>(null)

  const load = useCallback(async () => {
    if (!idToken) return
    const res = await fetch(`/api/admin/reports?idToken=${encodeURIComponent(idToken)}`)
    if (res.ok) setReport((await res.json()) as Report)
  }, [idToken])

  useEffect(() => {
    if (idToken && isAdmin) load()
  }, [idToken, isAdmin, load])

  if (loading) return <Centered>กำลังโหลด…</Centered>
  if (error) return <Centered>{error}</Centered>
  if (!isAdmin) return <Centered>ต้องเป็นพนักงาน</Centered>

  if (!report) {
    return (
      <LiffFrame title="รายงาน" back="/liff/admin">
        <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
      </LiffFrame>
    )
  }

  const maxDailyRevenue = Math.max(1, ...report.daily.map((d) => d.revenue))

  return (
    <LiffFrame title="รายงาน 7 วัน" back="/liff/admin">
      <div className="grid grid-cols-2 gap-2">
        <Stat icon={CircleDollarSign} label="รายได้" value={`฿${report.totals.revenue.toLocaleString()}`} />
        <Stat icon={Award} label="คิวเสร็จ" value={report.totals.completed} />
        <Stat icon={CalendarRange} label="คิวทั้งหมด" value={report.totals.bookings} />
        <Stat
          icon={UserX}
          label={`No-show ${report.totals.no_show_rate}%`}
          value={report.totals.no_shows}
        />
      </div>

      <h2 className="mt-6 mb-2 text-xs uppercase tracking-wider text-muted-foreground">
        รายได้รายวัน
      </h2>
      <Card className="border-border">
        <CardContent className="space-y-2 py-3">
          {report.daily.length === 0 && <p className="text-sm text-muted-foreground">ยังไม่มีรายการ</p>}
          {report.daily.map((d) => (
            <div key={d.date} className="flex items-center gap-2">
              <div className="w-20 text-xs text-muted-foreground">
                {FMT_DATE.format(new Date(d.date + 'T00:00:00+07:00'))}
              </div>
              <div className="flex flex-1 items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${(d.revenue / maxDailyRevenue) * 100}%` }}
                  />
                </div>
                <div className="w-20 text-right text-xs font-medium">฿{d.revenue.toLocaleString()}</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <h2 className="mt-6 mb-2 text-xs uppercase tracking-wider text-muted-foreground">
        บริการยอดนิยม
      </h2>
      <Card className="border-border">
        <CardContent className="space-y-2 py-3">
          {report.top_services.length === 0 && (
            <p className="text-sm text-muted-foreground">ยังไม่มีรายการ</p>
          )}
          {report.top_services.map((s) => (
            <div key={s.name} className="flex items-center justify-between text-sm">
              <span>{s.name}</span>
              <span className="text-muted-foreground">
                {s.count} ครั้ง · ฿{s.revenue.toLocaleString()}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </LiffFrame>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
}) {
  return (
    <Card className="border-border">
      <CardContent className="py-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <div className="mt-1 text-lg font-bold">{value}</div>
        <div className="text-[10px] text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6 text-center text-sm text-muted-foreground">
      {children}
    </main>
  )
}
