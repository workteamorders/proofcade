import type { Metadata } from 'next';
import { ArcadeView } from '@/components/views/Arcade';

export const metadata: Metadata = { title: 'Arcade' };
export default function Page() { return <ArcadeView />; }
