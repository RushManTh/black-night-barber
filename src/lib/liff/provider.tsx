'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { Profile } from '@liff/get-profile'

type LiffState = {
  ready: boolean
  loading: boolean
  error: string | null
  profile: Profile | null
  isInClient: boolean
}

const initialState: LiffState = {
  ready: false,
  loading: true,
  error: null,
  profile: null,
  isInClient: false,
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

        const profile = await liff.getProfile()
        if (cancelled) return

        setState({
          ready: true,
          loading: false,
          error: null,
          profile,
          isInClient: liff.isInClient(),
        })
      } catch (e) {
        if (cancelled) return
        setState((s) => ({
          ...s,
          loading: false,
          error: e instanceof Error ? e.message : 'LIFF init failed',
        }))
      }
    }

    init()
    return () => {
      cancelled = true
    }
  }, [])

  return <LiffContext.Provider value={state}>{children}</LiffContext.Provider>
}

export const useLiff = () => useContext(LiffContext)
