-- 035_credit_card_network.sql
-- Jaringan kartu (Visa / Mastercard / GPN / JCB / Amex) — logonya muncul di
-- visual kartu. Beda dari `issuer` (bank penerbit).
--
-- Idempoten + nullable → aman di-apply/di-rerun, gak nyentuh data existing.
alter table public.credit_cards add column if not exists network text;
