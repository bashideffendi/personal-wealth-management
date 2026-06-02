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

export function CategoryIcon({ category, className }: { category: string; className?: string }) {
  // Coba exact dulu, lalu induknya ("Langganan › Netflix" → "Langganan"), baru default.
  const Icon = CATEGORY_ICON_MAP[category] ?? CATEGORY_ICON_MAP[rootCategory(category)] ?? Tag
  return <Icon className={className} />
}
