"use client";

import Link from "next/link";
import {
  CalendarDays,
  Clock,
  Hourglass,
  Moon,
  Scissors,
  Sparkles,
  Ticket,
  User,
  UserCircle,
  Wrench,
} from "lucide-react";
import { useLiff, useIsAdmin } from "@/lib/liff/provider";
import { LiffFrame, SectionTitle } from "@/components/liff/liff-frame";
import { Button } from "@/components/ui/button";

export default function LiffHomePage() {
  const { loading, error, appProfile } = useLiff();
  const isAdmin = useIsAdmin();

  if (loading) return <CenterMessage>กำลังเชื่อมต่อ LINE…</CenterMessage>;
  if (error) {
    return (
      <CenterMessage>
        <div className="text-red-600">⚠️ {error}</div>
        <p className="mt-2 text-xs text-muted-foreground">
          หน้านี้ต้องเปิดผ่าน LINE Official Account หรือ LIFF URL
        </p>
      </CenterMessage>
    );
  }
  if (!appProfile) return null;

  const customer = appProfile.customers;

  return (
    <LiffFrame title="BLACK NIGHT">
      {/* Hero */}
      <section className="liff-hero">
        <div className="liff-hero-tagline">
          <Moon className="h-3 w-3" /> Singhanakorn · SONGKHLA
        </div>
        <h1 className="liff-hero-title">BLACK NIGHT</h1>
        <div className="liff-hero-sub">BARBER SHOP</div>
        <div className="liff-hero-meta">
          <Clock className="h-3 w-3" /> เปิดบริการ 10:00 — 21:00 · ทุกวัน
        </div>
      </section>

      {/* Primary CTA */}
      <Link href="/liff/booking" className="mt-5 block">
        <Button size="xl" className="w-full">
          <Scissors className="h-5 w-5" />
          จองคิวเลย
        </Button>
      </Link>

      {/* Quick grid */}
      <SectionTitle>เมนูลัด</SectionTitle>
      <div className="liff-quick-grid cols-4">
        <QuickItem href="/liff/my-queue" icon={Ticket} label="คิวของฉัน" />
        <QuickItem href="/liff/waitlist" icon={Hourglass} label="รอคิวว่าง" />
        <QuickItem href="/liff/promos" icon={Sparkles} label="โปรโมชั่น" />
        <QuickItem href="/liff/profile" icon={UserCircle} label="โปรไฟล์" />
      </div>

      {/* Browse */}
      <SectionTitle>เลือกชม</SectionTitle>
      <div className="grid gap-2">
        <NavLink
          href="/liff/services"
          icon={Scissors}
          label="บริการ + ราคา"
          sublabel="6 รายการ"
        />
        <NavLink href="/liff/barbers" icon={User} label="ช่างของเรา" />
      </div>

      {isAdmin && (
        <>
          <SectionTitle icon={Wrench}>Admin</SectionTitle>
          <NavLink
            href="/liff/admin"
            icon={Wrench}
            label="Admin Dashboard"
            sublabel={appProfile.role}
          />
        </>
      )}

      <footer className="mt-8 text-center text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
        Black Night Barber Shop
      </footer>

      {/* Account info pill at bottom */}
      <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <span>เข้าระบบในชื่อ</span>
        <span className="font-medium text-foreground">
          {appProfile.display_name}
        </span>
        {customer && (
          <>
            <span>·</span>
            <span>{customer.total_visits} ครั้ง</span>
          </>
        )}
      </div>
    </LiffFrame>
  );
}

function CenterMessage({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6 text-center text-sm">
      <div>
        <CalendarDays className="mx-auto h-6 w-6 animate-pulse text-muted-foreground" />
        <div className="mt-3">{children}</div>
      </div>
    </main>
  );
}

function QuickItem({
  href,
  icon: Icon,
  label,
  disabled,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  disabled?: boolean;
}) {
  const content = (
    <>
      <Icon className="h-5 w-5" />
      <span className="label">{label}</span>
    </>
  );
  if (disabled) {
    return (
      <button disabled className="liff-quick-item" type="button">
        {content}
      </button>
    );
  }
  return (
    <Link href={href} className="liff-quick-item">
      {content}
    </Link>
  );
}

function NavLink({
  href,
  icon: Icon,
  label,
  sublabel,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sublabel?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition active:scale-[0.98]"
    >
      <Icon className="h-5 w-5 text-muted-foreground" />
      <div className="flex-1">
        <div className="text-sm font-medium">{label}</div>
        {sublabel && (
          <div className="text-xs text-muted-foreground">{sublabel}</div>
        )}
      </div>
    </Link>
  );
}
