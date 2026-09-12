'use client';

import { useState } from 'react';

export function PasswordField({
  name, required, minLength, maxLength, autoComplete,
}: { name: string; required?: boolean; minLength?: number; maxLength?: number; autoComplete?: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-field">
      <input name={name} type={visible ? 'text' : 'password'} required={required} minLength={minLength} maxLength={maxLength} autoComplete={autoComplete} />
      <button type="button" className="password-toggle" onClick={() => setVisible((value) => !value)} aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
        {visible ? (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
            <path d="M3 3l18 18" />
          </svg>
        )}
      </button>
    </div>
  );
}
