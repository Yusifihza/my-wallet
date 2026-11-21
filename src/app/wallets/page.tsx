import type { Metadata } from 'next';
import { WalletsView } from '@/components/WalletsView';

export const metadata: Metadata = {
  title: 'Dompet & Transfer — My Wallet',
};

export default function WalletsPage() {
  return <WalletsView />;
}
