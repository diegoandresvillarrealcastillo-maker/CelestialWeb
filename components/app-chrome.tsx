'use client';

import { usePathname } from 'next/navigation';
import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';
import { WhatsAppButton } from './whatsapp-button';

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const admin = pathname.startsWith('/admin');
  return <>{!admin && <SiteHeader />}{children}{!admin && <><SiteFooter /><WhatsAppButton /></>}</>;
}
