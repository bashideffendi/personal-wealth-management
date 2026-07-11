'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { Toaster } from 'sonner'
import { LanguageProvider } from '@/lib/i18n/context'
import { ThemeProvider, useTheme } from '@/components/theme/theme-provider'
import { PrivacyProvider } from '@/components/privacy/privacy-provider'
import { CalmModeProvider } from '@/components/privacy/calm-mode-provider'
function ThemedToaster() {
  const { resolved } = useTheme()
  return (
    <Toaster
      position="top-center"
      theme={resolved === 'dark' ? 'dark' : 'light'}
      richColors
      closeButton
      toastOptions={{
        style: {
          fontFamily: 'var(--font-sans)',
          fontSize: '13px',
        },
      }}
    />
  )
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <PrivacyProvider>
          <CalmModeProvider>
            {/* LockProvider + LockScreen pindah ke dashboard/layout.tsx — fitur
                lock cuma relevan area authed; naruh di root bikin supabase-js
                ikut ke bundle semua halaman termasuk landing/marketing. */}
            <LanguageProvider>
              {children}
              <ThemedToaster />
            </LanguageProvider>
          </CalmModeProvider>
        </PrivacyProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
