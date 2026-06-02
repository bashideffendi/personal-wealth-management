import {
  Utensils,
  Car,
  Receipt,
  ShoppingBag,
  Home,
  HeartPulse,
  GraduationCap,
  Shirt,
  Film,
  Repeat,
  Banknote,
  Briefcase,
  Gift,
  PiggyBank,
  ShieldCheck,
  Landmark,
  Target,
  LineChart,
  PieChart,
  Bitcoin,
  Coins,
  FileText,
  Plane,
  Tag,
  Coffee,
  Fuel,
  Wifi,
  Smartphone,
  Dumbbell,
  Gamepad2,
  ShoppingCart,
  Bus,
  type LucideIcon,
} from 'lucide-react'
import { rootCategory } from '@/lib/budget-categories'

// Map kategori (ID) -> icon. Yang nggak ke-map jatuh ke Tag (default).
const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  // Pengeluaran
  Makanan: Utensils,
  'Makan & Minum': Utensils,
  Transportasi: Car,
  Tagihan: Receipt,
  Belanja: ShoppingBag,
  'Belanja Online': ShoppingBag,
  'Tempat Tinggal': Home,
  Kesehatan: HeartPulse,
  Pendidikan: GraduationCap,
  'Pakaian & Aksesoris': Shirt,
  Pakaian: Shirt,
  Hiburan: Film,
  Langganan: Repeat,
  Liburan: Plane,
  Travel: Plane,
  // Pemasukan
  Gaji: Banknote,
  Pendapatan: Banknote,
  'Side Hustle / Freelance': Briefcase,
  Freelance: Briefcase,
  Bisnis: Briefcase,
  Bonus: Gift,
  THR: Gift,
  Hadiah: Gift,
  // Tabungan
  'Tabungan Umum': PiggyBank,
  Tabungan: PiggyBank,
  'Dana Darurat': ShieldCheck,
  'Tabungan Pensiun': Landmark,
  'Dana Pensiun': Landmark,
  'Sinking Fund': Target,
  // Investasi
  Saham: LineChart,
  'Reksa Dana': PieChart,
  Reksadana: PieChart,
  Cryptocurrency: Bitcoin,
  Crypto: Bitcoin,
  Emas: Coins,
  Obligasi: FileText,
}

/** Palet warna kategori — selaras token brand. Dipakai picker di Kelola Kategori. */
export const CATEGORY_COLORS = [
  '#10B981', // mint
  '#14B8A6', // teal
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#F43F5E', // coral
  '#F59E0B', // amber
  '#64748B', // slate
] as const

/** Pilihan ikon kustom (key stabil → komponen). Key disimpan di CatNode.icon. */
export const CATEGORY_ICON_CHOICES: { key: string; Icon: LucideIcon }[] = [
  { key: 'utensils', Icon: Utensils },
  { key: 'coffee', Icon: Coffee },
  { key: 'shopping-bag', Icon: ShoppingBag },
  { key: 'shopping-cart', Icon: ShoppingCart },
  { key: 'car', Icon: Car },
  { key: 'fuel', Icon: Fuel },
  { key: 'bus', Icon: Bus },
  { key: 'home', Icon: Home },
  { key: 'receipt', Icon: Receipt },
  { key: 'wifi', Icon: Wifi },
  { key: 'smartphone', Icon: Smartphone },
  { key: 'heart-pulse', Icon: HeartPulse },
  { key: 'dumbbell', Icon: Dumbbell },
  { key: 'graduation-cap', Icon: GraduationCap },
  { key: 'shirt', Icon: Shirt },
  { key: 'film', Icon: Film },
  { key: 'gamepad', Icon: Gamepad2 },
  { key: 'plane', Icon: Plane },
  { key: 'repeat', Icon: Repeat },
  { key: 'gift', Icon: Gift },
  { key: 'briefcase', Icon: Briefcase },
  { key: 'piggy-bank', Icon: PiggyBank },
  { key: 'landmark', Icon: Landmark },
  { key: 'line-chart', Icon: LineChart },
  { key: 'coins', Icon: Coins },
  { key: 'banknote', Icon: Banknote },
]

const ICON_BY_KEY: Record<string, LucideIcon> = Object.fromEntries(
  CATEGORY_ICON_CHOICES.map((c) => [c.key, c.Icon]),
)

/** Ikon final buat kategori: iconKey kustom menang → by-nama → induk → default. */
export function resolveCategoryIcon(category: string, iconKey?: string): LucideIcon {
  if (iconKey && ICON_BY_KEY[iconKey]) return ICON_BY_KEY[iconKey]
  return CATEGORY_ICON_MAP[category] ?? CATEGORY_ICON_MAP[rootCategory(category)] ?? Tag
}

export function CategoryIcon({
  category,
  iconKey,
  className,
}: {
  category: string
  iconKey?: string
  className?: string
}) {
  const Icon = resolveCategoryIcon(category, iconKey)
  return <Icon className={className} />
}
