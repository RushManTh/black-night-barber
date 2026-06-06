'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell, RefreshCw } from 'lucide-react'
import { useLiff, useIsAdmin } from '@/lib/liff/provider'
import { LiffFrame } from '@/components/liff/liff-frame'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type Notif = {
  id: string
  channel: 'line' | 'sms' | 'email' | 'in_app'
  template_key: string | null
  recipient: string
  subject: string | null
  body: string
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'fallback_sent'
  error_message: string | null
  sent_at: string | null
  created_at: string
  customer: { profile: { display_name: string } | null } | null
}

const FMT = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Bangkok',
})

const STATUS_VARIANT: Record<Notif['status'], 'default' | 'secondary' | 'outline' | 'destructive'> = {
  pending: 'outline',
  sent: 'default',
  delivered: 'secondary',
  failed: 'destructive',
  fallback_sent: 'secondary',
}

export default function AdminNotificationsPage() {
  const { loading, error, idToken } = useLiff()
  const isAdmin = useIsAdmin()
  const [items, setItems] = useState<Notif[] | null>(null)
  const [filter, setFilter] = useState<{ status?: string; channel?: string }>({})
  const [refreshing, setRefreshing] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!idToken) return
    setRefreshing(true)
    const params = new URLSearchParams({ idToken })
    if (filter.status) params.set('status', filter.status)
    if (filter.channel) params.set('channel', filter.channel)
    const res = await fetch(`/api/admin/notifications?${params}`)
    if (res.ok) {
      const j = await res.json()
      setItems((j.notifications ?? []) as Notif[])
    }
    setRefreshing(false)
  }, [idToken, filter])

  useEffect(() => {
    if (idToken && isAdmin) load()
  }, [idToken, isAdmin, load])

  if (loading) return <Centered>กำลังโหลด…</Centered>
  if (error) return <Centered>{error}</Centered>
  if (!isAdmin) return <Centered>ต้องเป็นพนักงาน</Centered>

  return (
    <LiffFrame
      title="ประวัติการแจ้งเตือน"
      back="/liff/admin"
      rightSlot={
        <Button variant="ghost" size="icon" onClick={load} disabled={refreshing} aria-label="refresh">
          <RefreshCw className={refreshing ? 'animate-spin' : ''} />
        </Button>
      }
    >
      <div className="mb-4 space-y-2">
        <FilterRow
          label="สถานะ"
          options={[
            { v: '', t: 'ทั้งหมด' },
            { v: 'sent', t: 'ส่งแล้ว' },
            { v: 'failed', t: 'ล้มเหลว' },
            { v: 'pending', t: 'รอ' },
          ]}
          current={filter.status ?? ''}
          onChange={(v) => setFilter((f) => ({ ...f, status: v || undefined }))}
        />
        <FilterRow
          label="ช่อง"
          options={[
            { v: '', t: 'ทั้งหมด' },
            { v: 'line', t: 'LINE' },
            { v: 'sms', t: 'SMS' },
            { v: 'email', t: 'Email' },
          ]}
          current={filter.channel ?? ''}
          onChange={(v) => setFilter((f) => ({ ...f, channel: v || undefined }))}
        />
      </div>

      {items === null && <p className="text-sm text-muted-foreground">กำลังโหลด…</p>}
      {items && items.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            <Bell className="mx-auto h-6 w-6" />
            <p className="mt-2">ยังไม่มีรายการ</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {items?.map((n) => {
          const expanded = expandedId === n.id
          return (
            <Card key={n.id} className="border-border">
              <CardContent className="space-y-1 py-3">
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => setExpandedId(expanded ? null : n.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {n.channel}
                        </Badge>
                        {n.template_key && (
                          <Badge variant="secondary" className="text-[10px]">
                            {n.template_key}
                          </Badge>
                        )}
                        <Badge variant={STATUS_VARIANT[n.status]} className="text-[10px]">
                          {n.status}
                        </Badge>
                      </div>
                      <div className="mt-1 text-sm font-medium">
                        {n.customer?.profile?.display_name ?? n.recipient}
                      </div>
                      <div className="line-clamp-1 text-xs text-muted-foreground">
                        {n.body}
                      </div>
                    </div>
                    <div className="shrink-0 text-[10px] text-muted-foreground">
                      {FMT.format(new Date(n.created_at))}
                    </div>
                  </div>
                </button>
                {expanded && (
                  <div className="space-y-1 border-t border-border pt-2 text-xs">
                    {n.subject && (
                      <div>
                        <span className="text-muted-foreground">หัวข้อ:</span> {n.subject}
                      </div>
                    )}
                    <pre className="whitespace-pre-wrap rounded bg-muted/40 p-2 font-sans text-xs">
                      {n.body}
                    </pre>
                    <div className="text-muted-foreground">
                      ผู้รับ: <span className="font-mono">{n.recipient}</span>
                    </div>
                    {n.error_message && (
                      <div className="rounded bg-red-50 p-2 text-red-700">{n.error_message}</div>
                    )}
                    {n.sent_at && (
                      <div className="text-muted-foreground">
                        ส่งเมื่อ {FMT.format(new Date(n.sent_at))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </LiffFrame>
  )
}

function FilterRow({
  label,
  options,
  current,
  onChange,
}: {
  label: string
  options: { v: string; t: string }[]
  current: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-12 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="flex flex-1 flex-wrap gap-1">
        {options.map((o) => (
          <Button
            key={o.v || 'all'}
            size="sm"
            variant={current === o.v ? 'default' : 'outline'}
            onClick={() => onChange(o.v)}
          >
            {o.t}
          </Button>
        ))}
      </div>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6 text-center text-sm text-muted-foreground">
      {children}
    </main>
  )
}
