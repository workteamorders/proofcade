import type { Metadata } from 'next';
import { VerifyView } from '@/components/views/Verify';

export const metadata: Metadata = { title: 'Verification queue' };
export default function Page() { return <VerifyView />; }
