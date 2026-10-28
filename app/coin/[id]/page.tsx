import type { Metadata } from 'next';
import { CoinView } from '@/components/views/Coin';

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: 'Coin' };

export default async function Page({ params }: Props) {
  const { id } = await params;
  return <CoinView id={id} />;
}
