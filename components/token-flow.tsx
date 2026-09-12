'use client';

import Link from 'next/link';
import { useState } from 'react';
import { PasswordField } from '@/components/password-field';
import { fetchWithTimeout, readJson } from '@/lib/client-http';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function ResetPassword({ token }: { token?: string }) {
  const [message, setMessage] = useState(token ? '' : 'El enlace no contiene un token válido.');
  async function submit(formData: FormData) {
    if (!token) return;
    try {
      const response = await fetchWithTimeout(`${apiUrl}/api/auth/reset-password`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, password: formData.get('password') }) });
      const data = await readJson<{ message?: string; error?: { message?: string } }>(response);
      setMessage(response.ok ? data.message ?? 'Contraseña actualizada.' : data.error?.message ?? 'No fue posible actualizarla.');
    } catch {
      setMessage('No fue posible conectar con el servicio administrativo. Intenta de nuevo.');
    }
  }
  return <main className="token-page"><span>✦</span><h1>Nueva contraseña administrativa</h1><p>Usa al menos 12 caracteres, mayúscula, número y símbolo.</p>{token && <form onSubmit={(event) => { event.preventDefault(); void submit(new FormData(event.currentTarget)); }}><label>Contraseña nueva<PasswordField name="password" minLength={12} maxLength={128} required autoComplete="new-password" /></label><button className="button button-primary">Actualizar contraseña</button></form>}{message && <p role="status">{message}</p>}<Link className="text-link" href="/admin/acceso">Volver al acceso administrativo</Link></main>;
}
