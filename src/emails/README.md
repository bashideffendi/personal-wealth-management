# Klunting — Transactional Emails

Branded transactional emails, built with **React Email** (templates) + **Resend**
(delivery). Design = quiet-luxury "ink": near-black brand bar, clean light body,
Inter. Matches the app — deliberately *not* Budggt's neon look.

## Files
| File | Purpose |
|---|---|
| `components.tsx` | Shared shell (`EmailShell`), brand tokens, `H1` / `P` / `PrimaryButton` / `InfoBox` / `DetailRow`. Named exports only — not an email itself. |
| `welcome.tsx` | After first signup. 3 onboarding steps + CTA. |
| `magic-link.tsx` | Branded login link — for a Supabase Auth custom template. |
| `payment-success.tsx` | Subscription payment confirmed. |
| `upgrade-success.tsx` | Plan upgraded. |
| `trial-ending.tsx` | Trial ends in N days (reassures: no auto-charge). |
| `renewal-reminder.tsx` | Manual-renewal reminder (auto-renew is OFF). H-14 / H-3 / H-0 via `daysLeft`. |
| `payment-failed.tsx` | Dunning — payment failed, grace period before access ends. |
| `household-invite.tsx` | Household sharing invite (join flow at `/dashboard/join/[token]`). |

Senders live in **`src/lib/email.tsx`** (`server-only`).

## Preview
- **Live:** `npm run email:dev` → http://localhost:3030
- **Static HTML:** `npm run email:export` → `email-previews/` (open in any browser)

## Setup to actually send
1. `RESEND_API_KEY` (Resend project "klunting") → add to `.env.local` + Vercel env. **Never commit it.**
2. Domain `klunting.com` is verified in Resend (region Tokyo). From = `Klunting <noreply@klunting.com>`.
3. Without `RESEND_API_KEY`, every sender is a safe **no-op** (logs + skips) — builds/previews never crash.

## Senders (src/lib/email.tsx)
```ts
sendWelcomeEmail(to, { name, dashboardUrl })
sendPaymentSuccessEmail(to, { name, plan, amount, transactionId, periodEnd, dashboardUrl })
sendUpgradeSuccessEmail(to, { name, newPlan, amount, transactionId, periodEnd, dashboardUrl })
sendTrialEndingEmail(to, { name, daysLeft, pricingUrl })
sendRenewalReminderEmail(to, { name, plan, daysLeft, expiryDate, price, renewUrl, discountNote })
// amounts: pass pre-formatted strings, or use formatRupiah(149000) -> "Rp149.000"
```

## Triggers — where to call each
| Sender | Trigger | Status |
|---|---|---|
| `sendWelcomeEmail` | first login in `/auth/callback` | ✅ **WIRED** — apply migration 029 + set RESEND_API_KEY |
| `sendTrialEndingEmail` | cron H-3 / H-1 before trial end | scaffold: `/api/cron/reminders` (not scheduled) |
| `sendPaymentSuccessEmail` | payment webhook success | **Fase 2** (payment gateway) |
| `sendUpgradeSuccessEmail` | upgrade webhook success | **Fase 2** |
| `sendRenewalReminderEmail` | cron H-14 / H-3 / H-0 before expiry | scaffold: `/api/cron/reminders` (not scheduled) |
| magic-link | Supabase Auth (SMTP → Resend) custom template | Supabase dashboard |

## Welcome email — WIRED ✅
Fires once on first login, from `/auth/callback` (after `exchangeCodeForSession`):
if `profiles.welcomed_at IS NULL` → `sendWelcomeEmail` → set `welcomed_at`. Fully
defensive — a missing column, missing key, or send error is swallowed so login
**never** breaks; `welcomed_at` is set only after a successful send.

To activate end-to-end:
1. Apply `supabase/migrations/029_welcomed_at.sql` (nullable `welcomed_at` on `profiles`).
2. Set `RESEND_API_KEY` in `.env.local` + Vercel.

Until both are done, the welcome step safely no-ops (login works normally).

## Export data (UU PDP) — WIRED ✅
Not an email, but related: `GET /api/export-data` (RLS-scoped, paginated, all 26
user tables → JSON) + `<ExportDataButton/>` mounted in Profile → Data tab. Works
as-is once deployed; no extra setup.

## Reminders cron — SCAFFOLD (not scheduled)
`GET /api/cron/reminders` sends trial-ending + renewal reminders at H-14 / H-3 / H-0
(exact-date match, so a daily run fires each threshold once). **Inert until wired:**
1. Set `SUPABASE_SERVICE_ROLE_KEY` + `CRON_SECRET` in Vercel env.
2. Add a Vercel Cron in `vercel.json`:
   `{ "crons": [{ "path": "/api/cron/reminders", "schedule": "0 2 * * *" }] }`
Verify the trial/renewal assumptions (status values, `expires_at` semantics) against
your billing model before scheduling.

## Magic-link as a Supabase Auth template
1. `npm run email:export`, open `email-previews/magic-link.html`.
2. Replace the sample URL with Supabase's `{{ .ConfirmationURL }}` placeholder.
3. Supabase Dashboard → Authentication → Email Templates → Magic Link → paste the HTML.
4. Authentication → SMTP Settings → point to Resend: host `smtp.resend.com`, port `465`, user `resend`, password = `RESEND_API_KEY`, sender `noreply@klunting.com`.

## Privacy (UU PDP)
Keep email content minimal — name, plan, amount, masked transaction id only. **No account balances or sensitive financial detail** in emails: they pass through Resend (a third party).
