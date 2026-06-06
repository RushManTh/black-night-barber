'use client'

import Link from 'next/link'
import { useLiff } from '@/lib/liff/provider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

const TIER_LABEL: Record<string, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
}

export default function LiffHomePage() {
  const { loading, error, appProfile } = useLiff()

  if (loading) {
    return (
      <main className="p-6 text-center text-sm text-zinc-500">
        ⏳ กำลังเชื่อมต่อ LINE…
      </main>
    )
  }

  if (error) {
    return (
      <main className="p-6">
        <h1 className="text-lg font-semibold text-red-600">❌ เกิดข้อผิดพลาด</h1>
        <pre className="mt-2 whitespace-pre-wrap text-xs">{error}</pre>
        <p className="mt-4 text-sm text-zinc-500">
          หน้านี้ต้องเปิดผ่าน LINE Official Account หรือ LIFF URL จึงจะใช้งานได้
        </p>
      </main>
    )
  }

  if (!appProfile) return null

  const customer = appProfile.customers

  return (
    <main className="mx-auto max-w-md p-4 pb-12">
      <Card className="border-zinc-200">
        <CardHeader className="flex flex-row items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={appProfile.avatar_url ?? undefined} alt={appProfile.display_name} />
            <AvatarFallback>{appProfile.display_name.slice(0, 1)}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <CardTitle className="text-base">{appProfile.display_name}</CardTitle>
            <div className="mt-1 flex items-center gap-2">
              {customer && <Badge variant="secondary">{TIER_LABEL[customer.tier]}</Badge>}
              <span className="text-xs text-zinc-500">
                {customer?.total_visits ?? 0} ครั้ง
              </span>
            </div>
          </div>
        </CardHeader>
      </Card>

      <h2 className="mt-6 mb-2 text-sm font-semibold text-zinc-600">เมนู</h2>
      <nav className="grid gap-2">
        <NavLink href="/liff/profile" emoji="👤" label="โปรไฟล์ของฉัน" />
        <NavLink href="/liff/services" emoji="✂️" label="บริการ + ราคา" />
        <NavLink href="/liff/barbers" emoji="💈" label="ช่างของเรา" />
        <NavLink href="#" emoji="📅" label="จองคิว (เร็วๆ นี้)" disabled />
        <NavLink href="#" emoji="🎟️" label="คิวของฉัน (เร็วๆ นี้)" disabled />
      </nav>

      <p className="mt-6 text-center text-xs text-zinc-400">
        BLACK NIGHT BARBER SHOP · สทิงหม้อ สงขลา
      </p>
    </main>
  )
}

function NavLink({
  href,
  emoji,
  label,
  disabled,
}: {
  href: string
  emoji: string
  label: string
  disabled?: boolean
}) {
  if (disabled) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-dashed border-zinc-200 px-4 py-3 text-sm text-zinc-400">
        <span className="text-lg">{emoji}</span>
        {label}
      </div>
    )
  }
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
