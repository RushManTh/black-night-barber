import { Crown, Scissors, Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { LiffFrame } from '@/components/liff/liff-frame'
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
  const { data, error } = await sb
    .from('barbers')
    .select(
      'id, bio, experience_years, specialties, is_owner, display_order, total_reviews, avg_rating, profiles(display_name, avatar_url)'
    )
    .eq('is_active', true)
    .order('display_order')

  const barbers = (data ?? []) as unknown as Barber[]

  return (
    <LiffFrame title="ช่างของเรา" back="/liff">
      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error.message}</p>
      )}

      {barbers.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            <Scissors className="mx-auto h-8 w-8" />
            <p className="mt-3 font-medium">ยังไม่มีช่างในระบบ</p>
            <p className="mt-1 text-xs">เจ้าของร้านจะเพิ่มช่างผ่าน Admin Dashboard</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {barbers.map((b) => (
            <Card key={b.id} className="border-border">
              <CardContent className="flex gap-3 py-3">
                <Avatar className="h-14 w-14">
                  <AvatarImage src={b.profiles?.avatar_url ?? undefined} alt={b.profiles?.display_name ?? 'ช่าง'} />
                  <AvatarFallback>{b.profiles?.display_name?.slice(0, 1) ?? '?'}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="truncate text-sm font-semibold">{b.profiles?.display_name}</h3>
                    {b.is_owner && (
                      <Badge variant="secondary" className="gap-1 text-[10px]">
                        <Crown className="h-3 w-3" />
                        เจ้าของ
                      </Badge>
                    )}
                  </div>
                  {b.experience_years != null && (
                    <p className="text-xs text-muted-foreground">ประสบการณ์ {b.experience_years} ปี</p>
                  )}
                  {b.bio && <p className="mt-1 text-xs text-foreground/80">{b.bio}</p>}
                  {b.specialties && b.specialties.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {b.specialties.map((s) => (
                        <Badge key={s} variant="outline" className="text-[10px]">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {b.total_reviews > 0 && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-amber-600">
                      <Star className="h-3 w-3 fill-current" />
                      {b.avg_rating.toFixed(1)}
                      <span className="text-muted-foreground">({b.total_reviews} รีวิว)</span>
                    </div>
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
