import type { Metadata } from 'next';
import { AccountPanel } from '@/components/account-panel';

export const metadata: Metadata = { title: 'Acceso administrativo', robots: { index: false, follow: false } };

export default function AdminAccessPage() {
  return <main className="account-page"><div className="account-visual"><img src="/images/products/hero-general.webp" alt="Velas artesanales Celestial" /><blockquote>“Área privada para la gestión de Celestial.”<span>Administración</span></blockquote></div><AccountPanel /></main>;
}
