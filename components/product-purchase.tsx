'use client';

import { useMemo, useState } from 'react';
import type { CatalogProduct } from '@/data/catalog';
import { formatCop } from '@/data/catalog';
import { useCart } from './cart-provider';

export function ProductPurchase({ product }: { product: CatalogProduct }) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [added, setAdded] = useState(false);

  const consultUrl = useMemo(() => {
    const options = Object.values(selectedOptions).filter(Boolean).join(', ');
    const text = `Hola, quiero consultar por ${product.name}${options ? ` (${options})` : ''}. Cantidad: ${quantity}.`;
    return `https://wa.me/573205279249?text=${encodeURIComponent(text)}`;
  }, [product.name, quantity, selectedOptions]);

  const select = (key: string, values?: string[]) => values?.length ? (
    <label className="option-field"><span>{key === 'color' ? 'Color' : key === 'fragrance' ? 'Aroma' : 'Diseño'}</span><select value={selectedOptions[key] ?? ''} onChange={(event) => setSelectedOptions((current) => ({ ...current, [key]: event.target.value }))}><option value="">Elige una opción</option>{values.map((value) => <option value={value} key={value}>{value}</option>)}</select></label>
  ) : null;

  return (
    <div className="purchase-panel">
      <p className="detail-category">{product.category} · {product.availability}</p>
      <h1>{product.name}</h1>
      <p className="detail-price">{product.priceLabel ?? formatCop(product.priceCop)}</p>
      <p className="detail-description">{product.description}</p>
      <div className="option-grid">{select('color', product.colors)}{select('fragrance', product.fragrances)}{select('option', product.options)}</div>
      <div className="purchase-row">
        <div className="quantity-control" aria-label="Cantidad"><button onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Reducir cantidad">−</button><span>{quantity}</span><button onClick={() => setQuantity((value) => Math.min(99, value + 1))} aria-label="Aumentar cantidad">+</button></div>
        <button className="button button-primary grow" onClick={() => { addItem({ id: product.id, slug: product.slug, name: product.name, image: product.image, priceCop: product.priceCop, selectedOptions }, quantity); setAdded(true); }}>{added ? 'Añadido a la bolsa ✓' : 'Añadir a la bolsa'}</button>
      </div>
      <a className="button button-quiet full" href={consultUrl} target="_blank" rel="noreferrer">Consultar por WhatsApp ↗</a>
      <p className="shipping-note"><span>✦</span> El envío se calcula según ciudad, peso y cantidad. La colección navideña tiene un tiempo estimado de 2 a 10 días hábiles.</p>
    </div>
  );
}
