'use client';

import { useEffect, useState } from 'react';
import { PasswordField } from '@/components/password-field';
import { fetchWithTimeout, readJson } from '@/lib/client-http';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
type User = { userId: string; email: string; fullName: string | null; phone: string | null; roles: string[]; emailVerified: boolean };

export function AccountPanel() {
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [user, setUser] = useState<User | null>(null);
  const [csrfToken, setCsrfToken] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadAdmin() {
    try {
      const response = await fetchWithTimeout(`${apiUrl}/api/auth/me`, { credentials: 'include' });
      if (!response.ok) return;
      const data = await readJson<{ user: User }>(response);
      if (!data.user?.roles.includes('admin')) return;
      setUser(data.user);
      const csrf = await fetchWithTimeout(`${apiUrl}/api/auth/csrf`, { method: 'POST', credentials: 'include' });
      if (csrf.ok) setCsrfToken((await readJson<{ csrfToken: string }>(csrf)).csrfToken ?? '');
    } catch {
      setMessage('No fue posible conectar con el servicio administrativo.');
    }
  }

  useEffect(() => { queueMicrotask(() => void loadAdmin()); }, []);

  async function submit(formData: FormData) {
    setBusy(true);
    setMessage('');
    const body = Object.fromEntries(Array.from(formData.entries()).filter(([, value]) => String(value).trim() !== ''));
    try {
      const endpoint = mode === 'forgot' ? 'forgot-password' : 'login';
      const response = await fetchWithTimeout(`${apiUrl}/api/auth/${endpoint}`, {
        method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      });
      const result = await readJson<{ message?: string; user?: User; csrfToken?: string; error?: { message?: string; fields?: Record<string, string[]> } }>(response);
      if (!response.ok) {
        const fieldMessage = result.error?.fields && Object.values(result.error.fields).flat()[0];
        throw new Error(fieldMessage || result.error?.message || 'No fue posible continuar.');
      }
      setMessage(result.message ?? 'Listo.');
      if (mode === 'login' && result.user?.roles.includes('admin') && result.csrfToken) {
        setUser(result.user);
        setCsrfToken(result.csrfToken);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible continuar.');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    try {
      const response = await fetchWithTimeout(`${apiUrl}/api/auth/logout`, {
        method: 'POST', credentials: 'include', headers: { 'x-csrf-token': csrfToken },
      });
      if (!response.ok) throw new Error();
      setUser(null);
      setCsrfToken('');
      setMessage('Sesión cerrada.');
    } catch {
      setMessage('No fue posible cerrar la sesión. La sesión sigue activa; intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  async function updateProfile(formData: FormData) {
    setBusy(true);
    try {
      const response = await fetchWithTimeout(`${apiUrl}/api/auth/profile`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ fullName: formData.get('fullName'), phone: formData.get('phone') || null }),
      });
      const result = await readJson<{ user?: User; error?: { message?: string } }>(response);
      if (!response.ok || !result.user) throw new Error(result.error?.message ?? 'No fue posible actualizar el perfil.');
      setUser(result.user);
      setMessage('Perfil administrativo actualizado.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible actualizar el perfil.');
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(formData: FormData) {
    setBusy(true);
    try {
      const response = await fetchWithTimeout(`${apiUrl}/api/auth/change-password`, {
        method: 'POST', credentials: 'include',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ currentPassword: formData.get('currentPassword'), newPassword: formData.get('newPassword') }),
      });
      const result = await readJson<{ message?: string; error?: { message?: string } }>(response);
      if (!response.ok) throw new Error(result.error?.message ?? 'No fue posible actualizarla.');
      setMessage(result.message ?? 'Contraseña actualizada.');
      setUser(null);
      setCsrfToken('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible actualizarla.');
    } finally {
      setBusy(false);
    }
  }

  if (user) return (
    <section className="account-card signed-in">
      <p className="eyebrow"><span /> Administración Celestial</p>
      <h1>Hola, {user.fullName ?? 'administradora'}</h1>
      <p>{user.email}</p>
      <div className="account-status"><span>Acceso</span><b className="verified">Administrador verificado ✓</b></div>
      <details className="account-section"><summary>Editar perfil <span>+</span></summary><form onSubmit={(event) => { event.preventDefault(); void updateProfile(new FormData(event.currentTarget)); }}><label>Nombre completo<input name="fullName" defaultValue={user.fullName ?? ''} required minLength={2} maxLength={120} /></label><label>Teléfono<input name="phone" defaultValue={user.phone ?? ''} minLength={7} maxLength={30} /></label><button className="button button-primary" disabled={busy}>Guardar perfil</button></form></details>
      <details className="account-section"><summary>Cambiar contraseña <span>+</span></summary><form onSubmit={(event) => { event.preventDefault(); void changePassword(new FormData(event.currentTarget)); }}><label>Contraseña actual<PasswordField name="currentPassword" required /></label><label>Nueva contraseña<PasswordField name="newPassword" required minLength={12} maxLength={128} /></label><button className="button button-primary" disabled={busy}>Cambiar y cerrar sesiones</button></form></details>
      <a className="button button-primary full" href="/admin">Abrir administración</a>
      {message && <p className="form-message" role="status">{message}</p>}
      <button className="logout-button" onClick={logout} disabled={busy}>Cerrar sesión</button>
    </section>
  );

  return (
    <section className="account-card">
      <p className="eyebrow"><span /> Área privada</p>
      <h1>{mode === 'login' ? 'Acceso administrativo' : 'Recupera tu acceso'}</h1>
      <p>{mode === 'forgot' ? 'Enviaremos un enlace de un solo uso únicamente a una administradora autorizada.' : 'Solo las dos administradoras de Celestial pueden iniciar sesión.'}</p>
      <form onSubmit={(event) => { event.preventDefault(); void submit(new FormData(event.currentTarget)); }}>
        <label>Correo electrónico<input name="email" type="email" required maxLength={254} autoComplete="email" /></label>
        {mode === 'login' && <label>Contraseña<PasswordField name="password" required minLength={1} maxLength={128} autoComplete="current-password" /></label>}
        {mode === 'login' && <button type="button" className="forgot-link" onClick={() => setMode('forgot')}>¿Olvidaste tu contraseña?</button>}
        {mode === 'forgot' && <input className="honeypot" name="hpVerify" tabIndex={-1} autoComplete="off" aria-hidden="true" />}
        <button className="button button-primary full" disabled={busy}>{busy ? 'Procesando…' : mode === 'login' ? 'Ingresar de forma segura' : 'Enviar enlace'}</button>
      </form>
      {mode === 'forgot' && <button type="button" className="forgot-link" onClick={() => setMode('login')}>Volver al ingreso</button>}
      {message && <p className="form-message" role="status">{message}</p>}
    </section>
  );
}
