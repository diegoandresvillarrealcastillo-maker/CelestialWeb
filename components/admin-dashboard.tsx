'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatCop } from '@/data/catalog';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
type Tab = 'overview' | 'products' | 'orders' | 'categories' | 'promotions' | 'payment-settings';
type Product = {
  id: string; slug: string; name: string; description: string; priceCop: number;
  priceMaxCop?: number | null; priceLabel?: string | null; image: string;
  dimensions?: string | null; weight?: string | null; availability: string;
  active: boolean; categories: string[];
};
type Order = { id: string; orderNumber: string; status: string; paymentStatus: string; receiptUrl: string | null; totalCop: number; email: string; customerName?: string; isGuest: boolean; createdAt: string };
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
type Category = { id: string; slug: string; name: string; description?: string | null; active: boolean; sortOrder: number };
type Promotion = { id: string; name: string; code?: string | null; kind: 'percentage' | 'fixed' | 'bundle'; configuration: Record<string, string | number | boolean>; active: boolean };
type Overview = { activeProducts: number; pendingOrders: number; pendingPaymentVerification: number; customers: number; confirmedRevenueCop: number };

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

  useEffect(() => { void load(); }, []);
  async function load() {
    const options = { credentials: 'include' as const };
    const me = await fetch(`${apiUrl}/api/auth/me`, options);
    if (!me.ok) { setAuthorized(false); return; }
    const user = await me.json() as { user: { roles: string[] } };
    if (!user.user.roles.includes('admin')) { setAuthorized(false); return; }
    setAuthorized(true);
    const csrfResponse = await fetch(`${apiUrl}/api/auth/csrf`, options);
    setCsrf((await csrfResponse.json() as { csrfToken: string }).csrfToken);
    const [stats, productData, orderData, categoryData, promotionData, paymentSettingsData] = await Promise.all([
      fetch(`${apiUrl}/api/admin/overview`, options).then((response) => response.json()) as Promise<{ overview: Overview }>,
      fetch(`${apiUrl}/api/admin/products`, options).then((response) => response.json()) as Promise<{ products: Product[] }>,
      fetch(`${apiUrl}/api/admin/orders`, options).then((response) => response.json()) as Promise<{ orders: Order[] }>,
      fetch(`${apiUrl}/api/admin/categories`, options).then((response) => response.json()) as Promise<{ categories: Category[] }>,
      fetch(`${apiUrl}/api/admin/promotions`, options).then((response) => response.json()) as Promise<{ promotions: Promotion[] }>,
      fetch(`${apiUrl}/api/payment-settings`, options).then((response) => response.json()) as Promise<{ settings: PaymentSettings | null }>,
    ]);
    setOverview(stats.overview); setProducts(productData.products); setOrders(orderData.orders); setCategories(categoryData.categories); setPromotions(promotionData.promotions); setPaymentSettings(paymentSettingsData.settings);
  }

  async function mutate(path: string, method: string, body?: object) {
    setMessage('');
    const response = await fetch(`${apiUrl}${path}`, { method, credentials: 'include', headers: { 'content-type': 'application/json', 'x-csrf-token': csrf }, body: body ? JSON.stringify(body) : undefined });
    const result = response.status === 204 ? {} : await response.json() as { error?: { message?: string } };
    if (!response.ok) throw new Error(result.error?.message ?? 'No fue posible guardar el cambio.');
    setMessage('Cambio guardado y auditado.');
    await load();
  }

  async function uploadImage(file: File): Promise<string> {
    const body = new FormData();
    body.append('file', file);
    const response = await fetch(`${apiUrl}/api/admin/uploads`, { method: 'POST', credentials: 'include', headers: { 'x-csrf-token': csrf }, body });
    const result = await response.json() as { url?: string; error?: { message?: string } };
    if (!response.ok || !result.url) throw new Error(result.error?.message ?? 'No fue posible subir la imagen.');
    return result.url;
  }

  async function submitProduct(formData: FormData) {
    try {
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
        ...(imagePath ? { imagePath } : {}),
      };
      if (editingProduct) {
        await mutate(`/api/admin/products/${editingProduct.id}`, 'PATCH', payload);
        setEditingProduct(null);
      } else {
        await mutate('/api/admin/products', 'POST', { ...payload, colors: [], fragrances: [], options: [], features: ['Producto artesanal'] });
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
    void mutate(`/api/admin/orders/${orderId}/payment`, 'PATCH', { decision }).catch((error) => setMessage(error.message));
  }

  if (authorized === null) return <main className="admin-loading">Verificando acceso…</main>;
  if (!authorized) return <main className="admin-loading"><h1>Acceso administrativo</h1><p>Esta sección exige una sesión con rol de administrador validado por el servidor.</p><Link className="button button-primary" href="/cuenta">Ir a mi cuenta</Link></main>;

  return <main className="admin-shell"><aside className="admin-nav"><div><small>CELESTIAL</small><b>Administración</b></div>{(['overview', 'products', 'orders', 'categories', 'promotions', 'payment-settings'] as Tab[]).map((item) => <button className={tab === item ? 'active' : ''} onClick={() => setTab(item)} key={item}>{({ overview: 'Resumen', products: 'Productos', orders: 'Pedidos', categories: 'Categorías', promotions: 'Promociones', 'payment-settings': 'Pagos' } as Record<Tab, string>)[item]}</button>)}<Link href="/">← Volver a la tienda</Link></aside><section className="admin-main"><header><div><p>Panel seguro</p><h1>{({ overview: 'Resumen', products: 'Productos', orders: 'Pedidos', categories: 'Categorías', promotions: 'Promociones', 'payment-settings': 'Pagos' } as Record<Tab, string>)[tab]}</h1></div><span>Rol: Administrador</span></header>{message && <p className="admin-message" role="status">{message}</p>}
    {tab === 'overview' && overview && <div className="stat-grid"><article><span>Productos activos</span><b>{overview.activeProducts}</b></article><article><span>Pedidos pendientes</span><b>{overview.pendingOrders}</b></article><article><span>Pagos pendientes de verificación</span><b>{overview.pendingPaymentVerification}</b></article><article><span>Clientes</span><b>{overview.customers}</b></article><article><span>Ventas confirmadas</span><b>{formatCop(overview.confirmedRevenueCop)}</b></article></div>}
    {tab === 'products' && <>
      <form className="admin-form inline-form" key={editingProduct?.id ?? 'new'} action={submitProduct}>
        <h2>{editingProduct ? `Editar: ${editingProduct.name}` : 'Nuevo producto'}</h2>
        <input name="name" placeholder="Nombre" defaultValue={editingProduct?.name} required />
        <input name="slug" placeholder="slug-del-producto" defaultValue={editingProduct?.slug} required />
        <input name="priceCop" type="number" min="0" placeholder="Precio COP" defaultValue={editingProduct?.priceCop} required />
        <input name="priceMaxCop" type="number" min="0" placeholder="Precio máximo (opcional)" defaultValue={editingProduct?.priceMaxCop ?? ''} />
        <input name="priceLabel" placeholder="Etiqueta de precio (opcional)" defaultValue={editingProduct?.priceLabel ?? ''} />
        <input name="availability" placeholder="Disponibilidad" defaultValue={editingProduct?.availability ?? 'Hecho bajo pedido'} />
        <input name="dimensions" placeholder="Medidas (opcional)" defaultValue={editingProduct?.dimensions ?? ''} />
        <input name="weight" placeholder="Peso (opcional)" defaultValue={editingProduct?.weight ?? ''} />
        <select name="categoryId" required defaultValue={categories.find((item) => item.name === editingProduct?.categories[0])?.id ?? ''}>
          <option value="">Categoría</option>{categories.filter((item) => item.active).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
        </select>
        <textarea name="description" placeholder="Descripción completa" defaultValue={editingProduct?.description} required minLength={10} />
        <label className="image-field">
          <span>Imagen {editingProduct ? '(deja vacío para conservar la actual)' : ''}</span>
          {editingProduct?.image && <img src={editingProduct.image} alt="" className="image-preview" />}
          <input name="image" type="file" accept="image/jpeg,image/png,image/webp" required={!editingProduct} />
        </label>
        <div className="form-actions">
          <button>{editingProduct ? 'Guardar cambios' : 'Crear'}</button>
          {editingProduct && <button type="button" onClick={() => setEditingProduct(null)}>Cancelar</button>}
        </div>
      </form>
      <div className="admin-table">
        <div className="admin-row admin-head"><span>Producto</span><span>Precio</span><span>Acciones</span></div>
        {products.map((product) => <div className="admin-row" key={product.id}>
          <span className="admin-product"><img src={product.image} alt="" />
            <b>{product.name}{!product.active && <em className="inactive-badge"> · Inactivo</em>}</b>
          </span>
          <input aria-label={`Precio de ${product.name}`} type="number" defaultValue={product.priceCop} onBlur={(event) => { const value = Number(event.target.value); if (value !== product.priceCop) void mutate(`/api/admin/products/${product.id}`, 'PATCH', { priceCop: value }).catch((error) => setMessage(error.message)); }} />
          <span>
            <Link href={`/producto/${product.slug}`}>Ver</Link>
            <button onClick={() => setEditingProduct(product)}>Editar</button>
            {product.active
              ? <button onClick={() => void mutate(`/api/admin/products/${product.id}`, 'DELETE').catch((error) => setMessage(error.message))}>Desactivar</button>
              : <button onClick={() => void mutate(`/api/admin/products/${product.id}`, 'PATCH', { active: true }).catch((error) => setMessage(error.message))}>Reactivar</button>}
          </span>
        </div>)}
      </div>
    </>}
    {tab === 'orders' && <>
      <div className="order-status-tabs">
        {(['verify', 'shipping', 'completed', 'cancelled'] as OrderView[]).map((view) => {
          const count = orders.filter((order) => orderBucket(order) === view).length;
          return <button key={view} className={orderView === view ? 'active' : ''} onClick={() => setOrderView(view)}>{orderViewLabel[view]}<b>{count}</b></button>;
        })}
      </div>
      <div className="admin-table">
        <div className="admin-row order admin-head"><span>Pedido</span><span>Cliente</span><span>Total</span><span>Estado</span></div>
        {orders.filter((order) => orderBucket(order) === orderView).map((order) => <div className="admin-order-block" key={order.id}><div className="admin-row order"><span>#{order.orderNumber}<small>{new Date(order.createdAt).toLocaleDateString('es-CO')}</small></span><span>{order.customerName ?? order.email}{order.isGuest && <em className="guest-tag"> · Invitado</em>}<small>{order.email}</small></span><b>{formatCop(order.totalCop)}</b><select value={order.status} onChange={(event) => void mutate(`/api/admin/orders/${order.id}`, 'PATCH', { status: event.target.value }).catch((error) => setMessage(error.message))}>{['pending','confirmed','preparing','shipped','completed','cancelled'].map((status) => <option value={status} key={status}>{status}</option>)}</select></div><div className="order-payment-row"><span className={`payment-badge payment-${order.paymentStatus}`}>{paymentStatusLabel[order.paymentStatus] ?? order.paymentStatus}</span>{order.receiptUrl && <a href={order.receiptUrl} target="_blank" rel="noreferrer">Ver comprobante</a>}{order.paymentStatus === 'pending_verification' && <><button onClick={() => decidePayment(order.id, 'verified')}>Aprobar pago</button><button onClick={() => decidePayment(order.id, 'rejected')}>Rechazar pago</button></>}</div></div>)}
        {!orders.filter((order) => orderBucket(order) === orderView).length && <p className="admin-empty">No hay pedidos en esta vista.</p>}
      </div>
    </>}
    {tab === 'payment-settings' && <form className="admin-form inline-form small" action={submitPaymentSettings}>
      <h2>Configuración de pago por transferencia</h2>
      <input name="bankKey" placeholder="Llave / número de cuenta" defaultValue={paymentSettings?.bankKey ?? ''} />
      <input name="accountHolder" placeholder="A nombre de" defaultValue={paymentSettings?.accountHolder ?? ''} />
      <textarea name="instructions" placeholder="Instrucciones para el cliente" defaultValue={paymentSettings?.instructions ?? ''} />
      <label className="image-field">
        <span>Código QR {paymentSettings?.qrImageUrl ? '(deja vacío para conservar el actual)' : ''}</span>
        {paymentSettings?.qrImageUrl && <img src={paymentSettings.qrImageUrl} alt="" className="image-preview" />}
        <input name="qrImage" type="file" accept="image/jpeg,image/png,image/webp" />
      </label>
      <button>Guardar configuración</button>
    </form>}
    {tab === 'categories' && <><form className="admin-form inline-form small" action={async (formData) => { try { await mutate('/api/admin/categories', 'POST', { slug: formData.get('slug'), name: formData.get('name'), description: null, active: true, sortOrder: Number(formData.get('sortOrder')) }); } catch (error) { setMessage(error instanceof Error ? error.message : 'Error'); } }}><h2>Nueva categoría</h2><input name="name" placeholder="Nombre" required /><input name="slug" placeholder="slug" required /><input name="sortOrder" type="number" min="0" defaultValue="0" /><button>Crear</button></form><div className="admin-table">{categories.map((category) => <div className="admin-row" key={category.id}><span><b>{category.name}</b><small>{category.slug}</small></span><span>Orden {category.sortOrder}</span><button onClick={() => void mutate(`/api/admin/categories/${category.id}`, 'PUT', { slug: category.slug, name: category.name, description: category.description ?? null, active: !category.active, sortOrder: category.sortOrder }).catch((error) => setMessage(error.message))}>{category.active ? 'Desactivar' : 'Activar'}</button></div>)}</div></>}
    {tab === 'promotions' && <><form className="admin-form inline-form small" action={async (formData) => { try { const kind = String(formData.get('kind')); await mutate('/api/admin/promotions', 'POST', { name: formData.get('name'), code: formData.get('code') || null, kind, configuration: { value: Number(formData.get('value')) }, active: false }); } catch (error) { setMessage(error instanceof Error ? error.message : 'Error'); } }}><h2>Nueva promoción</h2><input name="name" placeholder="Nombre" required /><input name="code" placeholder="Código opcional" /><select name="kind"><option value="percentage">Porcentaje</option><option value="fixed">Valor fijo</option><option value="bundle">Bundle</option></select><input name="value" type="number" min="0" placeholder="Valor" required /><button>Crear inactiva</button></form><div className="admin-table">{promotions.map((promotion) => <div className="admin-row" key={promotion.id}><span><b>{promotion.name}</b><small>{promotion.code ?? 'Sin código'} · {promotion.kind}</small></span><span>{String(promotion.configuration.value ?? '')}</span><button onClick={() => void mutate(`/api/admin/promotions/${promotion.id}`, 'PUT', { name: promotion.name, code: promotion.code ?? null, kind: promotion.kind, configuration: promotion.configuration, active: !promotion.active, startsAt: null, endsAt: null }).catch((error) => setMessage(error.message))}>{promotion.active ? 'Pausar' : 'Activar'}</button></div>)}</div></>}
  </section></main>;
}
