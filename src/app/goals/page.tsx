import type { Metadata } from 'next';
import { GoalsView } from '@/components/GoalsView';

export const metadata: Metadata = {
  title: 'Target Tabungan — My Wallet',
};

export default function GoalsPage() {
  return <GoalsView />;
}
