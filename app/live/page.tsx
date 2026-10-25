import type { Metadata } from 'next';
import { LiveView } from '@/components/views/Live';

export const metadata: Metadata = { title: 'Live callouts' };
export default function Page() { return <LiveView />; }
