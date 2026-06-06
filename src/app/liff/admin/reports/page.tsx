'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Award,
  CalendarRange,
  CircleDollarSign,
  Clock,
  TrendingDown,
  TrendingUp,
  UserPlus,
  UserX,
} from 'lucide-react'
import { useLiff, useIsAdmin } from '@/lib/liff/provider'
import { LiffFrame } from '@/components/liff/liff-frame'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type Report = {
  range: { from: string; to: string; days: number }
  totals: {
    bookings: number
    completed: number
    no_shows: number
    cancelled: number
    revenue: number
    no_show_rate: number
    previous: {
      bookings: number
      completed: number
      no_shows: number
      revenue: number
      no_show_rate: number
    }
    revenue_change_pct: number | null
    bookings_change_pct: number | null
    completed_change_pct: number | null
  }
  daily: { date: string; revenue: number; count: number }[]
  per_barber: { name: string; revenue: number; completed: number; total: number; no_show: number }[]
  per_service: { name: string; count: number; revenue: number }[]
  hourly: { hour: number; count: number }[]
  customers: { unique: number; new: number; returning: number }
}

type RangeKey = '7d' | '30d' | '90d'

const RANGE_LABEL: Record<RangeKey, string> = {
  '7d': '7 วัน',
  '30d': '30 วัน',
  '90d': '90 วัน',
}

const FMT_DATE = new Intl.DateTimeFormat('th-TH', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})

export default function AdminReportsPage() {
  const { loading, error, idToken } = useLiff()
  const isAdmin = useIsAdmin()
  const [range, setRange] = useState<RangeKey>('7d')
  const [report, setReport] = useState<Report | null>(null)

  const load = useCallback(async () => {
    if (!idToken) return
    const res = await fetch(
      `/api/admin/reports?idToken=${encodeURIComponent(idToken)}&range=${range}`
    )
    if (res.ok) setReport((await res.json()) as Report)
  }, [idToken, range])

  useEffect(() => {
    if (idToken && isAdmin) load()
  }, [idToken, isAdmin, load])

  if (loading) return <Centered>กำลังโหลด…</Centered>
  if (error) return <Centered>{error}</Centered>
  if (!isAdmin) return <Centered>ต้องเป็นพนักงาน</Centered>

  if (!report) {
    return (
      <LiffFrame title="รายงาน" back="/liff/admin">
        <RangeTabs current={range} onChange={setRange} />
        <p className="mt-4 text-sm text-muted-foreground">กำลังโหลด…</p>
      </LiffFrame>
    )
  }

  const maxDailyRevenue = Math.max(1, ...report.daily.map((d) => d.revenue))
  const maxHourly = Math.max(1, ...report.hourly.map((d) => d.count))
  const maxBarberRevenue = Math.max(1, ...report.per_barber.map((d) => d.revenue))

  return (
    <LiffFrame title={`รายงาน ${RANGE_LABEL[range]}`} back="/liff/admin">
      <RangeTabs current={range} onChange={setRange} />

      <div className="mt-4 grid grid-cols-2 gap-2">
        <DeltaStat
          icon={CircleDollarSign}
          label="รายได้"
          value={`฿${report.totals.revenue.toLocaleString()}`}
          delta={report.totals.revenue_change_pct}
        />
        <DeltaStat
          icon={Award}
          label="คิวเสร็จ"
          value={report.totals.completed}
          delta={report.totals.completed_change_pct}
        />
        <DeltaStat
          icon={CalendarRange}
          label="คิวทั้งหมด"
          value={report.totals.bookings}
          delta={report.totals.bookings_change_pct}
        />
        <DeltaStat
          icon={UserX}
          label={`No-show ${report.totals.no_show_rate}%`}
          value={report.totals.no_shows}
          delta={null}
        />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <MiniStat icon={UserPlus} label="ลูกค้าใหม่" value={report.customers.new} />
        <MiniStat label="ลูกค้าเก่า" value={report.customers.returning} />
        <MiniStat label="ลูกค้าทั้งหมด" value={report.customers.unique} />
      </div>

      <Section title="รายได้รายวัน">
        {report.daily.length === 0 && <Empty>ยังไม่มีรายการ</Empty>}
        {report.daily.map((d) => (
          <Bar
            key={d.date}
            label={FMT_DATE.format(new Date(d.date + 'T00:00:00+07:00'))}
            value={`฿${d.revenue.toLocaleString()}`}
            ratio={d.revenue / maxDailyRevenue}
          />
        ))}
      </Section>

      <Section title="ช่างที่ทำเงินสูงสุด">
        {report.per_barber.length === 0 && <Empty>ยังไม่มีรายการ</Empty>}
        {report.per_barber.map((b) => (
          <Bar
            key={b.name}
            label={`${b.name} · ${b.completed}/${b.total} คิว`}
            value={`฿${b.revenue.toLocaleString()}`}
            ratio={b.revenue / maxBarberRevenue}
          />
        ))}
      </Section>

      <Section title="บริการยอดนิยม">
        {report.per_service.length === 0 && <Empty>ยังไม่มีรายการ</Empty>}
        {report.per_service.map((s) => (
          <div key={s.name} className="flex items-center justify-between border-b border-border py-1.5 text-sm last:border-0">
            <span>{s.name}</span>
            <span className="text-muted-foreground">
              {s.count} ครั้ง · ฿{s.revenue.toLocaleString()}
            </span>
          </div>
        ))}
      </Section>

      <Section title="ช่วงเวลายอดนิยม">
        <div className="grid grid-cols-8 gap-1">
          {report.hourly.map((h) => {
            const intensity = h.count / maxHourly
            return (
              <div key={h.hour} className="text-center">
                <div
                  className="mx-auto mb-1 h-8 w-full rounded-sm"
                  style={{
                    background: `hsl(240 5% 90% / 1) linear-gradient(0deg, hsl(240 5% 10%) ${
                      intensity * 100
                    }%, transparent ${intensity * 100}%)`,
                  }}
                />
                <div className="text-[9px] text-muted-foreground">{h.hour}</div>
              </div>
            )
          })}
        </div>
        <p className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          เข้มขึ้น = ลูกค้าจองช่วงนั้นมากกว่า
        </p>
      </Section>
    </LiffFrame>
  )
}

function RangeTabs({ current, onChange }: { current: RangeKey; onChange: (r: RangeKey) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-md border border-border bg-card p-1">
      {(Object.keys(RANGE_LABEL) as RangeKey[]).map((r) => (
        <Button
          key={r}
          size="sm"
          variant={current === r ? 'default' : 'ghost'}
          onClick={() => onChange(r)}
        >
          {RANGE_LABEL[r]}
        </Button>
      ))}
    </div>
  )
}

function DeltaStat({
  icon: Icon,
  label,
  value,
  delta,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  delta: number | null
}) {
  return (
    <Card className="border-border">
      <CardContent className="py-3">
        <div className="flex items-center justify-between">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {delta != null && delta !== 0 && (
            <span
              className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${
                delta > 0 ? 'text-emerald-600' : 'text-red-600'
              }`}
            >
              {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {delta > 0 ? '+' : ''}
              {delta}%
            </span>
          )}
        </div>
        <div className="mt-1 text-lg font-bold">{value}</div>
        <div className="text-[10px] text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  )
}

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon?: React.ComponentType<{ className?: string }>
  label: string
  value: number
}) {
  return (
    <div className="rounded-md border border-border bg-card py-2 text-center">
      {Icon && <Icon className="mx-auto h-3.5 w-3.5 text-muted-foreground" />}
      <div className="text-base font-bold">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <h2 className="mt-6 mb-2 text-xs uppercase tracking-wider text-muted-foreground">{title}</h2>
      <Card className="border-border">
        <CardContent className="py-3">{children}</CardContent>
      </Card>
    </>
  )
}

function Bar({ label, value, ratio }: { label: string; value: string; ratio: number }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="w-32 truncate text-xs text-muted-foreground">{label}</div>
      <div className="flex flex-1 items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary" style={{ width: `${ratio * 100}%` }} />
        </div>
        <div className="w-20 text-right text-xs font-medium">{value}</div>
      </div>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6 text-center text-sm text-muted-foreground">
      {children}
    </main>
  )
}
