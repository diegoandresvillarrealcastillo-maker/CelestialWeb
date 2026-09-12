'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { formatCop } from '@/data/catalog';
import { fetchWithTimeout, readJson } from '@/lib/client-http';
import { useCart } from './cart-provider';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type CreatedOrder = {
  id: string; orderNumber: string; subtotalCop: number; shippingCop: number; totalCop: number;
  status: string; paymentStatus: string; shippingConfirmed: boolean; guestToken: string; whatsappUrl: string;
};
type PaymentSettings = { bankKey: string | null; accountHolder: string | null; qrImageUrl: string | null; instructions: string | null };
const confirmationKey = 'celestial.checkout.confirmation';

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function CartView() {
  const { items, subtotalCop, removeItem, setQuantity, clear } = useCart();
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [paymentState, setPaymentState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [receiptStatus, setReceiptStatus] = useState<'idle' | 'uploading' | 'done'>('idle');
  const [receiptMessage, setReceiptMessage] = useState('');
  const [qrExpanded, setQrExpanded] = useState(false);
  const closeLightbox = useRef<HTMLButtonElement>(null);

  function persistConfirmation(order: CreatedOrder) {
    setCreatedOrder(order);
    sessionStorage.setItem(confirmationKey, JSON.stringify({ order, expiresAt: Date.now() + 24 * 60 * 60_000 }));
  }

  async function loadPaymentSettings() {
    setPaymentState('loading');
    try {
      const response = await fetchWithTimeout(`${apiUrl}/api/payment-settings`);
      if (!response.ok) throw new Error();
      setPaymentSettings((await readJson<{ settings: PaymentSettings | null }>(response)).settings ?? null);
      setPaymentState('ready');
    } catch {
      setPaymentState('error');
    }
  }

  useEffect(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem(confirmationKey) ?? 'null') as { order?: CreatedOrder; expiresAt?: number } | null;
      if (stored?.order && typeof stored.expiresAt === 'number' && stored.expiresAt > Date.now()
        && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(stored.order.id)
        && stored.order.guestToken?.length >= 32 && stored.order.guestToken.length <= 200
        && stored.order.whatsappUrl?.startsWith('https://wa.me/')) {
        queueMicrotask(() => {
          setCreatedOrder(stored.order!);
          if (stored.order!.shippingConfirmed) void loadPaymentSettings();
        });
      } else {
        sessionStorage.removeItem(confirmationKey);
      }
    } catch {
      sessionStorage.removeItem(confirmationKey);
    }
  }, []);

  useEffect(() => {
    if (!qrExpanded) return;
    closeLightbox.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setQrExpanded(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [qrExpanded]);

  async function idempotencyKey(payload: unknown) {
    // Persist only a digest, never the customer's contact or delivery data.
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(stableJson(payload)));
    const fingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    try {
      const stored = JSON.parse(sessionStorage.getItem('celestial.checkout.idempotency') ?? 'null') as { fingerprint?: string; key?: string } | null;
      if (stored?.fingerprint === fingerprint && stored.key) return stored.key;
    } catch {
      // A malformed browser value is replaced below.
    }
    const key = crypto.randomUUID();
    sessionStorage.setItem('celestial.checkout.idempotency', JSON.stringify({ fingerprint, key }));
    return key;
  }

  async function submitOrder(formData: FormData) {
    setSubmitting(true); setMessage('');
    try {
      const payload = {
        items: items.map((item) => ({ productId: item.id, quantity: item.quantity, selectedOptions: item.selectedOptions ?? {} })),
        shippingAddress: {
          fullName: formData.get('fullName'), phone: formData.get('phone'), address: formData.get('address'), city: formData.get('city'),
        },
        customerNote: formData.get('customerNote') || undefined,
        guestEmail: formData.get('guestEmail'),
        privacyAccepted: formData.get('privacyAccepted') === 'yes',
      };
      const response = await fetchWithTimeout(`${apiUrl}/api/orders`, {
        method: 'POST', credentials: 'omit',
        headers: {
          'content-type': 'application/json', 'idempotency-key': await idempotencyKey(payload),
        },
        body: JSON.stringify(payload),
      });
      const result = await readJson<{ order?: CreatedOrder; error?: { message?: string } }>(response);
      if (!response.ok || !result.order) throw new Error(result.error?.message ?? 'No fue posible crear el pedido.');
      clear();
      sessionStorage.removeItem('celestial.checkout.idempotency');
      persistConfirmation(result.order);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible crear el pedido.');
    } finally { setSubmitting(false); }
  }

  async function refreshOrder() {
    if (!createdOrder) return;
    setReceiptMessage('Consultando el total actualizado…');
    try {
      const response = await fetchWithTimeout(`${apiUrl}/api/orders/${createdOrder.id}/guest`, {
        credentials: 'omit', headers: { 'x-order-token': createdOrder.guestToken },
      });
      const result = await readJson<{ order?: Partial<CreatedOrder>; error?: { message?: string } }>(response);
      if (!response.ok || !result.order) throw new Error(result.error?.message ?? 'No fue posible actualizar el pedido.');
      const updated = { ...createdOrder, ...result.order };
      persistConfirmation(updated);
      setReceiptMessage(updated.shippingConfirmed ? 'El total final ya fue confirmado.' : 'El envío todavía está por confirmar.');
      if (updated.shippingConfirmed) void loadPaymentSettings();
    } catch (error) {
      setReceiptMessage(error instanceof Error ? error.message : 'No fue posible actualizar el pedido.');
    }
  }

  async function uploadReceipt(formData: FormData) {
    if (!createdOrder) return;
    setReceiptStatus('uploading'); setReceiptMessage('');
    try {
      const file = formData.get('file') as File | null;
      if (!file || !file.size) throw new Error('Selecciona la imagen de tu comprobante.');
      const body = new FormData();
      body.append('file', file);
      const response = await fetchWithTimeout(`${apiUrl}/api/orders/${createdOrder.id}/receipt`, {
        method: 'POST', credentials: 'omit',
        headers: {
          'x-order-token': createdOrder.guestToken,
        },
        body,
      });
      const result = await readJson<{ error?: { message?: string } }>(response);
      if (!response.ok) throw new Error(result.error?.message ?? 'No fue posible enviar el comprobante.');
      setReceiptStatus('done');
      persistConfirmation({ ...createdOrder, paymentStatus: 'pending_verification' });
    } catch (error) {
      setReceiptStatus('idle');
      setReceiptMessage(error instanceof Error ? error.message : 'No fue posible enviar el comprobante.');
    }
  }

  if (createdOrder) {
    return (
      <div className="payment-step checkout-card">
        <p className="eyebrow"><span /> Pedido #{createdOrder.orderNumber}</p>
        <h1>{createdOrder.shippingConfirmed ? 'Total confirmado' : 'Pedido recibido'}</h1>
        <p className="detail-price">{formatCop(createdOrder.totalCop)}</p>
        <a className="button button-primary full" href={createdOrder.whatsappUrl} target="_blank" rel="noreferrer">Enviar pedido por WhatsApp ↗</a>
        {!createdOrder.shippingConfirmed ? <div className="shipping-pending" role="status"><b>No realices la transferencia todavía.</b><p>Primero enviaremos este pedido por WhatsApp para confirmar el valor del envío y el total final.</p><button type="button" className="button button-quiet full" onClick={() => void refreshOrder()}>Actualizar total confirmado</button></div> : <>
        <div className="summary-row"><span>Productos</span><b>{formatCop(createdOrder.subtotalCop)}</b></div>
        <div className="summary-row"><span>Envío confirmado</span><b>{formatCop(createdOrder.shippingCop)}</b></div>
        {paymentState === 'loading' && <p role="status">Cargando datos de pago…</p>}
        {paymentState === 'error' && <p className="form-message" role="alert">No pudimos cargar los datos de transferencia. Consúltalos por WhatsApp antes de pagar.</p>}
        {paymentState === 'ready' && paymentSettings ? (
          <div className="payment-details">
            {paymentSettings.qrImageUrl && (
              <button type="button" className="payment-qr-trigger" onClick={() => setQrExpanded(true)} aria-label="Ampliar código QR">
                <img className="payment-qr" src={paymentSettings.qrImageUrl} alt="Código QR para transferencia" />
                <span className="payment-qr-hint">Toca para ampliar</span>
              </button>
            )}
            {paymentSettings.bankKey && <p><b>Llave / cuenta:</b> {paymentSettings.bankKey}</p>}
            {paymentSettings.accountHolder && <p><b>A nombre de:</b> {paymentSettings.accountHolder}</p>}
            {paymentSettings.instructions && <p>{paymentSettings.instructions}</p>}
          </div>
        ) : paymentState === 'ready' ? <p>Los datos de transferencia aún no están configurados. Solicítalos por WhatsApp.</p> : null}
        {qrExpanded && paymentSettings?.qrImageUrl && (
          <div className="lightbox-overlay" role="dialog" aria-modal="true" aria-label="Código QR para transferencia" onClick={(event) => { if (event.target === event.currentTarget) setQrExpanded(false); }}>
            <img className="lightbox-image" src={paymentSettings.qrImageUrl} alt="Código QR para transferencia ampliado" />
            <button ref={closeLightbox} type="button" className="lightbox-close" onClick={() => setQrExpanded(false)} aria-label="Cerrar imagen ampliada">✕</button>
          </div>
        )}
        {receiptStatus === 'done' || createdOrder.paymentStatus === 'pending_verification' ? (
          <p className="form-message" role="status">Comprobante recibido. Tu pago quedó <b>pendiente de verificación</b> — te avisaremos cuando lo confirmemos.</p>
        ) : createdOrder.paymentStatus === 'verified' ? (
          <p className="form-message" role="status">Pago verificado. Prepararemos tu pedido.</p>
        ) : (
          <form onSubmit={(event) => { event.preventDefault(); void uploadReceipt(new FormData(event.currentTarget)); }}>
            <label>Adjuntar comprobante de pago<input name="file" type="file" accept="image/jpeg,image/png,image/webp" required /></label>
            <button className="button button-primary full" disabled={receiptStatus === 'uploading'}>{receiptStatus === 'uploading' ? 'Enviando…' : 'Adjuntar comprobante de pago'}</button>
          </form>
        )}
        </>}
        {receiptMessage && <p className="form-message" role="status">{receiptMessage}</p>}
        <Link className="text-link confirmation-finish" href="/catalogo" onClick={() => { sessionStorage.removeItem(confirmationKey); setCreatedOrder(null); }}>Finalizar y volver al catálogo</Link>
      </div>
    );
  }

  if (!items.length) return <div className="cart-empty"><span>✦</span><h1>Tu bolsa espera una chispa</h1><p>Explora aromas, formas y detalles creados a mano.</p><Link className="button button-primary" href="/catalogo">Ir al catálogo ↗</Link>{message && <p role="status">{message}</p>}</div>;

  return (
    <div className="cart-layout">
      <section className="cart-lines"><p className="eyebrow"><span /> Tu selección</p><h1>Bolsa de compra</h1>{items.map((item) => <article className="cart-line" key={`${item.id}-${stableJson(item.selectedOptions ?? {})}`}><img src={item.image} alt="" /><div><p>Hecho bajo pedido</p><h2>{item.name}</h2>{item.selectedOptions && <small>{Object.values(item.selectedOptions).filter(Boolean).join(' · ')}</small>}<button className="cart-remove" type="button" aria-label={`Eliminar ${item.name} de la bolsa`} onClick={() => removeItem(item.id, item.selectedOptions)}>Eliminar</button></div><div className="quantity-control" aria-label={`Cantidad de ${item.name}`}><button type="button" aria-label={`Reducir cantidad de ${item.name}`} onClick={() => setQuantity(item.id, item.quantity - 1, item.selectedOptions)}>−</button><span>{item.quantity}</span><button type="button" aria-label={`Aumentar cantidad de ${item.name}`} onClick={() => setQuantity(item.id, item.quantity + 1, item.selectedOptions)}>+</button></div><b>{formatCop(item.priceCop * item.quantity)}</b></article>)}</section>
      <aside className="checkout-card"><p className="eyebrow"><span /> Resumen</p><div className="summary-row"><span>Subtotal</span><b>{formatCop(subtotalCop)}</b></div><div className="summary-row"><span>Envío</span><b>Por confirmar</b></div><div className="summary-total"><span>Total parcial</span><b>{formatCop(subtotalCop)}</b></div><p>El total final se recalcula en el servidor con precios vigentes. El envío se confirma según ciudad y peso.</p><form onSubmit={(event) => { event.preventDefault(); void submitOrder(new FormData(event.currentTarget)); }}><label>Correo electrónico<input name="guestEmail" type="email" required maxLength={254} /></label><label>Nombre completo<input name="fullName" required minLength={2} maxLength={120} /></label><label>Teléfono<input name="phone" required minLength={7} maxLength={30} /></label><label>Dirección<input name="address" required minLength={5} maxLength={180} /></label><label>Ciudad<input name="city" required minLength={2} maxLength={100} /></label><label>Nota opcional<textarea name="customerNote" maxLength={500} /></label><label className="privacy-consent"><input name="privacyAccepted" type="checkbox" value="yes" required /><span>Autorizo de forma previa, expresa e informada el tratamiento de estos datos para gestionar mi pedido, según la <Link href="/politica-de-privacidad" target="_blank">política de privacidad</Link>.</span></label><button className="button button-primary full" disabled={submitting}>{submitting ? 'Confirmando…' : 'Confirmar pedido seguro'}</button><p className="guest-note">No necesitas crear una cuenta. Guardamos únicamente los datos necesarios para preparar y entregar este pedido.</p></form>{message && <p className="form-message" role="status">{message}</p>}</aside>
    </div>
  );
}
