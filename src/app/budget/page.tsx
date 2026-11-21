import type { Metadata } from 'next';
import { BudgetView } from '@/components/BudgetView';

export const metadata: Metadata = {
  title: 'Budget Bulanan — My Wallet',
};

export default function BudgetPage() {
  return <BudgetView />;
}
