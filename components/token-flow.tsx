'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function VerifyEmail({ token }: { token?: string }) {
  const [message, setMessage] = useState(token ? 'Verificando tu correo…' : 'El enlace no contiene un token válido.');
  useEffect(() => {
    if (!token) return;
    void fetch(`${apiUrl}/api/auth/verify-email`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }) })
      .then(async (response) => { const data = await response.json() as { message?: string; error?: { message?: string } }; setMessage(response.ok ? data.message ?? 'Correo verificado.' : data.error?.message ?? 'No fue posible verificar.'); })
      .catch(() => setMessage('No fue posible conectar con el servicio.'));
  }, [token]);
  return <main className="token-page"><span>✦</span><h1>Verificación de correo</h1><p role="status">{message}</p><Link className="button button-primary" href="/cuenta">Ir a mi cuenta</Link></main>;
}

export function ResetPassword({ token }: { token?: string }) {
  const [message, setMessage] = useState(token ? '' : 'El enlace no contiene un token válido.');
  async function submit(formData: FormData) {
    if (!token) return;
    const response = await fetch(`${apiUrl}/api/auth/reset-password`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, password: formData.get('password') }) });
    const data = await response.json() as { message?: string; error?: { message?: string } };
    setMessage(response.ok ? data.message ?? 'Contraseña actualizada.' : data.error?.message ?? 'No fue posible actualizarla.');
  }
  return <main className="token-page"><span>✦</span><h1>Nueva contraseña</h1><p>Usa al menos 12 caracteres, mayúscula, número y símbolo.</p>{token && <form action={submit}><label>Contraseña nueva<input name="password" type="password" minLength={12} maxLength={128} required autoComplete="new-password" /></label><button className="button button-primary">Actualizar contraseña</button></form>}{message && <p role="status">{message}</p>}<Link className="text-link" href="/cuenta">Volver a mi cuenta</Link></main>;
}
