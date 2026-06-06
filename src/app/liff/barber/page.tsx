'use client'

import Link from 'next/link'
import { CalendarClock, CalendarDays, Plane, Star } from 'lucide-react'
import { useLiff } from '@/lib/liff/provider'
import { LiffFrame } from '@/components/liff/liff-frame'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const STAFF_ROLES = ['barber', 'admin', 'owner']

export default function BarberLandingPage() {
  const { loading, error, appProfile } = useLiff()

  if (loading) return <Centered>กำลังโหลด…</Centered>
  if (error) return <Centered>{error}</Centered>
  if (!appProfile) return null

  if (!STAFF_ROLES.includes(appProfile.role)) {
    return (
      <LiffFrame back="/liff">
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            หน้านี้สำหรับช่างเท่านั้น
          </CardContent>
        </Card>
      </LiffFrame>
    )
  }

  return (
    <LiffFrame
      title="ช่าง"
      back="/liff"
      rightSlot={<Badge variant="secondary">{appProfile.role}</Badge>}
    >
      <p className="mb-4 text-sm text-muted-foreground">สวัสดี {appProfile.display_name}</p>

      <nav className="grid gap-2">
        <NavLink href="/liff/admin/today" icon={CalendarDays} label="คิววันนี้" />
        <NavLink href="/liff/admin/schedule" icon={CalendarClock} label="ตารางคิวร้าน" />
        <NavLink href="/liff/barber/schedule" icon={CalendarClock} label="ตารางทำงานของฉัน" />
        <NavLink href="/liff/barber/time-off" icon={Plane} label="วันหยุด / ลา" />
        <NavLink href="/liff/barber/reviews" icon={Star} label="รีวิวของฉัน" />
      </nav>
    </LiffFrame>
  )
}

function NavLink({
  href,
  icon: Icon,
  label,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition active:scale-[0.98]"
    >
      <Icon className="h-5 w-5 text-muted-foreground" />
      <span className="text-sm font-medium">{label}</span>
    </Link>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6 text-center text-sm text-muted-foreground">
      {children}
    </main>
  )
}
