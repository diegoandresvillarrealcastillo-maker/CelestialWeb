import type { CatalogProduct, ProductCategory } from '@/data/catalog';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type ApiProductRow = {
  externalId: string;
  slug: string;
  name: string;
  description: string;
  priceCop: number;
  priceMaxCop: number | null;
  priceLabel: string | null;
  image: string;
  dimensions: string | null;
  weight: string | null;
  colors: string[];
  fragrances: string[];
  options: string[];
  features: string[];
  availability: string;
  collection: 'general' | 'navidad';
  featured: boolean;
  popular: boolean;
  referenceImage: boolean;
  categories: string[];
  images: { path: string; alt: string; order: number }[];
};

function mapProduct(row: ApiProductRow): CatalogProduct {
  const gallery = [...row.images].sort((a, b) => a.order - b.order).map((image) => image.path);
  return {
    id: row.externalId,
    slug: row.slug,
    name: row.name,
    category: (row.categories[0] ?? 'Velas aromáticas') as ProductCategory,
    collection: row.collection,
    description: row.description,
    priceCop: row.priceCop,
    priceMaxCop: row.priceMaxCop ?? undefined,
    priceLabel: row.priceLabel ?? undefined,
    image: row.image,
    images: gallery.length ? gallery : undefined,
    dimensions: row.dimensions ?? undefined,
    weight: row.weight ?? undefined,
    colors: row.colors?.length ? row.colors : undefined,
    fragrances: row.fragrances?.length ? row.fragrances : undefined,
    options: row.options?.length ? row.options : undefined,
    features: row.features ?? [],
    availability: row.availability,
    source: { catalog: row.collection, page: 1 },
    featured: row.featured,
    popular: row.popular,
    referenceImage: row.referenceImage,
  };
}

export async function getAllProducts(): Promise<CatalogProduct[]> {
  try {
    const response = await fetch(`${API_URL}/api/products?limit=100`, { next: { revalidate: 60 } });
    if (!response.ok) return [];
    const data = await response.json() as { products: ApiProductRow[] };
    return data.products.map(mapProduct);
  } catch {
    return [];
  }
}

export async function getProductBySlug(slug: string): Promise<CatalogProduct | null> {
  try {
    const response = await fetch(`${API_URL}/api/products/${encodeURIComponent(slug)}`, { next: { revalidate: 60 } });
    if (!response.ok) return null;
    const data = await response.json() as { product: ApiProductRow };
    return mapProduct(data.product);
  } catch {
    return null;
  }
}
