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
        {visible ? '🙈' : '👁️'}
      </button>
    </div>
  );
}
