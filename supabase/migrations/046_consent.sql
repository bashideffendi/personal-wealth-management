-- 046: Granular consent capture (UU PDP No. 27/2022).
-- Records explicit consent given at onboarding so we have an auditable trail of
-- when each user agreed and to which Privacy/Terms version. Nullable + additive,
-- so the app degrades gracefully before this runs (the onboarding write is
-- best-effort and won't block setup if these columns are missing).

alter table public.profiles add column if not exists consent_at timestamptz;
alter table public.profiles add column if not exists consent_version text;

comment on column public.profiles.consent_at is 'When the user gave consent to data processing (UU PDP).';
comment on column public.profiles.consent_version is 'Privacy/Terms version consented to, e.g. pdp-2026-06.';
