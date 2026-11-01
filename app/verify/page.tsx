import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { VerifyView } from '@/components/views/Verify';
import { VERIFY_ON } from '@/lib/features';

export const metadata: Metadata = { title: 'Verification queue' };
export default function Page() {
  if (!VERIFY_ON) notFound();
  return <VerifyView />;
}
