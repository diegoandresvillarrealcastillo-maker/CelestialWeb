import type { MetadataRoute } from 'next';
import { products } from '@/data/catalog';
export default function sitemap(): MetadataRoute.Sitemap { const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'; return [{ url: base, changeFrequency: 'weekly', priority: 1 }, { url: `${base}/catalogo`, changeFrequency: 'weekly', priority: .9 }, ...products.map((product) => ({ url: `${base}/producto/${product.slug}`, changeFrequency: 'monthly' as const, priority: .7 }))]; }
