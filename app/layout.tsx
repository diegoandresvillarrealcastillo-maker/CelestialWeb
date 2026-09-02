import type { Metadata } from 'next';
import { AppChrome } from '@/components/app-chrome';
import { CartProvider } from '@/components/cart-provider';
import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'Celestial Velas | Velas artesanales en Colombia', template: '%s | Celestial Velas' },
  description: 'Celestial Velas crea velas artesanales en cera vegetal, bouquets y recordatorios personalizados hechos en Colombia.',
  keywords: ['Celestial Velas', 'Velas Celestial', 'velas artesanales', 'velas aromáticas', 'bouquets de velas', 'recordatorios personalizados', 'Colombia'],
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Celestial Velas | Velas artesanales en Colombia',
    description: 'Luz, aroma y arte hechos con intención por Celestial Velas.',
    type: 'website', locale: 'es_CO', siteName: 'Celestial Velas Artesanales',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Celestial, velas artesanales' }],
  },
  twitter: { card: 'summary_large_image', title: 'Celestial Velas | Velas artesanales en Colombia', description: 'Luz, aroma y arte hechos con intención por Celestial Velas.', images: ['/og.png'] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body><CartProvider><AppChrome>{children}</AppChrome></CartProvider></body>
    </html>
  );
}
