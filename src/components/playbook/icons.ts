import { PiggyBank, CreditCard, Home, Plane, Sprout, Target, type LucideIcon } from 'lucide-react'

const MAP: Record<string, LucideIcon> = {
  'piggy-bank': PiggyBank,
  'credit-card': CreditCard,
  home: Home,
  plane: Plane,
  sprout: Sprout,
}

/** Resolve playbook iconKey → komponen lucide. Fallback ke Target. */
export function playbookIcon(key: string): LucideIcon {
  return MAP[key] ?? Target
}
