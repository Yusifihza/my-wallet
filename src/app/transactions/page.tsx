import type { Metadata } from 'next';
import { TransactionsView } from '@/components/TransactionsView';

export const metadata: Metadata = {
  title: 'Riwayat Transaksi — My Wallet',
};

export default function TransactionsPage() {
  return <TransactionsView />;
}
