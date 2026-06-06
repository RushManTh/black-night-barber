import type { Metadata } from 'next'
import { Inter, IBM_Plex_Sans_Thai } from 'next/font/google'
import './globals.css'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

const ibmPlexThai = IBM_Plex_Sans_Thai({
  variable: '--font-ibm-thai',
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'BLACK NIGHT BARBER SHOP',
  description: 'ร้านตัดผมพรีเมียม สทิงหม้อ สงขลา — จองคิวออนไลน์',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="th"
      className={`${inter.variable} ${ibmPlexThai.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[hsl(240_5%_96%)] text-foreground">
        {children}
      </body>
    </html>
  )
}
