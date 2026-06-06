'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Props = {
  title?: string
  back?: string | true            // string=href to navigate to; true=router.back()
  rightSlot?: React.ReactNode
  children: React.ReactNode
}

/**
 * Shared LIFF page wrapper: sticky header with back/title/right-slot + max-width
 * content area. Use on every LIFF page so the chrome stays consistent.
 */
export function LiffFrame({ title, back, rightSlot, children }: Props) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col">
      {(back || title || rightSlot) && (
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/90 px-3 py-2 backdrop-blur">
          <div className="flex items-center gap-1">
            {back ? <BackButton href={typeof back === 'string' ? back : undefined} /> : <span className="w-9" />}
          </div>
          {title && <h1 className="text-sm font-semibold uppercase tracking-wider">{title}</h1>}
          <div className="flex items-center gap-1">{rightSlot ?? <span className="w-9" />}</div>
        </header>
      )}
      <main className="flex-1 px-4 py-4 pb-24">{children}</main>
    </div>
  )
}

function BackButton({ href }: { href?: string }) {
  const router = useRouter()
  if (href) {
    return (
      <Link href={href}>
        <Button variant="ghost" size="icon" aria-label="back">
          <ArrowLeft />
        </Button>
      </Link>
    )
  }
  return (
    <Button variant="ghost" size="icon" aria-label="back" onClick={() => router.back()}>
      <ArrowLeft />
    </Button>
  )
}

/**
 * Section heading — small uppercase label like in the mockup.
 */
export function SectionTitle({ icon: Icon, children }: { icon?: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="liff-section-title">
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
    </div>
  )
}
