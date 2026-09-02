import type { Metadata } from 'next';
import { CartView } from '@/components/cart-view';

export const metadata: Metadata = { title: 'Tu bolsa', description: 'Revisa tu selección y crea tu pedido Celestial.' };
export default function CartPage() { return <main className="subpage"><CartView /></main>; }
