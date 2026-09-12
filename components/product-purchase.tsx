'use client';

import { useMemo, useState } from 'react';
import type { CatalogProduct } from '@/data/catalog';
import { formatCop } from '@/data/catalog';
import { useCart } from './cart-provider';
import { whatsappUrl } from '@/lib/site-config';

export function ProductPurchase({ product }: { product: CatalogProduct }) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [added, setAdded] = useState(false);
  const [selectionError, setSelectionError] = useState('');
  const requiredKeys = [
    ...(product.colors?.length ? ['color'] : []),
    ...(product.fragrances?.length ? ['fragrance'] : []),
    ...(product.options?.length ? ['option'] : []),
  ];
  const selectionsComplete = requiredKeys.every((key) => Boolean(selectedOptions[key]));
  const selectedPrice = product.optionPrices?.[selectedOptions.option] ?? product.priceCop;
  const consultationOnly = Boolean(product.requiresConsultation || (product.priceMaxCop && product.priceMaxCop > product.priceCop && !product.optionPrices));

  const consultUrl = useMemo(() => {
    const options = Object.values(selectedOptions).filter(Boolean).join(', ');
    const text = `Hola, quiero consultar por ${product.name}${options ? ` (${options})` : ''}. Cantidad: ${quantity}.`;
    return whatsappUrl(text);
  }, [product.name, quantity, selectedOptions]);

  const select = (key: string, values?: string[]) => values?.length ? (
    <label className="option-field"><span>{key === 'color' ? 'Color' : key === 'fragrance' ? 'Aroma' : 'Diseño'}</span><select required value={selectedOptions[key] ?? ''} aria-invalid={Boolean(selectionError && !selectedOptions[key])} onChange={(event) => { setSelectedOptions((current) => ({ ...current, [key]: event.target.value })); setSelectionError(''); }}><option value="">Elige una opción</option>{values.map((value) => <option value={value} key={value}>{value}</option>)}</select></label>
  ) : null;

  return (
    <div className="purchase-panel">
      <p className="detail-category">{product.category} · {product.availability}</p>
      <h1>{product.name}</h1>
      <p className="detail-price">{selectedOptions.option && product.optionPrices?.[selectedOptions.option] ? formatCop(selectedPrice) : product.priceLabel ?? formatCop(product.priceCop)}</p>
      <p className="detail-description">{product.description}</p>
      <div className="option-grid">{select('color', product.colors)}{select('fragrance', product.fragrances)}{select('option', product.options)}</div>
      {consultationOnly ? <div className="quote-only"><p>Este diseño requiere confirmar variante, personalización y precio exacto antes de registrarlo como pedido.</p><a className="button button-primary full" href={consultUrl} target="_blank" rel="noreferrer">Solicitar cotización por WhatsApp ↗</a></div> : <div className="purchase-row">
        <div className="quantity-control" aria-label="Cantidad"><button onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Reducir cantidad">−</button><span>{quantity}</span><button onClick={() => setQuantity((value) => Math.min(99, value + 1))} aria-label="Aumentar cantidad">+</button></div>
        <button className="button button-primary grow" onClick={() => {
          if (!selectionsComplete) { setSelectionError('Elige todas las opciones antes de añadir el producto.'); return; }
          addItem({ id: product.id, slug: product.slug, name: product.name, image: product.image, priceCop: selectedPrice, selectedOptions }, quantity);
          setAdded(true);
        }}>{added ? 'Añadido a la bolsa ✓' : 'Añadir a la bolsa'}</button>
      </div>}
      {selectionError && <p className="form-message" role="alert">{selectionError}</p>}
      {!consultationOnly && <a className="button button-quiet full" href={consultUrl} target="_blank" rel="noreferrer">Consultar por WhatsApp ↗</a>}
      <p className="shipping-note"><span>✦</span> El envío se calcula según ciudad, peso y cantidad. La colección navideña tiene un tiempo estimado de 2 a 10 días hábiles.</p>
    </div>
  );
}
