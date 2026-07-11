// AUTO-GENERATED dari skema Supabase via PostgREST OpenAPI (47 tabel, 17 fungsi).
// Regenerate: node scripts/gen-supabase-types.mjs (baca {SUPABASE_URL}/rest/v1/ dgn service-role key).
// KEPUTUSAN SADAR: Row = tipe akurat + nullability (reads ketat — nangkep typo kolom di select/eq/order).
// Insert/Update = index-signature permisif: app membangun payload dinamis (conditional keys); typed writes
// akan false-error. Functions = Args longgar. Trade-off: keamanan tipe penuh di BACA, longgar di TULIS.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      "account_allocations": {
        Row: {
          "id": string
          "user_id": string
          "account_id": string
          "purpose_kind": string
          "emergency_fund_id": string | null
          "goal_id": string | null
          "custom_label": string
          "amount": number
          "notes": string
          "created_at": string
          "updated_at": string
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
      "accounts": {
        Row: {
          "id": string
          "user_id": string
          "name": string
          "type": string
          "starting_balance": number
          "current_balance": number
          "created_at": string
          "household_id": string | null
          "account_number": string | null
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
      "achievements": {
        Row: {
          "user_id": string
          "key": string
          "unlocked_at": string
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
      "ai_credit_ledger": {
        Row: {
          "id": string
          "user_id": string
          "delta": number
          "reason": string
          "metadata": Json | null
          "balance_after": number
          "created_at": string
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
      "assets_liquid": {
        Row: {
          "id": string
          "user_id": string
          "name": string
          "type": string
          "balance": number
          "month": number
          "year": number
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
      "assets_non_liquid": {
        Row: {
          "id": string
          "user_id": string
          "name": string
          "category": string
          "type": string
          "purchase_value": number
          "current_value": number
          "purchase_date": string | null
          "notes": string
          "latitude": number | null
          "longitude": number | null
          "address": string
          "details": Json | null
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
      "billing_events": {
        Row: {
          "id": string
          "provider": string
          "event_type": string | null
          "user_id": string | null
          "payload": Json | null
          "processed_at": string
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
      "budget_categories": {
        Row: {
          "user_id": string
          "type": string
          "tree": Json
          "updated_at": string
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
      "budgets": {
        Row: {
          "id": string
          "user_id": string
          "year": number
          "month": number
          "category": string
          "type": string
          "amount": number
          "household_id": string | null
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
      "categorization_rules": {
        Row: {
          "id": string
          "user_id": string
          "match_text": string
          "type": string
          "category": string
          "priority": number
          "is_active": boolean
          "created_at": string
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
      "contracts": {
        Row: {
          "id": string
          "user_id": string
          "name": string
          "category": string
          "provider": string
          "policy_number": string
          "start_date": string | null
          "end_date": string
          "cost": number | null
          "frequency": string | null
          "auto_renew": boolean
          "reminder_days_before": number
          "is_archived": boolean
          "notes": string
          "created_at": string
          "coverage": number
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
      "credit_card_payments": {
        Row: {
          "id": string
          "user_id": string
          "card_id": string
          "amount": number
          "from_account_id": string | null
          "date": string
          "notes": string
          "created_at": string
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
      "credit_cards": {
        Row: {
          "id": string
          "user_id": string
          "name": string
          "issuer": string
          "last_four": string
          "credit_limit": number
          "current_balance": number
          "billing_day": number
          "due_day": number
          "interest_rate": number
          "is_active": boolean
          "created_at": string
          "network": string | null
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
      "debt_payments": {
        Row: {
          "id": string
          "user_id": string
          "debt_id": string
          "amount": number
          "date": string
          "notes": string
          "created_at": string
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
      "debts": {
        Row: {
          "id": string
          "user_id": string
          "name": string
          "category": string
          "type": string
          "principal": number
          "remaining": number
          "interest_rate": number
          "monthly_payment": number
          "due_date": string | null
          "is_active": boolean
          "created_at": string
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
      "dividends": {
        Row: {
          "id": string
          "user_id": string
          "investment_id": string | null
          "ticker": string | null
          "amount": number
          "shares": number
          "ex_date": string | null
          "pay_date": string
          "notes": string
          "created_at": string
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
      "emergency_fund_locations": {
        Row: {
          "id": string
          "fund_id": string
          "account_name": string
          "amount": number
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
      "emergency_fund_transactions": {
        Row: {
          "id": string
          "fund_id": string
          "date": string
          "kind": string
          "amount": number
          "location": string
          "note": string
          "created_at": string
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
      "emergency_funds": {
        Row: {
          "id": string
          "user_id": string
          "job_stability": string
          "dependents": number
          "monthly_expenses": number
          "target_amount": number
          "current_amount": number
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
      "exchange_credentials": {
        Row: {
          "id": string
          "user_id": string
          "exchange": string
          "label": string
          "api_key_encrypted": string
          "api_secret_encrypted": string
          "can_read": boolean
          "can_trade": boolean
          "can_withdraw": boolean
          "scope": string
          "created_at": string
          "last_used_at": string | null
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
      "goals": {
        Row: {
          "id": string
          "user_id": string
          "name": string
          "category": string
          "target_amount": number
          "current_amount": number
          "deadline": string | null
          "notes": string
          "is_active": boolean
          "created_at": string
          "household_id": string | null
          "planned_monthly": number | null
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
      "household_activities": {
        Row: {
          "id": string
          "household_id": string
          "user_id": string
          "action": string
          "description": string | null
          "created_at": string
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
      "household_invitations": {
        Row: {
          "id": string
          "household_id": string
          "invited_by": string
          "email": string | null
          "token": string
          "status": string
          "expires_at": string
          "created_at": string
          "accepted_at": string | null
          "accepted_by": string | null
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
      "household_members": {
        Row: {
          "household_id": string
          "user_id": string
          "role": string
          "joined_at": string
          "can_edit": boolean
          "relationship": string | null
          "share_net_worth": boolean
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
      "households": {
        Row: {
          "id": string
          "name": string
          "owner_user_id": string
          "max_seats": number
          "created_at": string
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
      "investments": {
        Row: {
          "id": string
          "user_id": string
          "category": string
          "name": string
          "platform": string
          "quantity": number
          "avg_cost": number
          "current_price": number
          "total_value": number
          "type": string
          "ticker": string | null
          "currency": string
          "last_synced_at": string | null
          "notes": string
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
      "net_worth_snapshots": {
        Row: {
          "id": string
          "user_id": string
          "snapshot_date": string
          "total_assets": number
          "total_debts": number
          "net_worth": number
          "created_at": string
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
      "notifications": {
        Row: {
          "id": string
          "user_id": string
          "title": string
          "body": string | null
          "url": string | null
          "tag": string | null
          "created_at": string | null
          "read_at": string | null
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
      "plans": {
        Row: {
          "id": string
          "name": string
          "description": string
          "price_idr": number
          "original_price_idr": number | null
          "max_seats": number
          "features": Json
          "ai_credits_monthly": number
          "is_popular": boolean
          "display_order": number
          "created_at": string
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
      "portfolio_snapshots": {
        Row: {
          "id": string
          "user_id": string
          "snapshot_date": string
          "market_value": number
          "invested": number
          "created_at": string
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
      "price_history": {
        Row: {
          "ticker": string
          "date": string
          "close": number
          "interval": string
          "source": string
          "fetched_at": string
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
      "price_snapshots": {
        Row: {
          "ticker": string
          "price": number
          "currency": string
          "change_pct": number | null
          "market_state": string | null
          "fetched_at": string
          "source": string
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
      "profiles": {
        Row: {
          "id": string
          "full_name": string
          "currency": string
          "created_at": string
          "language": string
          "theme_accent": string
          "show_decimals": boolean
          "daily_reminder_enabled": boolean
          "daily_reminder_time": string
          "pin_hash": string | null
          "ai_credits": number
          "onboarding_completed": boolean
          "avatar_url": string | null
          "ai_credits_renewal_at": string
          "default_account_id": string | null
          "welcomed_at": string | null
          "onboarding_focus": string[] | null
          "ui_prefs": Json
          "consent_at": string | null
          "consent_version": string | null
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
      "push_subscriptions": {
        Row: {
          "id": string
          "user_id": string
          "endpoint": string
          "p256dh": string
          "auth": string
          "created_at": string | null
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
      "recurring_transactions": {
        Row: {
          "id": string
          "user_id": string
          "name": string
          "type": string
          "category": string
          "amount": number
          "account_id": string | null
          "frequency": string
          "day_of_period": number
          "start_date": string
          "end_date": string | null
          "last_run_date": string | null
          "is_active": boolean
          "notes": string
          "created_at": string
          "last_posted_date": string | null
          "auto_post": boolean
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
      "reminder_log": {
        Row: {
          "user_id": string
          "kind": string
          "threshold": number
          "sent_on": string
          "created_at": string
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
      "research_generation_claims": {
        Row: {
          "ticker": string
          "user_id": string | null
          "claimed_at": string
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
      "security_events": {
        Row: {
          "id": string
          "user_id": string
          "event": string
          "ip": string | null
          "user_agent": string | null
          "created_at": string
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
      "stock_research_cache": {
        Row: {
          "ticker": string
          "content": string
          "frontmatter": Json
          "generated_at": string
          "generated_by": string | null
          "model": string
          "input_tokens": number | null
          "output_tokens": number | null
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
      "stock_transactions": {
        Row: {
          "id": string
          "user_id": string
          "investment_id": string | null
          "ticker": string | null
          "side": string
          "shares": number
          "price": number
          "fee": number
          "total": number
          "broker": string
          "date": string
          "notes": string
          "created_at": string
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
      "strategy_runs": {
        Row: {
          "id": string
          "strategy_id": string
          "user_id": string
          "ran_at": string
          "signal": string
          "reason": string | null
          "order_id": number | null
          "order_status": string | null
          "executed_qty": number | null
          "executed_price": number | null
          "error": string | null
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
      "subscriptions": {
        Row: {
          "id": string
          "user_id": string
          "plan_id": string
          "status": string
          "started_at": string
          "expires_at": string | null
          "payment_provider": string | null
          "payment_reference": string | null
          "created_at": string
          "updated_at": string
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
      "trading_strategies": {
        Row: {
          "id": string
          "user_id": string
          "credential_id": string | null
          "name": string
          "type": string
          "symbol": string | null
          "interval": string | null
          "params": Json
          "active": boolean
          "last_run_at": string | null
          "last_signal": string | null
          "next_run_at": string | null
          "created_at": string
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
      "transactions": {
        Row: {
          "id": string
          "user_id": string
          "date": string
          "account_id": string | null
          "type": string
          "category": string
          "description": string
          "amount": number
          "created_at": string
          "goal_id": string | null
          "receipt_url": string | null
          "household_id": string | null
          "tags": string[]
          "split_group_id": string | null
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
      "transfers": {
        Row: {
          "id": string
          "user_id": string
          "from_account": string | null
          "to_account": string | null
          "amount": number
          "date": string
          "notes": string
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
      "watchlist": {
        Row: {
          "user_id": string
          "ticker": string
          "note": string | null
          "target_price": number | null
          "created_at": string
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
      "xp_events": {
        Row: {
          "id": string
          "user_id": string
          "source": string
          "amount": number
          "ref_id": string | null
          "created_at": string
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      "accept_household_invitation": { Args: Record<string, unknown>; Returns: unknown }
      "adjust_account_balance": { Args: Record<string, unknown>; Returns: unknown }
      "adjust_credit_card_balance": { Args: Record<string, unknown>; Returns: unknown }
      "adjust_debt_remaining": { Args: Record<string, unknown>; Returns: unknown }
      "ai_credit_status": { Args: Record<string, unknown>; Returns: unknown }
      "can_member_write": { Args: Record<string, unknown>; Returns: unknown }
      "category_usage": { Args: Record<string, unknown>; Returns: unknown }
      "consume_ai_credits": { Args: Record<string, unknown>; Returns: unknown }
      "current_household_id": { Args: Record<string, unknown>; Returns: unknown }
      "get_household_directory": { Args: Record<string, unknown>; Returns: unknown }
      "get_household_invitation": { Args: Record<string, unknown>; Returns: unknown }
      "get_household_net_worth": { Args: Record<string, unknown>; Returns: unknown }
      "get_my_xp": { Args: Record<string, unknown>; Returns: unknown }
      "is_household_member": { Args: Record<string, unknown>; Returns: unknown }
      "refund_ai_credits": { Args: Record<string, unknown>; Returns: unknown }
      "reset_ai_credits_if_due": { Args: Record<string, unknown>; Returns: unknown }
      "set_my_net_worth_sharing": { Args: Record<string, unknown>; Returns: unknown }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
