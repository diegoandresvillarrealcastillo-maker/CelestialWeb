import type { Metadata } from 'next';
import { VerifyEmail } from '@/components/token-flow';
export const metadata: Metadata = { title: 'Verificar correo', robots: { index: false, follow: false } };
export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) { const { token } = await searchParams; return <VerifyEmail token={token} />; }
