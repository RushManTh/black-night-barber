import { LiffProvider } from '@/lib/liff/provider'

export default function LiffLayout({ children }: { children: React.ReactNode }) {
  return <LiffProvider>{children}</LiffProvider>
}
