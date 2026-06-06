'use client'

import Link from 'next/link'
import {
  BarChart3,
  Bell,
  CalendarClock,
  CalendarDays,
  FileText,
  Lock,
  MessagesSquare,
  Scissors,
  Settings,
  Tag,
  Users,
  UsersRound,
  Wrench,
} from 'lucide-react'
import { useLiff, useIsAdmin } from '@/lib/liff/provider'
import { LiffFrame } from '@/components/liff/liff-frame'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function AdminLandingPage() {
  const { loading, error, appProfile } = useLiff()
  const isAdmin = useIsAdmin()

  if (loading) return <Centered>กำลังโหลด…</Centered>
  if (error) return <Centered>{error}</Centered>
  if (!appProfile) return null

  if (!isAdmin) {
    return (
      <LiffFrame back="/liff">
        <Card className="border-border">
          <CardContent className="py-10 text-center">
            <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">ต้องเป็นพนักงานหรือเจ้าของร้าน</p>
            <p className="mt-1 text-xs text-muted-foreground">ติดต่อเจ้าของร้านเพื่อขอสิทธิ์</p>
          </CardContent>
        </Card>
      </LiffFrame>
    )
  }

  return (
    <LiffFrame
      title="Admin"
      back="/liff"
      rightSlot={<Badge variant="secondary" className="text-[10px]">{appProfile.role}</Badge>}
    >
      <nav className="grid gap-2">
        <NavLink href="/liff/admin/today" icon={CalendarDays} label="คิววันนี้" />
        <NavLink href="/liff/admin/schedule" icon={CalendarClock} label="ตารางคิวร้าน" />
        <NavLink href="/liff/admin/reviews" icon={MessagesSquare} label="รีวิว" />
        <NavLink href="/liff/admin/customers" icon={UsersRound} label="ลูกค้า" />
        <NavLink href="/liff/admin/reports" icon={BarChart3} label="รายงาน 7 วัน" />
        {appProfile.role !== 'barber' && (
          <>
            <NavLink href="/liff/admin/barbers" icon={Users} label="จัดการช่าง" />
            <NavLink href="/liff/admin/services" icon={Scissors} label="จัดการบริการ" />
            <NavLink href="/liff/admin/promotions" icon={Tag} label="โปรโมชั่น" />
            <NavLink href="/liff/admin/notifications" icon={Bell} label="ประวัติแจ้งเตือน" />
            <NavLink href="/liff/admin/templates" icon={FileText} label="ข้อความที่ส่ง" />
            <NavLink href="/liff/admin/settings" icon={Settings} label="ตั้งค่าร้าน" />
          </>
        )}
      </nav>

      <p className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Wrench className="h-3 w-3" />
        เข้าระบบในฐานะ {appProfile.display_name}
      </p>
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
