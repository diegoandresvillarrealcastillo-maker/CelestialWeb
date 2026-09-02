import type { Metadata } from 'next';
import { AccountPanel } from '@/components/account-panel';

export const metadata: Metadata = { title: 'Mi cuenta', description: 'Ingresa o crea tu cuenta Celestial.' };
export default function AccountPage() { return <main className="account-page"><div className="account-visual"><img src="/images/products/hero-general.webp" alt="Velas artesanales Celestial" /><blockquote>“Cada aroma guarda una memoria; cada llama abre un momento.”<span>Celestial</span></blockquote></div><AccountPanel /></main>; }
