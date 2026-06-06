import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

const FORMATTER = new Intl.DateTimeFormat('th-TH', {
  dateStyle: 'full',
  timeStyle: 'short',
})

type BookingRow = {
  id: string
  slot_time: string
  duration_minutes: number
  total_thb: number
  state: string
  barbers: { profiles: { display_name: string } | null } | null
  booking_services: { service_name: string; service_price_thb: number }[]
}

export default async function BookingSuccessPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  // Admin client bypasses RLS — booking ID is a UUID and the page is only
  // reachable via LIFF redirect after a successful create. For MVP this is OK;
  // add idToken-based ownership check before exposing externally.
  const sb = createAdminClient()

  const { data } = await sb
    .from('bookings')
    .select(
      'id, slot_time, duration_minutes, total_thb, state, barbers!inner(profiles(display_name)), booking_services(service_name, service_price_thb)'
    )
    .eq('id', id)
    .maybeSingle()

  if (!data) notFound()
  const booking = data as unknown as BookingRow

  return (
    <main className="mx-auto max-w-md p-4 pb-12">
      <div className="text-center">
        <div className="text-5xl">✅</div>
        <h1 className="mt-2 text-xl font-semibold">จองสำเร็จ!</h1>
        <p className="mt-1 text-sm text-zinc-500">เราจะแจ้งเตือนคุณก่อนถึงคิว</p>
      </div>

      <Card className="mt-6 border-zinc-200">
        <CardContent className="space-y-3 py-4">
          <Row label="ช่าง">{booking.barbers?.profiles?.display_name}</Row>
          <Row label="วัน-เวลา">{FORMATTER.format(new Date(booking.slot_time))}</Row>
          <Row label="บริการ">
            <div className="space-y-1">
              {booking.booking_services.map((s, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span>{s.service_name}</span>
                  <span>฿{Number(s.service_price_thb).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </Row>
          <div className="border-t pt-3">
            <div className="flex items-center justify-between text-base font-semibold">
              <span>รวม</span>
              <span>฿{Number(booking.total_thb).toLocaleString()}</span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">⏱ {booking.duration_minutes} นาที</p>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 grid grid-cols-2 gap-2">
        <Link href="/liff/my-queue">
          <Button variant="outline" className="w-full">
            ดูคิวของฉัน
          </Button>
        </Link>
        <Link href="/liff">
          <Button className="w-full">กลับหน้าแรก</Button>
        </Link>
      </div>
    </main>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  )
}
