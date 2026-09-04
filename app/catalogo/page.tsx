import type { Metadata } from 'next';
import { CatalogExplorer } from '@/components/catalog-explorer';
import { getAllProducts } from '@/lib/catalog-api';

export const metadata: Metadata = { title: 'Catálogo', description: 'Explora todas las velas aromáticas, bouquets, recordatorios y diseños navideños de Celestial.' };

export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ collection?: string; category?: string }> }) {
  const [query, products] = await Promise.all([searchParams, getAllProducts()]);
  return <main className="catalog-page"><section className="page-hero compact"><p className="eyebrow"><span /> Catálogo Celestial</p><h1>Elige la luz de<br /><em>tu próximo momento.</em></h1><p>Todos nuestros diseños, aromas y detalles reunidos en un solo lugar.</p></section><CatalogExplorer initialProducts={products} initialCollection={query.collection} initialCategory={query.category} /></main>;
}
