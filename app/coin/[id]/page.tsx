import type { Metadata } from 'next';
import { CoinView } from '@/components/views/Coin';
import { INITIAL_COINS } from '@/lib/data';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const c = INITIAL_COINS.find((x) => x.id === id);
  return { title: c ? `$${c.ticker}` : 'Coin' };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  return <CoinView id={id} />;
}
