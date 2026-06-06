'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { Profile } from '@liff/get-profile'

// Internal user shape — what /api/me returns
export type AppRole = 'customer' | 'barber' | 'admin' | 'owner'

export type AppProfile = {
  id: string
  display_name: string
  avatar_url: string | null
  phone: string | null
  line_user_id: string
  role: AppRole
  customers: {
    birthday: string | null
    preferred_hairstyles: string[] | null
    tier: 'bronze' | 'silver' | 'gold'
    trust_score: number
    total_visits: number
  } | null
}

export const ADMIN_ROLES: AppRole[] = ['barber', 'admin', 'owner']

type LiffState = {
  ready: boolean
  loading: boolean
  error: string | null
  lineProfile: Profile | null
  appProfile: AppProfile | null
  idToken: string | null
  isInClient: boolean
  refresh: () => Promise<void>
}

const initialState: LiffState = {
  ready: false,
  loading: true,
  error: null,
  lineProfile: null,
  appProfile: null,
  idToken: null,
  isInClient: false,
  refresh: async () => {},
}

const LiffContext = createContext<LiffState>(initialState)

export function LiffProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LiffState>(initialState)

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const { default: liff } = await import('@line/liff')
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! })

        if (cancelled) return

        if (!liff.isLoggedIn()) {
          liff.login()
          return
        }

        const [lineProfile, idToken] = await Promise.all([
          liff.getProfile(),
          Promise.resolve(liff.getIDToken()),
        ])
        if (cancelled) return

        // Sync with our backend
        const res = await fetch('/api/me', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idToken,
            displayName: lineProfile.displayName,
            pictureUrl: lineProfile.pictureUrl,
          }),
        })

        if (!res.ok) {
          const errText = await res.text()
          throw new Error(`sync failed (${res.status}): ${errText}`)
        }

        const { profile } = (await res.json()) as { profile: AppProfile }
        if (cancelled) return

        setState((s) => ({
          ...s,
          ready: true,
          loading: false,
          error: null,
          lineProfile,
          appProfile: profile,
          idToken: idToken ?? null,
          isInClient: liff.isInClient(),
        }))
      } catch (e) {
        if (cancelled) return
        setState((s) => ({
          ...s,
          loading: false,
          error: e instanceof Error ? e.message : 'LIFF init failed',
        }))
      }
    }

    const refresh = async () => {
      setState((s) => ({ ...s, loading: true }))
      await init()
    }

    setState((s) => ({ ...s, refresh }))
    init()
    return () => {
      cancelled = true
    }
  }, [])

  return <LiffContext.Provider value={state}>{children}</LiffContext.Provider>
}

export const useLiff = () => useContext(LiffContext)

export function useIsAdmin(): boolean {
  const { appProfile } = useLiff()
  return appProfile != null && ADMIN_ROLES.includes(appProfile.role)
}
