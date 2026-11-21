'use client';

import {
  Banknote,
  BookOpen,
  CalendarClock,
  Car,
  CreditCard,
  Gamepad2,
  Gift,
  Handshake,
  Heart,
  HeartPulse,
  Home,
  Landmark,
  Package,
  PiggyBank,
  Receipt,
  Shield,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Tag,
  Target,
  TrendingUp,
  Utensils,
  Wallet,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  banknote: Banknote,
  'book-open': BookOpen,
  'calendar-clock': CalendarClock,
  car: Car,
  'credit-card': CreditCard,
  'gamepad-2': Gamepad2,
  gift: Gift,
  handshake: Handshake,
  heart: Heart,
  'heart-pulse': HeartPulse,
  home: Home,
  landmark: Landmark,
  package: Package,
  'piggy-bank': PiggyBank,
  receipt: Receipt,
  shield: Shield,
  'shopping-bag': ShoppingBag,
  smartphone: Smartphone,
  sparkles: Sparkles,
  tag: Tag,
  target: Target,
  'trending-up': TrendingUp,
  utensils: Utensils,
  wallet: Wallet,
};

interface CategoryIconProps extends LucideProps {
  name: string;
}

export function DynamicIcon({ name, ...props }: CategoryIconProps) {
  const Icon = ICON_MAP[name] ?? Tag;
  return <Icon {...props} />;
}
