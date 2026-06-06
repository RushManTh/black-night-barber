import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

type Barber = {
  id: string
  bio: string | null
  experience_years: number | null
  specialties: string[] | null
  is_owner: boolean
  display_order: number
  total_reviews: number
  avg_rating: number
  profiles: { display_name: string; avatar_url: string | null } | null
}

export default async function BarbersPage() {
  const sb = await createClient()

  // join profiles for display_name + avatar
  const { data, error } = await sb
    .from('barbers')
    .select(
      'id, bio, experience_years, specialties, is_owner, display_order, total_reviews, avg_rating, profiles(display_name, avatar_url)'
    )
    .order('display_order')

  const barbers = (data ?? []) as unknown as Barber[]

  return (
    <main className="mx-auto max-w-md p-4 pb-12">
      <Link href="/liff" className="text-sm text-zinc-500">← กลับ</Link>
      <h1 className="mt-2 text-xl font-semibold">ช่างของเรา</h1>

      {error && (
        <p className="mt-6 rounded-md bg-red-50 p-3 text-sm text-red-700">{error.message}</p>
      )}

      {barbers.length === 0 ? (
        <Card className="mt-6 border-dashed border-zinc-300">
          <CardContent className="py-8 text-center text-sm text-zinc-500">
            <div className="text-3xl">💈</div>
            <p className="mt-2">ยังไม่มีช่างในระบบ</p>
            <p className="mt-1 text-xs">เจ้าของร้านจะเพิ่มช่างผ่าน Admin Dashboard</p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 space-y-3">
          {barbers.map((b) => (
            <Card key={b.id} className="border-zinc-200">
              <CardContent className="flex gap-4 py-3">
                <Avatar className="h-14 w-14">
                  <AvatarImage src={b.profiles?.avatar_url ?? undefined} alt={b.profiles?.display_name ?? 'ช่าง'} />
                  <AvatarFallback>{b.profiles?.display_name?.slice(0, 1) ?? '?'}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-semibold">{b.profiles?.display_name}</h3>
                    {b.is_owner && <Badge variant="secondary" className="text-xs">เจ้าของ</Badge>}
                  </div>
                  {b.experience_years != null && (
                    <p className="text-xs text-zinc-500">ประสบการณ์ {b.experience_years} ปี</p>
                  )}
                  {b.bio && <p className="mt-1 text-xs text-zinc-600">{b.bio}</p>}
                  {b.specialties && b.specialties.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {b.specialties.map((s) => (
                        <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                  )}
                  {b.total_reviews > 0 && (
                    <p className="mt-2 text-xs text-amber-600">
                      ⭐ {b.avg_rating.toFixed(1)} ({b.total_reviews} รีวิว)
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  )
}
