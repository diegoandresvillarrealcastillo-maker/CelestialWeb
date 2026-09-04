'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatCop } from '@/data/catalog';
import { useCart } from './cart-provider';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type CreatedOrder = { id: string; orderNumber: string; totalCop: number };
type PaymentSettings = { bankKey: string | null; accountHolder: string | null; qrImageUrl: string | null; instructions: string | null };

export function CartView() {
  const { items, subtotalCop, removeItem, setQuantity, clear } = useCart();
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [receiptStatus, setReceiptStatus] = useState<'idle' | 'uploading' | 'done'>('idle');
  const [receiptMessage, setReceiptMessage] = useState('');

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
      const result = await response.json() as { order?: CreatedOrder; error?: { message?: string } };
      if (!response.ok || !result.order) throw new Error(result.error?.message ?? 'No fue posible crear el pedido.');
      clear();
      setCreatedOrder(result.order);
      const settingsResponse = await fetch(`${apiUrl}/api/payment-settings`);
      if (settingsResponse.ok) setPaymentSettings((await settingsResponse.json() as { settings: PaymentSettings | null }).settings);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible crear el pedido.');
    } finally { setSubmitting(false); }
  }

  async function uploadReceipt(formData: FormData) {
    if (!createdOrder) return;
    setReceiptStatus('uploading'); setReceiptMessage('');
    try {
      const file = formData.get('file') as File | null;
      if (!file || !file.size) throw new Error('Selecciona la imagen de tu comprobante.');
      const csrfResponse = await fetch(`${apiUrl}/api/auth/csrf`, { credentials: 'include' });
      const { csrfToken } = await csrfResponse.json() as { csrfToken: string };
      const body = new FormData();
      body.append('file', file);
      const response = await fetch(`${apiUrl}/api/orders/${createdOrder.id}/receipt`, {
        method: 'POST', credentials: 'include', headers: { 'x-csrf-token': csrfToken }, body,
      });
      const result = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message ?? 'No fue posible enviar el comprobante.');
      setReceiptStatus('done');
    } catch (error) {
      setReceiptStatus('idle');
      setReceiptMessage(error instanceof Error ? error.message : 'No fue posible enviar el comprobante.');
    }
  }

  if (createdOrder) {
    return (
      <div className="payment-step checkout-card">
        <p className="eyebrow"><span /> Pedido #{createdOrder.orderNumber}</p>
        <h1>Realiza tu transferencia</h1>
        <p className="detail-price">{formatCop(createdOrder.totalCop)}</p>
        {paymentSettings ? (
          <div className="payment-details">
            {paymentSettings.qrImageUrl && <img className="payment-qr" src={paymentSettings.qrImageUrl} alt="Código QR para transferencia" />}
            {paymentSettings.bankKey && <p><b>Llave / cuenta:</b> {paymentSettings.bankKey}</p>}
            {paymentSettings.accountHolder && <p><b>A nombre de:</b> {paymentSettings.accountHolder}</p>}
            {paymentSettings.instructions && <p>{paymentSettings.instructions}</p>}
          </div>
        ) : <p>Escríbenos por WhatsApp para recibir los datos de transferencia.</p>}
        {receiptStatus === 'done' ? (
          <p className="form-message" role="status">Comprobante recibido. Tu pago quedó <b>pendiente de verificación</b> — te avisaremos cuando lo confirmemos.</p>
        ) : (
          <form action={uploadReceipt}>
            <label>Adjuntar comprobante de pago<input name="file" type="file" accept="image/jpeg,image/png,image/webp" required /></label>
            <button className="button button-primary full" disabled={receiptStatus === 'uploading'}>{receiptStatus === 'uploading' ? 'Enviando…' : 'Adjuntar comprobante de pago'}</button>
          </form>
        )}
        {receiptMessage && <p className="form-message" role="status">{receiptMessage}</p>}
        <Link className="button button-quiet full" href="/cuenta">Ver mis pedidos</Link>
      </div>
    );
  }

  if (!items.length) return <div className="cart-empty"><span>✦</span><h1>Tu bolsa espera una chispa</h1><p>Explora aromas, formas y detalles creados a mano.</p><Link className="button button-primary" href="/catalogo">Ir al catálogo ↗</Link>{message && <p role="status">{message}</p>}</div>;

  return (
    <div className="cart-layout">
      <section className="cart-lines"><p className="eyebrow"><span /> Tu selección</p><h1>Bolsa de compra</h1>{items.map((item) => <article className="cart-line" key={item.id}><img src={item.image} alt="" /><div><p>Hecho bajo pedido</p><h2>{item.name}</h2>{item.selectedOptions && <small>{Object.values(item.selectedOptions).filter(Boolean).join(' · ')}</small>}<button onClick={() => removeItem(item.id)}>Eliminar</button></div><div className="quantity-control"><button onClick={() => setQuantity(item.id, item.quantity - 1)}>−</button><span>{item.quantity}</span><button onClick={() => setQuantity(item.id, item.quantity + 1)}>+</button></div><b>{formatCop(item.priceCop * item.quantity)}</b></article>)}</section>
      <aside className="checkout-card"><p className="eyebrow"><span /> Resumen</p><div className="summary-row"><span>Subtotal</span><b>{formatCop(subtotalCop)}</b></div><div className="summary-row"><span>Envío</span><b>Por confirmar</b></div><div className="summary-total"><span>Total parcial</span><b>{formatCop(subtotalCop)}</b></div><p>El total final se recalcula en el servidor con precios vigentes. El envío se confirma según ciudad y peso.</p><form action={submitOrder}><label>Nombre completo<input name="fullName" required minLength={2} maxLength={120} /></label><label>Teléfono<input name="phone" required minLength={7} maxLength={30} /></label><label>Dirección<input name="address" required minLength={5} maxLength={180} /></label><label>Ciudad<input name="city" required minLength={2} maxLength={100} /></label><label>Nota opcional<textarea name="customerNote" maxLength={500} /></label><button className="button button-primary full" disabled={submitting}>{submitting ? 'Confirmando…' : 'Confirmar pedido seguro'}</button></form>{message && <p className="form-message" role="status">{message} {message.includes('Inicia') && <Link href="/cuenta">Ir a mi cuenta</Link>}</p>}</aside>
    </div>
  );
}
