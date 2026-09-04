'use client';

import { useEffect, useState } from 'react';
import { formatCop } from '@/data/catalog';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
type User = { userId: string; email: string; fullName: string | null; roles: string[]; emailVerified: boolean };
type Order = { id: string; orderNumber: string; status: string; paymentStatus: string; receiptUrl: string | null; totalCop: number; createdAt: string };

const paymentStatusLabel: Record<string, string> = {
  pending: 'Pendiente de pago', pending_verification: 'Pago pendiente de verificación',
  verified: 'Pago verificado', rejected: 'Pago rechazado',
};

export function AccountPanel() {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [user, setUser] = useState<User | null>(null);
  const [csrfToken, setCsrfToken] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [reuploadingOrderId, setReuploadingOrderId] = useState<string | null>(null);
  const [reuploadBusy, setReuploadBusy] = useState(false);

  async function loadUser() {
    try {
      const response = await fetch(`${apiUrl}/api/auth/me`, { credentials: 'include' });
      if (!response.ok) return;
      const data = await response.json() as { user: User }; setUser(data.user);
      const csrf = await fetch(`${apiUrl}/api/auth/csrf`, { credentials: 'include' });
      if (csrf.ok) setCsrfToken((await csrf.json() as { csrfToken: string }).csrfToken);
      const orderResponse = await fetch(`${apiUrl}/api/orders`, { credentials: 'include' });
      if (orderResponse.ok) setOrders((await orderResponse.json() as { orders: Order[] }).orders);
    } catch {
      // The storefront remains usable while the independently deployed API starts.
    }
  }
  useEffect(() => { queueMicrotask(() => void loadUser()); }, []);

  async function submit(formData: FormData) {
    setBusy(true); setMessage('');
    const body = Object.fromEntries(Array.from(formData.entries()).filter(([, value]) => String(value).trim() !== ''));
    try {
      const response = await fetch(`${apiUrl}/api/auth/${mode === 'forgot' ? 'forgot-password' : mode}`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json() as { message?: string; user?: User; csrfToken?: string; error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message ?? 'No fue posible continuar.');
      setMessage(result.message ?? 'Listo.');
      if (mode === 'login' && result.user && result.csrfToken) { setUser(result.user); setCsrfToken(result.csrfToken); }
      if (mode === 'register') setMode('login');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No fue posible continuar.'); }
    finally { setBusy(false); }
  }

  async function reuploadReceipt(orderId: string, formData: FormData) {
    setReuploadBusy(true);
    try {
      const file = formData.get('file') as File | null;
      if (!file || !file.size) throw new Error('Selecciona la imagen de tu comprobante.');
      const body = new FormData();
      body.append('file', file);
      const response = await fetch(`${apiUrl}/api/orders/${orderId}/receipt`, { method: 'POST', credentials: 'include', headers: { 'x-csrf-token': csrfToken }, body });
      const result = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message ?? 'No fue posible enviar el comprobante.');
      setMessage('Comprobante enviado. Tu pago quedó pendiente de verificación.');
      setReuploadingOrderId(null);
      await loadUser();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible enviar el comprobante.');
    } finally { setReuploadBusy(false); }
  }

  async function logout() {
    try {
      await fetch(`${apiUrl}/api/auth/logout`, { method: 'POST', credentials: 'include', headers: { 'x-csrf-token': csrfToken } });
      setUser(null); setCsrfToken(''); setMessage('Sesión cerrada.');
    } catch { setMessage('No fue posible cerrar la sesión. Intenta de nuevo.'); }
  }

  async function updateProfile(formData: FormData) {
    try {
      const response = await fetch(`${apiUrl}/api/auth/profile`, { method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify({ fullName: formData.get('fullName'), phone: formData.get('phone') || null }) });
      const result = await response.json() as { user?: User; error?: { message?: string } };
      if (response.ok && result.user) { setUser(result.user); setMessage('Perfil actualizado.'); } else setMessage(result.error?.message ?? 'No fue posible actualizar el perfil.');
    } catch { setMessage('No fue posible actualizar el perfil. Intenta de nuevo.'); }
  }

  async function changePassword(formData: FormData) {
    try {
      const response = await fetch(`${apiUrl}/api/auth/change-password`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify({ currentPassword: formData.get('currentPassword'), newPassword: formData.get('newPassword') }) });
      const result = await response.json() as { message?: string; error?: { message?: string } };
      setMessage(response.ok ? result.message ?? 'Contraseña actualizada.' : result.error?.message ?? 'No fue posible actualizarla.');
      if (response.ok) { setUser(null); setCsrfToken(''); }
    } catch { setMessage('No fue posible actualizarla. Intenta de nuevo.'); }
  }

  if (user) return <section className="account-card signed-in wide"><p className="eyebrow"><span /> Mi Celestial</p><h1>Hola, {user.fullName ?? 'qué alegría verte'}</h1><p>{user.email}</p><div className="account-status"><span>Correo</span><b className={user.emailVerified ? 'verified' : ''}>{user.emailVerified ? 'Verificado ✓' : 'Pendiente'}</b></div><div className="account-status"><span>Perfil</span><b>{user.roles.includes('admin') ? 'Administrador' : 'Cliente'}</b></div><details className="account-section"><summary>Editar perfil <span>+</span></summary><form action={updateProfile}><label>Nombre completo<input name="fullName" defaultValue={user.fullName ?? ''} required minLength={2} maxLength={120} /></label><label>Teléfono<input name="phone" minLength={7} maxLength={30} /></label><button className="button button-primary">Guardar perfil</button></form></details><details className="account-section"><summary>Cambiar contraseña <span>+</span></summary><form action={changePassword}><label>Contraseña actual<input name="currentPassword" type="password" required /></label><label>Nueva contraseña<input name="newPassword" type="password" required minLength={12} maxLength={128} /></label><button className="button button-primary">Cambiar y cerrar sesiones</button></form></details><div className="order-history"><h2>Mis pedidos</h2>{orders.length ? orders.map((order) => <article key={order.id} className="order-history-line"><div className="order-history-row"><span>#{order.orderNumber}<small>{new Date(order.createdAt).toLocaleDateString('es-CO')}</small></span><b>{order.status}</b><strong>{formatCop(order.totalCop)}</strong></div><div className="order-payment-row"><span className={`payment-badge payment-${order.paymentStatus}`}>{paymentStatusLabel[order.paymentStatus] ?? order.paymentStatus}</span>{order.receiptUrl && <a href={order.receiptUrl} target="_blank" rel="noreferrer">Ver comprobante</a>}{order.paymentStatus === 'rejected' && (reuploadingOrderId === order.id ? <form action={(formData) => reuploadReceipt(order.id, formData)}><input name="file" type="file" accept="image/jpeg,image/png,image/webp" required /><button className="button button-primary" disabled={reuploadBusy}>{reuploadBusy ? 'Enviando…' : 'Enviar'}</button></form> : <button onClick={() => setReuploadingOrderId(order.id)}>Volver a cargar comprobante</button>)}</div></article>) : <p>Aún no tienes pedidos.</p>}</div><a className="button button-primary full" href="/carrito">Ver mi bolsa</a>{user.roles.includes('admin') && <a className="button button-quiet full" href="/admin">Abrir administración</a>}{message && <p className="form-message" role="status">{message}</p>}<button className="logout-button" onClick={logout}>Cerrar sesión</button></section>;

  return <section className="account-card"><p className="eyebrow"><span /> Mi Celestial</p><h1>{mode === 'login' ? 'Vuelve a tu espacio' : mode === 'register' ? 'Crea tu cuenta' : 'Recupera tu acceso'}</h1><p>{mode === 'forgot' ? 'Te enviaremos un enlace de un solo uso.' : 'Guarda tus pedidos y continúa tu experiencia.'}</p><div className="account-tabs"><button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Ingresar</button><button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Crear cuenta</button></div><form action={submit}>{mode === 'register' && <><label>Nombre completo<input name="fullName" required minLength={2} maxLength={120} autoComplete="name" /></label><label>Teléfono<input name="phone" minLength={7} maxLength={30} autoComplete="tel" /></label></>}<label>Correo electrónico<input name="email" type="email" required maxLength={254} autoComplete="email" /></label>{mode !== 'forgot' && <label>Contraseña<input name="password" type="password" required minLength={mode === 'register' ? 12 : 1} maxLength={128} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} /></label>}{mode !== 'login' && <input className="honeypot" name="hpVerify" tabIndex={-1} autoComplete="off" data-lpignore="true" data-1p-ignore="true" aria-hidden="true" />}<button className="button button-primary full" disabled={busy}>{busy ? 'Procesando…' : mode === 'login' ? 'Ingresar de forma segura' : mode === 'register' ? 'Crear mi cuenta' : 'Enviar enlace'}</button></form>{mode === 'login' && <button className="forgot-link" onClick={() => setMode('forgot')}>Olvidé mi contraseña</button>}{mode === 'forgot' && <button className="forgot-link" onClick={() => setMode('login')}>Volver al ingreso</button>}{message && <p className="form-message" role="status">{message}</p>}</section>;
}
