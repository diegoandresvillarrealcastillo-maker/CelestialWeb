'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatCop } from '@/data/catalog';
import { useCart } from './cart-provider';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function CartView() {
  const { items, subtotalCop, removeItem, setQuantity, clear } = useCart();
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submitOrder(formData: FormData) {
    setSubmitting(true); setMessage('');
    try {
      const csrfResponse = await fetch(`${apiUrl}/api/auth/csrf`, { credentials: 'include' });
      if (csrfResponse.status === 401) { setMessage('Inicia sesión para confirmar el pedido.'); return; }
      const { csrfToken } = await csrfResponse.json() as { csrfToken: string };
      const response = await fetch(`${apiUrl}/api/orders`, {
        method: 'POST', credentials: 'include',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken, 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({
          items: items.map((item) => ({ productId: item.id, quantity: item.quantity, selectedOptions: item.selectedOptions ?? {} })),
          shippingAddress: {
            fullName: formData.get('fullName'), phone: formData.get('phone'), address: formData.get('address'), city: formData.get('city'),
          },
          customerNote: formData.get('customerNote') || undefined,
        }),
      });
      const result = await response.json() as { order?: { orderNumber: string }; error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message ?? 'No fue posible crear el pedido.');
      clear();
      setMessage(`Pedido #${result.order?.orderNumber ?? ''} creado. Te contactaremos para confirmar el envío.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible crear el pedido.');
    } finally { setSubmitting(false); }
  }

  if (!items.length) return <div className="cart-empty"><span>✦</span><h1>Tu bolsa espera una chispa</h1><p>Explora aromas, formas y detalles creados a mano.</p><Link className="button button-primary" href="/catalogo">Ir al catálogo ↗</Link>{message && <p role="status">{message}</p>}</div>;

  return (
    <div className="cart-layout">
      <section className="cart-lines"><p className="eyebrow"><span /> Tu selección</p><h1>Bolsa de compra</h1>{items.map((item) => <article className="cart-line" key={item.id}><img src={item.image} alt="" /><div><p>Hecho bajo pedido</p><h2>{item.name}</h2>{item.selectedOptions && <small>{Object.values(item.selectedOptions).filter(Boolean).join(' · ')}</small>}<button onClick={() => removeItem(item.id)}>Eliminar</button></div><div className="quantity-control"><button onClick={() => setQuantity(item.id, item.quantity - 1)}>−</button><span>{item.quantity}</span><button onClick={() => setQuantity(item.id, item.quantity + 1)}>+</button></div><b>{formatCop(item.priceCop * item.quantity)}</b></article>)}</section>
      <aside className="checkout-card"><p className="eyebrow"><span /> Resumen</p><div className="summary-row"><span>Subtotal</span><b>{formatCop(subtotalCop)}</b></div><div className="summary-row"><span>Envío</span><b>Por confirmar</b></div><div className="summary-total"><span>Total parcial</span><b>{formatCop(subtotalCop)}</b></div><p>El total final se recalcula en el servidor con precios vigentes. El envío se confirma según ciudad y peso.</p><form action={submitOrder}><label>Nombre completo<input name="fullName" required minLength={2} maxLength={120} /></label><label>Teléfono<input name="phone" required minLength={7} maxLength={30} /></label><label>Dirección<input name="address" required minLength={5} maxLength={180} /></label><label>Ciudad<input name="city" required minLength={2} maxLength={100} /></label><label>Nota opcional<textarea name="customerNote" maxLength={500} /></label><button className="button button-primary full" disabled={submitting}>{submitting ? 'Confirmando…' : 'Confirmar pedido seguro'}</button></form>{message && <p className="form-message" role="status">{message} {message.includes('Inicia') && <Link href="/cuenta">Ir a mi cuenta</Link>}</p>}</aside>
    </div>
  );
}
