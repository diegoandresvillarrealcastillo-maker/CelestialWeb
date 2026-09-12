'use client';

import Link from 'next/link';
import type { CatalogProduct } from '@/data/catalog';
import { formatCop } from '@/data/catalog';
import { useCart } from './cart-provider';

export function ProductCard({ product, index = 0 }: { product: CatalogProduct; index?: number }) {
  const { addItem } = useCart();
  const requiresSelection = Boolean(product.colors?.length || product.fragrances?.length || product.options?.length);
  return (
    <article className="product-card">
      <Link className="product-image" href={`/producto/${product.slug}`}>
        <img src={product.image} alt={product.name} loading={index > 3 ? 'lazy' : undefined} />
        <span className="product-index">{String(index + 1).padStart(2, '0')}</span>
        {product.popular && <span className="product-badge">Favorito</span>}
        {product.referenceImage && <span className="reference-badge">Imagen de referencia</span>}
      </Link>
      <div className="product-info">
        <p>{product.category}</p>
        <h3><Link href={`/producto/${product.slug}`}>{product.name}</Link></h3>
        <div>
          <span>{product.priceLabel ?? formatCop(product.priceCop)}</span>
          {requiresSelection
            ? <Link className="product-card-action" href={`/producto/${product.slug}`} aria-label={`Elegir opciones para ${product.name}`}>+</Link>
            : <button type="button" onClick={() => addItem({ id: product.id, slug: product.slug, name: product.name, image: product.image, priceCop: product.priceCop })} aria-label={`Agregar ${product.name} a la bolsa`}>+</button>}
        </div>
      </div>
    </article>
  );
}
