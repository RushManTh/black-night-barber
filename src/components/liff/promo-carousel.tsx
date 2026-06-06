'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Cake, Sparkles, Tag, Ticket, type LucideIcon } from 'lucide-react'
import { SectionTitle } from '@/components/liff/liff-frame'

type Promo = {
  id: string
  name: string
  description: string | null
  code: string | null
  discount_type: 'percent' | 'fixed' | 'combo_price'
  discount_value: number
  trigger_type: string
  valid_until: string
}

export function PromoCarousel() {
  const [promos, setPromos] = useState<Promo[] | null>(null)

  useEffect(() => {
    fetch('/api/promos')
      .then((r) => r.json())
      .then((j) => setPromos((j.promos ?? []) as Promo[]))
      .catch(() => setPromos([]))
  }, [])

  if (!promos || promos.length === 0) return null

  return (
    <>
      <div className="mt-5 flex items-center justify-between">
        <SectionTitle icon={Sparkles}>โปรโมชั่นเดือนนี้</SectionTitle>
        <Link href="/liff/promos" className="flex items-center text-xs text-muted-foreground">
          ดูทั้งหมด
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="liff-carousel">
        {promos.map((p) => (
          <PromoCard key={p.id} promo={p} />
        ))}
      </div>
    </>
  )
}

function PromoCard({ promo }: { promo: Promo }) {
  const Icon = iconFor(promo.trigger_type)
  return (
    <Link href="/liff/promos" className="liff-promo-card">
      <div className="flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(35_50%_88%)] text-[hsl(35_50%_30%)]">
          <Icon className="h-4 w-4" />
        </div>
        {promo.code && (
          <span className="rounded-full bg-foreground/5 px-2 py-0.5 font-mono text-[10px] tracking-wider text-foreground/70">
            {promo.code}
          </span>
        )}
      </div>
      <div className="mt-3 text-2xl font-bold text-foreground">{discountLabel(promo)}</div>
      <div className="mt-0.5 line-clamp-1 text-xs font-medium text-foreground/80">{promo.name}</div>
      {promo.description && (
        <div className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">
          {promo.description}
        </div>
      )}
    </Link>
  )
}

function iconFor(type: string): LucideIcon {
  if (type === 'birthday') return Cake
  if (type === 'first_visit') return Sparkles
  if (type === 'loyalty') return Ticket
  return Tag
}

function discountLabel(p: Promo): string {
  switch (p.discount_type) {
    case 'percent':
      return `-${p.discount_value}%`
    case 'fixed':
      return `-฿${p.discount_value}`
    case 'combo_price':
      return `฿${p.discount_value}`
  }
}
