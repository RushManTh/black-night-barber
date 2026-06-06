import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

export default async function ServicesPage() {
  const sb = await createClient()
  const { data: services, error } = await sb
    .from('services')
    .select('id, name, description, icon, duration_minutes, price_thb')
    .order('display_order')

  return (
    <main className="mx-auto max-w-md p-4 pb-12">
      <Link href="/liff" className="text-sm text-zinc-500">← กลับ</Link>
      <h1 className="mt-2 text-xl font-semibold">บริการ + ราคา</h1>
      <p className="mt-1 text-sm text-zinc-500">เลือกบริการได้หลายอย่างตอนจองคิว</p>

      {error && (
        <p className="mt-6 rounded-md bg-red-50 p-3 text-sm text-red-700">{error.message}</p>
      )}

      <div className="mt-6 space-y-3">
        {services?.map((s) => (
          <Card key={s.id} className="border-zinc-200">
            <CardContent className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{iconFor(s.icon)}</span>
                  <h3 className="truncate text-sm font-semibold">{s.name}</h3>
                </div>
                {s.description && (
                  <p className="mt-1 text-xs text-zinc-500">{s.description}</p>
                )}
                <Badge variant="secondary" className="mt-2 text-xs">
                  ⏱ {s.duration_minutes} นาที
                </Badge>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-base font-bold">฿{Number(s.price_thb).toLocaleString()}</div>
              </div>
            </CardContent>
          </Card>
        ))}

        {services?.length === 0 && (
          <p className="text-center text-sm text-zinc-500">ยังไม่มีบริการ</p>
        )}
      </div>
    </main>
  )
}

// Quick emoji map for the seeded icon strings (lucide names).
// When we have time, swap to real <lucide-react> icons.
function iconFor(name: string | null): string {
  switch (name) {
    case 'scissors': return '✂️'
    case 'droplet': return '💧'
    case 'palette': return '🎨'
    case 'wand-sparkles': return '✨'
    case 'sparkles': return '💆'
    case 'baby': return '👶'
    default: return '💈'
  }
}
