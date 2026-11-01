import type { Metadata } from 'next';
import { RisksView } from '@/components/views/Risks';

export const metadata: Metadata = { title: 'Risks and terms' };
export default function Page() { return <RisksView />; }
