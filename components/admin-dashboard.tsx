'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { formatCop } from '@/data/catalog';
import { fetchWithTimeout, readJson } from '@/lib/client-http';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
type Tab = 'overview' | 'products' | 'orders' | 'categories' | 'promotions' | 'payment-settings';
type Product = {
  id: string; slug: string; name: string; description: string; priceCop: number;
  priceMaxCop?: number | null; priceLabel?: string | null; image: string;
  dimensions?: string | null; weight?: string | null; availability: string;
  colors: string[]; fragrances: string[]; options: string[]; optionPrices: Record<string, number>; features: string[];
  collection: 'general' | 'navidad'; featured: boolean; popular: boolean;
  active: boolean; requiresConsultation: boolean; categories: string[];
};
type Order = {
  id: string; orderNumber: string; status: string; paymentStatus: string; receiptUrl: string | null;
  subtotalCop: number; shippingCop: number; shippingConfirmed: boolean; totalCop: number;
  email: string; customerName?: string; isGuest: boolean; createdAt: string;
  shippingAddress: { fullName: string; phone: string; address: string; city: string; notes?: string };
  customerNote?: string | null;
  items: Array<{ productName: string; quantity: number; unitPriceCop: number; lineTotalCop: number; selectedOptions: Record<string, string> }>;
};
type PaymentSettings = { bankKey: string | null; accountHolder: string | null; qrImageUrl: string | null; instructions: string | null };

const paymentStatusLabel: Record<string, string> = {
  pending: 'Pendiente de pago', pending_verification: 'Pago pendiente de verificación',
  verified: 'Pago verificado', rejected: 'Pago rechazado',
};
type OrderView = 'verify' | 'shipping' | 'completed' | 'cancelled';
const orderViewLabel: Record<OrderView, string> = {
  verify: 'Por verificar', shipping: 'Pendientes de envío', completed: 'Completados', cancelled: 'Cancelados',
};
function orderBucket(order: Order): OrderView {
  if (order.status === 'cancelled') return 'cancelled';
  if (order.status === 'completed') return 'completed';
  if (order.paymentStatus === 'verified') return 'shipping';
  return 'verify';
}
const orderTransitions: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'], confirmed: ['preparing', 'cancelled'],
  preparing: ['shipped', 'cancelled'], shipped: ['completed', 'cancelled'], completed: [], cancelled: [],
};
class AdminSessionError extends Error {}
type Category = { id: string; slug: string; name: string; description?: string | null; active: boolean; sortOrder: number };
type Promotion = { id: string; name: string; code?: string | null; kind: 'percentage' | 'fixed' | 'bundle'; configuration: Record<string, string | number | boolean>; active: boolean };
type Overview = { activeProducts: number; pendingOrders: number; pendingPaymentVerification: number; ordersToday: number; confirmedRevenueCop: number };

export function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('overview');
  const [csrf, setCsrf] = useState('');
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [message, setMessage] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [orderView, setOrderView] = useState<OrderView>('verify');
  const [newOrders, setNewOrders] = useState(0);
  const [busyAction, setBusyAction] = useState('');
  const lastOrderNumber = useRef(0);

  useEffect(() => {
    if (!authorized) return;
    let cancelled = false;
    let timer = 0;
    const check = async () => {
      try {
        if (document.visibilityState !== 'visible') return;
        const response = await fetchWithTimeout(`${apiUrl}/api/admin/orders/notifications?after=${lastOrderNumber.current}`, { credentials: 'include' });
        if ([401, 403].includes(response.status)) {
          setAuthorized(false); setOrders([]); setProducts([]); setCategories([]); setPromotions([]); setOverview(null); setPaymentSettings(null);
          setMessage('La sesión administrativa venció. Ingresa de nuevo.');
          return;
        }
        if (!response.ok) return;
        const data = await readJson<{ orders: Array<{ orderNumber: string }> }>(response);
        const notifications = data.orders ?? [];
        if (!notifications.length) return;
        lastOrderNumber.current = Math.max(lastOrderNumber.current, ...notifications.map((order) => Number(order.orderNumber)));
        setNewOrders((count) => count + notifications.length);
        setMessage(`${notifications.length === 1 ? 'Nuevo pedido recibido' : `${notifications.length} pedidos nuevos recibidos`}.`);
        const [orderResponse, overviewResponse] = await Promise.all([
          fetchWithTimeout(`${apiUrl}/api/admin/orders`, { credentials: 'include' }),
          fetchWithTimeout(`${apiUrl}/api/admin/overview`, { credentials: 'include' }),
        ]);
        if (orderResponse.ok) setOrders((await readJson<{ orders: Order[] }>(orderResponse)).orders ?? []);
        if (overviewResponse.ok) setOverview((await readJson<{ overview: Overview }>(overviewResponse)).overview ?? null);
      } catch {
        // The next poll retries without disrupting the active panel.
      } finally {
        if (!cancelled) timer = window.setTimeout(() => void check(), 30_000);
      }
    };
    timer = window.setTimeout(() => void check(), 30_000);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [authorized]);

  async function load() {
    let sessionValidated = false;
    try {
      const options = { credentials: 'include' as const };
      const read = async <T,>(url: string, init: RequestInit = {}) => {
        const response = await fetchWithTimeout(url, { ...options, ...init });
        if ([401, 403].includes(response.status)) throw new AdminSessionError('La sesión administrativa venció.');
        if (!response.ok) throw new Error('No fue posible cargar la administración.');
        const result = await readJson<T>(response);
        if (!Object.keys(result).length) throw new Error('La administración recibió una respuesta no válida.');
        return result as T;
      };
      const me = await fetchWithTimeout(`${apiUrl}/api/auth/me`, options);
      if (!me.ok) { setAuthorized(false); return; }
      const user = await readJson<{ user: { roles: string[] } }>(me);
      if (!user.user?.roles.includes('admin')) { setAuthorized(false); return; }
      sessionValidated = true;
      setAuthorized(true);
      const csrfResponse = await read<{ csrfToken: string }>(`${apiUrl}/api/auth/csrf`, { method: 'POST' });
      setCsrf(csrfResponse.csrfToken);
      const [stats, productData, orderData, categoryData, promotionData, paymentSettingsData] = await Promise.all([
        read<{ overview: Overview }>(`${apiUrl}/api/admin/overview`),
        read<{ products: Product[] }>(`${apiUrl}/api/admin/products`),
        read<{ orders: Order[] }>(`${apiUrl}/api/admin/orders`),
        read<{ categories: Category[] }>(`${apiUrl}/api/admin/categories`),
        read<{ promotions: Promotion[] }>(`${apiUrl}/api/admin/promotions`),
        read<{ settings: PaymentSettings | null }>(`${apiUrl}/api/payment-settings`),
      ]);
      setOverview(stats.overview); setProducts(productData.products); setOrders(orderData.orders); setCategories(categoryData.categories); setPromotions(promotionData.promotions); setPaymentSettings(paymentSettingsData.settings);
      if (!lastOrderNumber.current && orderData.orders.length) lastOrderNumber.current = Math.max(...orderData.orders.map((order) => Number(order.orderNumber)));
    } catch (error) {
      // A temporary failure in one dashboard feed must not be presented as an
      // authentication failure after the server already validated the session.
      if (!sessionValidated || error instanceof AdminSessionError) {
        setAuthorized(false); setOrders([]); setProducts([]); setCategories([]); setPromotions([]); setOverview(null); setPaymentSettings(null);
      }
      setMessage(error instanceof Error ? error.message : 'No fue posible cargar la administración.');
    }
  }

  useEffect(() => { queueMicrotask(() => void load()); }, []);

  async function mutate(path: string, method: string, body?: object) {
    setMessage('');
    setBusyAction(`${method}:${path}`);
    try {
      const response = await fetchWithTimeout(`${apiUrl}${path}`, { method, credentials: 'include', headers: { 'content-type': 'application/json', 'x-csrf-token': csrf }, body: body ? JSON.stringify(body) : undefined });
      const result = response.status === 204 ? {} : await readJson<{ error?: { message?: string } }>(response);
      if ([401, 403].includes(response.status)) {
        setAuthorized(false); setOrders([]); setProducts([]); setCategories([]); setPromotions([]); setOverview(null); setPaymentSettings(null);
        throw new AdminSessionError('La sesión administrativa venció. Ingresa de nuevo.');
      }
      if (!response.ok) throw new Error(result.error?.message ?? 'No fue posible guardar el cambio.');
      setMessage('Cambio guardado y auditado.');
      await load();
    } finally {
      setBusyAction('');
    }
  }

  async function uploadImage(file: File): Promise<string> {
    const body = new FormData();
    body.append('file', file);
    const response = await fetchWithTimeout(`${apiUrl}/api/admin/uploads`, { method: 'POST', credentials: 'include', headers: { 'x-csrf-token': csrf }, body });
    const result = await readJson<{ url?: string; error?: { message?: string } }>(response);
    if ([401, 403].includes(response.status)) { setAuthorized(false); setOrders([]); throw new AdminSessionError('La sesión administrativa venció.'); }
    if (!response.ok || !result.url) throw new Error(result.error?.message ?? 'No fue posible subir la imagen.');
    return result.url;
  }

  async function submitProduct(formData: FormData) {
    try {
      const lines = (name: string) => String(formData.get(name) ?? '').split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
      const optionPriceText = String(formData.get('optionPrices') ?? '').trim();
      const optionPrices = optionPriceText ? JSON.parse(optionPriceText) as unknown : {};
      if (!optionPrices || typeof optionPrices !== 'object' || Array.isArray(optionPrices)) throw new Error('Los precios por opción deben ser un objeto JSON válido.');
      const imageFile = formData.get('image') as File | null;
      const imagePath = imageFile && imageFile.size > 0 ? await uploadImage(imageFile) : editingProduct?.image;
      const payload = {
        slug: formData.get('slug'),
        name: formData.get('name'),
        description: formData.get('description'),
        priceCop: Number(formData.get('priceCop')),
        priceMaxCop: formData.get('priceMaxCop') ? Number(formData.get('priceMaxCop')) : null,
        priceLabel: formData.get('priceLabel') || null,
        availability: formData.get('availability') || 'Hecho bajo pedido',
        dimensions: formData.get('dimensions') || null,
        weight: formData.get('weight') || null,
        categoryId: formData.get('categoryId') || undefined,
        requiresConsultation: formData.get('requiresConsultation') === 'on',
        colors: lines('colors'), fragrances: lines('fragrances'), options: lines('options'),
        optionPrices, features: lines('features'),
        collection: formData.get('collection'), featured: formData.get('featured') === 'on', popular: formData.get('popular') === 'on',
        ...(imagePath ? { imagePath } : {}),
      };
      if (editingProduct) {
        await mutate(`/api/admin/products/${editingProduct.id}`, 'PATCH', payload);
        setEditingProduct(null);
      } else {
        await mutate('/api/admin/products', 'POST', payload);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error');
    }
  }

  async function submitPaymentSettings(formData: FormData) {
    try {
      const qrFile = formData.get('qrImage') as File | null;
      const qrImageUrl = qrFile && qrFile.size > 0 ? await uploadImage(qrFile) : paymentSettings?.qrImageUrl ?? undefined;
      await mutate('/api/admin/payment-settings', 'PUT', {
        bankKey: formData.get('bankKey') || null,
        accountHolder: formData.get('accountHolder') || null,
        instructions: formData.get('instructions') || null,
        ...(qrImageUrl ? { qrImageUrl } : {}),
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error');
    }
  }

  function decidePayment(orderId: string, decision: 'verified' | 'rejected') {
    if (!window.confirm(decision === 'verified' ? '¿Confirmas que verificaste el valor y el comprobante?' : '¿Confirmas que rechazarás este comprobante?')) return;
    void mutate(`/api/admin/orders/${orderId}/payment`, 'PATCH', { decision }).catch((error) => setMessage(error.message));
  }

  function changeOrderStatus(order: Order, status: string) {
    if ((status === 'cancelled' || status === 'completed') && !window.confirm(`¿Confirmas cambiar el pedido #${order.orderNumber} a ${status}?`)) return;
    void mutate(`/api/admin/orders/${order.id}`, 'PATCH', { status }).catch((error) => setMessage(error.message));
  }

  function submitShipping(order: Order, formData: FormData) {
    const shippingCop = Number(formData.get('shippingCop'));
    if (!Number.isInteger(shippingCop) || shippingCop < 0) { setMessage('Ingresa un valor de envío válido.'); return; }
    if (!window.confirm(`¿Confirmas un envío de ${formatCop(shippingCop)} para el pedido #${order.orderNumber}?`)) return;
    void mutate(`/api/admin/orders/${order.id}/shipping`, 'PATCH', { shippingCop }).catch((error) => setMessage(error.message));
  }

  if (authorized === null) return <main className="admin-loading">Verificando acceso…</main>;
  if (!authorized) return <main className="admin-loading"><h1>Acceso administrativo</h1><p>{message || 'Esta sección exige una sesión con rol de administrador validado por el servidor.'}</p><Link className="button button-primary" href="/admin/acceso">Ingresar</Link></main>;

  return <main className="admin-shell"><aside className="admin-nav"><div><small>CELESTIAL</small><b>Administración</b></div>{(['overview', 'products', 'orders', 'categories', 'promotions', 'payment-settings'] as Tab[]).map((item) => <button className={tab === item ? 'active' : ''} aria-pressed={tab === item} onClick={() => { setTab(item); if (item === 'orders') setNewOrders(0); }} key={item}>{({ overview: 'Resumen', products: 'Productos', orders: 'Pedidos', categories: 'Categorías', promotions: 'Promociones', 'payment-settings': 'Pagos' } as Record<Tab, string>)[item]}{item === 'orders' && newOrders > 0 ? ` · ${newOrders} nuevo${newOrders === 1 ? '' : 's'}` : ''}</button>)}<footer><Link href="/admin/acceso">Cuenta y sesión</Link><Link href="/">← Volver a la tienda</Link></footer></aside><section className="admin-main" aria-busy={Boolean(busyAction)}><header><div><p>Panel seguro</p><h1>{({ overview: 'Resumen', products: 'Productos', orders: 'Pedidos', categories: 'Categorías', promotions: 'Promociones', 'payment-settings': 'Pagos' } as Record<Tab, string>)[tab]}</h1></div><span>Rol: Administrador</span></header>{message && <p className="admin-message" role="status">{message}</p>}
    {tab === 'overview' && overview && <div className="stat-grid"><article><span>Productos activos</span><b>{overview.activeProducts}</b></article><article><span>Pedidos pendientes</span><b>{overview.pendingOrders}</b></article><article><span>Pagos pendientes de verificación</span><b>{overview.pendingPaymentVerification}</b></article><article><span>Pedidos de hoy</span><b>{overview.ordersToday}</b></article><article><span>Ventas confirmadas</span><b>{formatCop(overview.confirmedRevenueCop)}</b></article></div>}
    {tab === 'products' && <>
      <form className="admin-form inline-form" key={editingProduct?.id ?? 'new'} onSubmit={(event) => { event.preventDefault(); void submitProduct(new FormData(event.currentTarget)); }}>
        <h2>{editingProduct ? `Editar: ${editingProduct.name}` : 'Nuevo producto'}</h2>
        <input name="name" placeholder="Nombre" aria-label="Nombre del producto" defaultValue={editingProduct?.name} required />
        <input name="slug" placeholder="slug-del-producto" aria-label="Identificador URL del producto" defaultValue={editingProduct?.slug} required />
        <input name="priceCop" type="number" min="1" placeholder="Precio COP" aria-label="Precio en pesos colombianos" defaultValue={editingProduct?.priceCop} required />
        <input name="priceMaxCop" type="number" min="0" placeholder="Precio máximo (opcional)" aria-label="Precio máximo opcional" defaultValue={editingProduct?.priceMaxCop ?? ''} />
        <input name="priceLabel" placeholder="Etiqueta de precio (opcional)" aria-label="Etiqueta de precio opcional" defaultValue={editingProduct?.priceLabel ?? ''} />
        <input name="availability" placeholder="Disponibilidad" aria-label="Disponibilidad del producto" defaultValue={editingProduct?.availability ?? 'Hecho bajo pedido'} />
        <input name="dimensions" placeholder="Medidas (opcional)" aria-label="Medidas opcionales" defaultValue={editingProduct?.dimensions ?? ''} />
        <input name="weight" placeholder="Peso (opcional)" aria-label="Peso opcional" defaultValue={editingProduct?.weight ?? ''} />
        <select name="categoryId" aria-label="Categoría del producto" required defaultValue={categories.find((item) => item.name === editingProduct?.categories[0])?.id ?? ''}>
          <option value="">Categoría</option>{categories.filter((item) => item.active).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
        </select>
        <textarea name="description" placeholder="Descripción completa" aria-label="Descripción completa del producto" defaultValue={editingProduct?.description} required minLength={10} />
        <textarea name="colors" placeholder="Colores, uno por línea" aria-label="Colores, uno por línea" defaultValue={editingProduct?.colors.join('\n') ?? ''} />
        <textarea name="fragrances" placeholder="Aromas, uno por línea" aria-label="Aromas, uno por línea" defaultValue={editingProduct?.fragrances.join('\n') ?? ''} />
        <textarea name="options" placeholder="Opciones o diseños, uno por línea" aria-label="Opciones o diseños, uno por línea" defaultValue={editingProduct?.options.join('\n') ?? ''} />
        <textarea name="optionPrices" placeholder={'Precios por opción en JSON, ej. {"Kit":30000}'} aria-label="Precios exactos por opción en formato JSON" defaultValue={editingProduct && Object.keys(editingProduct.optionPrices ?? {}).length ? JSON.stringify(editingProduct.optionPrices) : ''} />
        <textarea name="features" placeholder="Características, una por línea" aria-label="Características, una por línea" defaultValue={editingProduct?.features.join('\n') ?? 'Producto artesanal'} />
        <select name="collection" aria-label="Colección" defaultValue={editingProduct?.collection ?? 'general'}><option value="general">General</option><option value="navidad">Navidad</option></select>
        <label className="checkbox-field"><input name="requiresConsultation" type="checkbox" defaultChecked={editingProduct?.requiresConsultation} />Solo cotización (sin checkout automático)</label>
        <label className="checkbox-field"><input name="featured" type="checkbox" defaultChecked={editingProduct?.featured} />Destacado</label>
        <label className="checkbox-field"><input name="popular" type="checkbox" defaultChecked={editingProduct?.popular} />Popular</label>
        <label className="image-field">
          <span>Imagen {editingProduct ? '(deja vacío para conservar la actual)' : ''}</span>
          {editingProduct?.image && <img src={editingProduct.image} alt="" className="image-preview" />}
          <input name="image" type="file" accept="image/jpeg,image/png,image/webp" required={!editingProduct} />
        </label>
        <div className="form-actions">
          <button disabled={Boolean(busyAction)}>{editingProduct ? 'Guardar cambios' : 'Crear'}</button>
          {editingProduct && <button type="button" onClick={() => setEditingProduct(null)}>Cancelar</button>}
        </div>
      </form>
      <div className="admin-table">
        <div className="admin-row admin-head"><span>Producto</span><span>Precio</span><span>Acciones</span></div>
        {products.map((product) => <div className="admin-row" key={product.id}>
          <span className="admin-product"><img src={product.image} alt="" />
            <b>{product.name}{!product.active && <em className="inactive-badge"> · Inactivo</em>}{product.requiresConsultation && <em className="guest-tag"> · Solo cotización</em>}</b>
          </span>
          <form className="quick-price" onSubmit={(event) => { event.preventDefault(); const value = Number(new FormData(event.currentTarget).get('priceCop')); if (Number.isInteger(value) && value > 0 && value !== product.priceCop) void mutate(`/api/admin/products/${product.id}`, 'PATCH', { priceCop: value }).catch((error) => setMessage(error.message)); }}><input name="priceCop" aria-label={`Precio de ${product.name}`} type="number" min="1" defaultValue={product.priceCop} required /><button disabled={Boolean(busyAction)}>Guardar</button></form>
          <span>
            <Link href={`/producto/${product.slug}`}>Ver</Link>
            <button type="button" onClick={() => setEditingProduct(product)}>Editar</button>
            {product.active
              ? <button type="button" disabled={Boolean(busyAction)} onClick={() => { if (window.confirm(`¿Desactivar ${product.name}? Dejará de aparecer en la tienda.`)) void mutate(`/api/admin/products/${product.id}`, 'DELETE').catch((error) => setMessage(error.message)); }}>Desactivar</button>
              : <button type="button" disabled={Boolean(busyAction)} onClick={() => void mutate(`/api/admin/products/${product.id}`, 'PATCH', { active: true }).catch((error) => setMessage(error.message))}>Reactivar</button>}
          </span>
        </div>)}
      </div>
    </>}
    {tab === 'orders' && <>
      <div className="order-status-tabs">
        {(['verify', 'shipping', 'completed', 'cancelled'] as OrderView[]).map((view) => {
          const count = orders.filter((order) => orderBucket(order) === view).length;
          return <button key={view} className={orderView === view ? 'active' : ''} aria-pressed={orderView === view} onClick={() => setOrderView(view)}>{orderViewLabel[view]}<b>{count}</b></button>;
        })}
      </div>
      <div className="admin-table">
        <div className="admin-row order admin-head"><span>Pedido</span><span>Cliente</span><span>Total</span><span>Estado</span></div>
        {orders.filter((order) => orderBucket(order) === orderView).map((order) => <div className="admin-order-block" key={order.id}><div className="admin-row order"><span>#{order.orderNumber}<small>{new Date(order.createdAt).toLocaleDateString('es-CO')}</small></span><span>{order.customerName ?? order.email}{order.isGuest && <em className="guest-tag"> · Invitado</em>}<small>{order.email}</small></span><b>{formatCop(order.totalCop)}</b><select aria-label={`Estado del pedido ${order.orderNumber}`} value={order.status} disabled={Boolean(busyAction)} onChange={(event) => changeOrderStatus(order, event.target.value)}>{[order.status, ...(orderTransitions[order.status] ?? [])].map((status) => <option value={status} key={status}>{status}</option>)}</select></div><div className="order-payment-row"><span className={`payment-badge payment-${order.paymentStatus}`}>{paymentStatusLabel[order.paymentStatus] ?? order.paymentStatus}</span>{order.receiptUrl && <a href={order.receiptUrl} target="_blank" rel="noreferrer">Ver comprobante</a>}{order.paymentStatus === 'pending_verification' && <><button type="button" disabled={Boolean(busyAction)} onClick={() => decidePayment(order.id, 'verified')}>Aprobar pago</button><button type="button" disabled={Boolean(busyAction)} onClick={() => decidePayment(order.id, 'rejected')}>Rechazar pago</button></>}</div><form className="order-shipping-form" onSubmit={(event) => { event.preventDefault(); submitShipping(order, new FormData(event.currentTarget)); }}><label>Valor de envío<input name="shippingCop" type="number" min="0" max="100000000" defaultValue={order.shippingCop} required /></label><button disabled={Boolean(busyAction) || ['pending_verification', 'verified'].includes(order.paymentStatus)}>{order.shippingConfirmed ? 'Actualizar total' : 'Confirmar envío y total'}</button></form><details className="admin-order-details"><summary>Ver datos y productos</summary><div><p><b>Teléfono:</b> {order.shippingAddress.phone}</p><p><b>Entrega:</b> {order.shippingAddress.address}, {order.shippingAddress.city}</p>{order.customerNote && <p><b>Nota:</b> {order.customerNote}</p>}<ul>{order.items.map((item, index) => <li key={`${order.id}-${index}`}><b>{item.productName}</b> · {item.quantity} × {formatCop(item.unitPriceCop)} = {formatCop(item.lineTotalCop)}{Object.keys(item.selectedOptions).length > 0 && <small>{Object.entries(item.selectedOptions).map(([key, value]) => `${key}: ${value}`).join(' · ')}</small>}</li>)}</ul></div></details></div>)}
        {!orders.filter((order) => orderBucket(order) === orderView).length && <p className="admin-empty">No hay pedidos en esta vista.</p>}
      </div>
    </>}
    {tab === 'payment-settings' && <form className="admin-form inline-form small" onSubmit={(event) => { event.preventDefault(); void submitPaymentSettings(new FormData(event.currentTarget)); }}>
      <h2>Configuración de pago por transferencia</h2>
      <input name="bankKey" placeholder="Llave / número de cuenta" aria-label="Llave o número de cuenta" defaultValue={paymentSettings?.bankKey ?? ''} />
      <input name="accountHolder" placeholder="A nombre de" aria-label="Titular de la cuenta" defaultValue={paymentSettings?.accountHolder ?? ''} />
      <textarea name="instructions" placeholder="Instrucciones para el cliente" aria-label="Instrucciones de transferencia para el cliente" defaultValue={paymentSettings?.instructions ?? ''} />
      <label className="image-field">
        <span>Código QR {paymentSettings?.qrImageUrl ? '(deja vacío para conservar el actual)' : ''}</span>
        {paymentSettings?.qrImageUrl && <img src={paymentSettings.qrImageUrl} alt="" className="image-preview" />}
        <input name="qrImage" type="file" accept="image/jpeg,image/png,image/webp" />
      </label>
      <button disabled={Boolean(busyAction)}>Guardar configuración</button>
    </form>}
    {tab === 'categories' && <><form className="admin-form inline-form small" onSubmit={(event) => { event.preventDefault(); const formData = new FormData(event.currentTarget); void mutate('/api/admin/categories', 'POST', { slug: formData.get('slug'), name: formData.get('name'), description: null, active: true, sortOrder: Number(formData.get('sortOrder')) }).catch((error) => setMessage(error.message)); }}><h2>Nueva categoría</h2><input name="name" placeholder="Nombre" aria-label="Nombre de categoría" required /><input name="slug" placeholder="slug" aria-label="Identificador URL de categoría" required /><input name="sortOrder" type="number" min="0" defaultValue="0" aria-label="Orden de categoría" /><button disabled={Boolean(busyAction)}>Crear</button></form><div className="admin-table">{categories.map((category) => <div className="admin-row" key={category.id}><span><b>{category.name}</b><small>{category.slug}</small></span><span>Orden {category.sortOrder}</span><button type="button" disabled={Boolean(busyAction)} onClick={() => { const active = !category.active; if (!active && !window.confirm(`¿Desactivar la categoría ${category.name}?`)) return; void mutate(`/api/admin/categories/${category.id}`, 'PUT', { slug: category.slug, name: category.name, description: category.description ?? null, active, sortOrder: category.sortOrder }).catch((error) => setMessage(error.message)); }}>{category.active ? 'Desactivar' : 'Activar'}</button></div>)}</div></>}
    {tab === 'promotions' && <><p className="admin-note">Las promociones se guardan únicamente como borradores. No pueden activarse hasta que el checkout calcule y audite descuentos en el servidor.</p><form className="admin-form inline-form small" onSubmit={(event) => { event.preventDefault(); const formData = new FormData(event.currentTarget); const kind = String(formData.get('kind')); void mutate('/api/admin/promotions', 'POST', { name: formData.get('name'), code: formData.get('code') || null, kind, configuration: { value: Number(formData.get('value')) }, active: false }).catch((error) => setMessage(error.message)); }}><h2>Nueva promoción (borrador)</h2><input name="name" placeholder="Nombre" aria-label="Nombre de promoción" required /><input name="code" placeholder="Código opcional" aria-label="Código promocional opcional" /><select name="kind" aria-label="Tipo de promoción"><option value="percentage">Porcentaje</option><option value="fixed">Valor fijo</option><option value="bundle">Bundle</option></select><input name="value" type="number" min="0" placeholder="Valor" aria-label="Valor de promoción" required /><button disabled={Boolean(busyAction)}>Guardar borrador</button></form><div className="admin-table">{promotions.map((promotion) => <div className="admin-row" key={promotion.id}><span><b>{promotion.name}</b><small>{promotion.code ?? 'Sin código'} · {promotion.kind}</small></span><span>{String(promotion.configuration.value ?? '')}</span><span>Borrador · no aplicado</span></div>)}</div></>}
  </section></main>;
}
