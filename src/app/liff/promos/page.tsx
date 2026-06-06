import { Cake, Sparkles, Tag, Ticket } from 'lucide-react'
import { LiffFrame } from '@/components/liff/liff-frame'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Promo = {
  id: string
  name: string
  description: string | null
  code: string | null
  icon: string | null
  discount_type: 'percent' | 'fixed' | 'combo_price'
  discount_value: number
  min_amount_thb: number
  trigger_type: string
  valid_until: string
}

const DATE_FMT = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'short',
  year: '2-digit',
  timeZone: 'Asia/Bangkok',
})

export default async function PromosPage() {
  const sb = await createClient()
  const now = new Date().toISOString()
  const { data, error } = await sb
    .from('promotions')
    .select(
      'id, name, description, code, icon, discount_type, discount_value, min_amount_thb, trigger_type, valid_until'
    )
    .eq('is_active', true)
    .lte('valid_from', now)
    .gte('valid_until', now)
    .order('created_at', { ascending: false })

  const promos = (data ?? []) as Promo[]

  return (
    <LiffFrame title="โปรโมชั่น" back="/liff">
      {error && (
        <p className="rounded bg-red-50 p-2 text-xs text-red-700">{error.message}</p>
      )}

      {promos.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            <Sparkles className="mx-auto h-8 w-8" />
            <p className="mt-3">ยังไม่มีโปรโมชั่นช่วงนี้</p>
            <p className="mt-1 text-xs">รออัพเดทใหม่เร็วๆ นี้</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {promos.map((p) => (
            <Card key={p.id} className="overflow-hidden border-border">
              <CardContent className="space-y-2 py-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary">
                    <PromoIcon type={p.trigger_type} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{p.name}</div>
                    {p.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{p.description}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-base font-bold">{discountLabel(p)}</div>
                    {p.min_amount_thb > 0 && (
                      <div className="text-[10px] text-muted-foreground">
                        ขั้นต่ำ ฿{p.min_amount_thb}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between border-t pt-2 text-xs">
                  <div className="text-muted-foreground">
                    ถึง {DATE_FMT.format(new Date(p.valid_until))}
                  </div>
                  {p.code && (
                    <Badge variant="outline" className="font-mono text-[10px]">
                      <Tag className="mr-1 h-3 w-3" />
                      {p.code}
                    </Badge>
                  )}
                  {p.trigger_type === 'birthday' && (
                    <Badge variant="secondary" className="text-[10px]">
                      อัตโนมัติเดือนเกิด
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </LiffFrame>
  )
}

function discountLabel(p: Promo): string {
  switch (p.discount_type) {
    case 'percent': return `-${p.discount_value}%`
    case 'fixed': return `-฿${p.discount_value}`
    case 'combo_price': return `฿${p.discount_value}`
  }
}

function PromoIcon({ type }: { type: string }) {
  if (type === 'birthday') return <Cake className="h-5 w-5" />
  if (type === 'first_visit') return <Sparkles className="h-5 w-5" />
  if (type === 'loyalty') return <Ticket className="h-5 w-5" />
  return <Tag className="h-5 w-5" />
}
