import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendWelcomeEmail } from '@/lib/email'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // First-login welcome email. Fully defensive: any failure — the
      // welcomed_at column not existing yet (before migration 029 is applied),
      // no RESEND_API_KEY, or an email error — is swallowed so it can NEVER
      // block or break the login redirect. welcomed_at is set only after a
      // successful send, so users aren't marked "welcomed" prematurely.
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user?.email) {
          // Audit: record the sign-in (covers Google OAuth + magic link).
          await supabase.from('security_events').insert({ user_id: user.id, event: 'login' })
          const { data: profile } = await supabase
            .from('profiles')
            .select('welcomed_at, full_name')
            .eq('id', user.id)
            .maybeSingle()
          if (profile && profile.welcomed_at == null) {
            const res = await sendWelcomeEmail(user.email, {
              name: profile.full_name?.trim() || undefined,
              dashboardUrl: `${origin}/dashboard`,
            })
            if (res.ok) {
              await supabase
                .from('profiles')
                .update({ welcomed_at: new Date().toISOString() })
                .eq('id', user.id)
            }
          }
        }
      } catch (e) {
        console.warn('[auth/callback] welcome email skipped:', e)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
