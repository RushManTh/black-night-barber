import {
  Baby,
  Droplet,
  Palette,
  Scissors,
  Sparkles,
  WandSparkles,
  type LucideIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { LiffFrame } from '@/components/liff/liff-frame'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

const ICON_MAP: Record<string, LucideIcon> = {
  scissors: Scissors,
  droplet: Droplet,
  palette: Palette,
  'wand-sparkles': WandSparkles,
  sparkles: Sparkles,
  baby: Baby,
}

export default async function ServicesPage() {
  const sb = await createClient()
  const { data: services, error } = await sb
    .from('services')
    .select('id, name, description, icon, duration_minutes, price_thb')
    .eq('is_active', true)
    .order('display_order')

  return (
    <LiffFrame title="บริการ" back="/liff">
      <p className="text-xs text-muted-foreground">
        เลือกบริการได้หลายอย่างตอนจองคิว ระบบจะคำนวณเวลารวม + ราคาให้
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error.message}</p>
      )}

      <div className="mt-5 space-y-2">
        {services?.map((s) => {
          const Icon = ICON_MAP[s.icon ?? ''] ?? Scissors
          return (
            <Card key={s.id} className="border-border">
              <CardContent className="flex items-center gap-3 py-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold">{s.name}</h3>
                  {s.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{s.description}</p>
                  )}
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Badge variant="secondary" className="text-[10px]">
                      {s.duration_minutes} นาที
                    </Badge>
                  </div>
                </div>
                <div className="shrink-0 text-right text-base font-bold">
                  ฿{Number(s.price_thb).toLocaleString()}
                </div>
              </CardContent>
            </Card>
          )
        })}

        {services?.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">ยังไม่มีบริการ</p>
        )}
      </div>
    </LiffFrame>
  )
}
