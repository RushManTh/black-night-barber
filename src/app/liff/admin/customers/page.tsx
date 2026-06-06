'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Phone, Search } from 'lucide-react'
import { useLiff, useIsAdmin } from '@/lib/liff/provider'
import { LiffFrame } from '@/components/liff/liff-frame'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

type Customer = {
  id: string
  birthday: string | null
  tier: 'bronze' | 'silver' | 'gold'
  trust_score: number
  total_visits: number
  total_spent_thb: number
  no_show_count: number
  last_visit_at: string | null
  profile: { display_name: string; phone: string | null } | null
}

const TIER_COLOR: Record<string, string> = {
  bronze: 'bg-amber-700/10 text-amber-700',
  silver: 'bg-zinc-400/10 text-zinc-700',
  gold: 'bg-yellow-500/10 text-yellow-700',
}

const FMT = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })

export default function AdminCustomersPage() {
  const { loading, error, idToken } = useLiff()
  const isAdmin = useIsAdmin()
  const [customers, setCustomers] = useState<Customer[] | null>(null)
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(
    async (q: string) => {
      if (!idToken) return
      setRefreshing(true)
      const url = `/api/admin/customers?idToken=${encodeURIComponent(idToken)}${q ? `&q=${encodeURIComponent(q)}` : ''}`
      const res = await fetch(url)
      const data = await res.json()
      setCustomers((data.customers ?? []) as Customer[])
      setRefreshing(false)
    },
    [idToken]
  )

  useEffect(() => {
    if (isAdmin && idToken) load('')
  }, [isAdmin, idToken, load])

  // debounce search
  useEffect(() => {
    if (!idToken || !isAdmin) return
    const handle = setTimeout(() => load(search), 350)
    return () => clearTimeout(handle)
  }, [search, idToken, isAdmin, load])

  if (loading) return <Centered>กำลังโหลด…</Centered>
  if (error) return <Centered>{error}</Centered>
  if (!isAdmin) return <Centered>ต้องเป็นพนักงาน</Centered>

  return (
    <LiffFrame title="ลูกค้า" back="/liff/admin">
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหา ชื่อ หรือ เบอร์"
          className="pl-9"
        />
      </div>

      {customers === null || refreshing ? (
        <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
      ) : customers.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">ไม่พบลูกค้า</p>
      ) : (
        <div className="space-y-2">
          {customers.map((c) => (
            <Link key={c.id} href={`/liff/admin/customers/${c.id}`} className="block">
            <Card className="border-border transition active:scale-[0.99]">
              <CardContent className="space-y-1 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {c.profile?.display_name ?? '?'}
                    </div>
                    {c.profile?.phone && (
                      <a
                        href={`tel:${c.profile.phone}`}
                        className="inline-flex items-center gap-1 text-xs text-blue-600"
                      >
                        <Phone className="h-3 w-3" />
                        {c.profile.phone}
                      </a>
                    )}
                  </div>
                  <Badge className={TIER_COLOR[c.tier] ?? ''}>{c.tier}</Badge>
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span>{c.total_visits} ครั้ง</span>
                  <span>฿{Number(c.total_spent_thb).toLocaleString()}</span>
                  <span>Trust {c.trust_score}</span>
                  {c.no_show_count > 0 && <span className="text-red-600">ไม่มา {c.no_show_count}</span>}
                </div>
                {c.last_visit_at && (
                  <div className="text-[10px] text-muted-foreground">
                    มาล่าสุด {FMT.format(new Date(c.last_visit_at))}
                  </div>
                )}
              </CardContent>
            </Card>
            </Link>
          ))}
        </div>
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
