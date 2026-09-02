import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProductCard } from '@/components/product-card';
import { ProductPurchase } from '@/components/product-purchase';
import { products } from '@/data/catalog';

export const dynamicParams = false;
export function generateStaticParams() { return products.map((product) => ({ slug: product.slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = products.find((item) => item.slug === slug);
  if (!product) return { title: 'Producto no encontrado', openGraph: { images: [] }, twitter: { images: [] } };
  return {
    title: product.name,
    description: product.description,
    openGraph: { title: product.name, description: product.description, type: 'website', images: [{ url: product.image, alt: product.name }] },
    twitter: { card: 'summary_large_image', title: product.name, description: product.description, images: [product.image] },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = products.find((item) => item.slug === slug);
  if (!product) notFound();
  const related = products.filter((item) => item.id !== product.id && (item.category === product.category || item.collection === product.collection)).slice(0, 4);
  const gallery = product.images ?? [product.image];
  const structuredData = { '@context': 'https://schema.org', '@type': 'Product', name: product.name, description: product.description, image: gallery, offers: { '@type': 'Offer', priceCurrency: 'COP', price: product.priceCop, availability: 'https://schema.org/PreOrder' }, brand: { '@type': 'Brand', name: 'Celestial' } };
  return <main className="product-page"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }} /><nav className="breadcrumbs" aria-label="Migas de pan"><Link href="/">Inicio</Link><span>/</span><Link href="/catalogo">Catálogo</Link><span>/</span><b>{product.name}</b></nav><section className="product-detail"><div className={`product-gallery ${gallery.length > 1 ? 'multi' : ''}`}>{gallery.map((path, index) => <img src={path} alt={index ? `${product.name}, vista ${index + 1}` : product.name} key={path} />)}{product.referenceImage && <span>Imagen de referencia del catálogo</span>}</div><ProductPurchase product={product} /></section><section className="product-story"><div><p className="eyebrow"><span /> Detalles</p><h2>Creada para sentirse<br />tan especial como se ve.</h2></div><div><dl>{product.dimensions && <><dt>Medidas</dt><dd>{product.dimensions}</dd></>}{product.weight && <><dt>Peso</dt><dd>{product.weight}</dd></>}<dt>Disponibilidad</dt><dd>{product.availability}</dd><dt>Origen</dt><dd>Hecho a mano en Colombia</dd></dl><ul>{product.features.map((feature) => <li key={feature}>✦ {feature}</li>)}</ul></div></section><section className="related-section"><div className="section-heading"><div><p className="eyebrow"><span /> También puede gustarte</p><h2>Continúa explorando</h2></div><Link href="/catalogo">Ver todo <span>→</span></Link></div><div className="product-grid">{related.map((item, index) => <ProductCard product={item} index={index} key={item.id} />)}</div></section></main>;
}
