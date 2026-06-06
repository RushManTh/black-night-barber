'use client'

import Link from 'next/link'
import { useLiff, useIsAdmin } from '@/lib/liff/provider'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function AdminLandingPage() {
  const { loading, error, appProfile } = useLiff()
  const isAdmin = useIsAdmin()

  if (loading) return <main className="p-6 text-sm text-zinc-500">⏳ กำลังโหลด…</main>
  if (error) return <main className="p-6 text-sm text-red-600">{error}</main>
  if (!appProfile) return null

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-md p-6">
        <Link href="/liff" className="text-sm text-zinc-500">← กลับ</Link>
        <Card className="mt-4 border-zinc-200">
          <CardContent className="py-8 text-center">
            <div className="text-3xl">🔒</div>
            <p className="mt-2 text-sm font-medium">ต้องเป็นพนักงานหรือเจ้าของร้าน</p>
            <p className="mt-1 text-xs text-zinc-500">ติดต่อเจ้าของร้านเพื่อขอสิทธิ์</p>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-md p-4 pb-12">
      <Link href="/liff" className="text-sm text-zinc-500">← กลับ</Link>
      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Admin</h1>
        <Badge variant="secondary">{appProfile.role}</Badge>
      </div>

      <nav className="mt-6 grid gap-2">
        <NavLink href="/liff/admin/today" emoji="📅" label="คิววันนี้" />
        {appProfile.role !== 'barber' && (
          <>
            <NavLink href="/liff/admin/barbers" emoji="💈" label="จัดการช่าง" />
            <NavLink href="/liff/admin/services" emoji="✂️" label="จัดการบริการ" />
          </>
        )}
      </nav>

      <p className="mt-6 text-center text-xs text-zinc-400">
        เข้าระบบในฐานะ {appProfile.display_name}
      </p>
    </main>
  )
}

function NavLink({ href, emoji, label }: { href: string; emoji: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm font-medium transition active:scale-[0.98]"
    >
      <span className="text-lg">{emoji}</span>
      {label}
    </Link>
  )
}
