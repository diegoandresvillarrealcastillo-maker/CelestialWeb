import type { Metadata } from 'next';
import { ResetPassword } from '@/components/token-flow';
export const metadata: Metadata = { title: 'Restablecer contraseña', robots: { index: false, follow: false } };
export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) { const { token } = await searchParams; return <ResetPassword token={token} />; }
