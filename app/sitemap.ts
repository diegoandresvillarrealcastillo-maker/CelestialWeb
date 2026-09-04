import type { MetadataRoute } from 'next';
import { getAllProducts } from '@/lib/catalog-api';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> { const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'; const products = await getAllProducts(); return [{ url: base, changeFrequency: 'weekly', priority: 1 }, { url: `${base}/catalogo`, changeFrequency: 'weekly', priority: .9 }, ...products.map((product) => ({ url: `${base}/producto/${product.slug}`, changeFrequency: 'monthly' as const, priority: .7 }))]; }
