import type { Metadata } from 'next';
import Link from 'next/link';
import { CatalogExplorer } from '@/components/catalog-explorer';
import { getAllProducts } from '@/lib/catalog-api';

export const metadata: Metadata = { title: 'Catálogo', description: 'Explora todas las velas aromáticas, bouquets, recordatorios y diseños navideños de Celestial.', alternates: { canonical: '/catalogo' } };

export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const query = await searchParams;
  const catalog = await getAllProducts()
    .then((products) => ({ products, unavailable: false }))
    .catch(() => ({ products: [], unavailable: true }));
  if (catalog.unavailable) return <main className="catalog-page"><section className="page-hero compact"><p className="eyebrow"><span /> Catálogo Celestial</p><h1>Volvemos a encender<br /><em>el catálogo pronto.</em></h1><p>No pudimos consultar productos ni precios vigentes. Recarga la página en unos minutos.</p><Link className="button button-primary" href="/catalogo">Reintentar</Link></section></main>;
  const explorerKey = `${query.category ?? 'all'}:${catalog.products.length}:${Math.max(0, ...catalog.products.map((product) => product.priceCop))}`;
  return <main className="catalog-page"><section className="page-hero compact"><p className="eyebrow"><span /> Catálogo Celestial</p><h1>Elige la luz de<br /><em>tu próximo momento.</em></h1><p>Todos nuestros diseños, aromas y detalles reunidos en un solo lugar.</p></section><CatalogExplorer key={explorerKey} initialProducts={catalog.products} initialCategory={query.category} /></main>;
}
