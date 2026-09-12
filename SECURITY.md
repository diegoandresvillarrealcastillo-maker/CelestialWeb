# Seguridad

Este documento refleja los controles presentes en el código. No sustituye una auditoría externa ni asesoría legal.

## Identidad administrativa

- Los clientes compran como invitados; no existen endpoints públicos de registro, Google Sign-In ni cuentas de cliente.
- Solo el panel `/admin/acceso` permite iniciar sesión, recuperar contraseña y editar el perfil.
- Producción exige exactamente dos usuarios activos con contraseña y rol `admin`; cualquier cuenta adicional o configuración incompleta bloquea el arranque.
- Las contraseñas se procesan con Argon2id. El login usa error genérico, hash señuelo, límite por IP y bloqueo progresivo por cuenta.
- La cookie contiene un token opaco; PostgreSQL guarda solo SHA-256. Es `HttpOnly`, `Secure` en producción y `SameSite=None` cuando web y API están en sitios distintos.
- Toda escritura autenticada exige token CSRF ligado a sesión y un `Origin` incluido en `WEB_ORIGIN`.

## Autorización y RLS

- Rol, identidad, precios, descuentos y totales se derivan en servidor. Las entradas usan Zod estricto y SQL parametrizado.
- La API de producción debe conectarse como `celestial_app`, sin propiedad de tablas, superusuario ni `BYPASSRLS`; el proceso se niega a iniciar si detecta lo contrario.
- RLS está forzado en tablas sensibles. Los pedidos de invitado y sus líneas se enlazan a hashes por solicitud; las políticas impiden cruzar pedidos aun con UUID conocidos.
- Cualquier persona que obtenga `DATABASE_URL` conserva poder directo sobre la aplicación. RLS reduce errores de consulta, pero no sustituye rotación de secretos, allowlists de red ni un gestor de secretos.

## Pedidos e idempotencia

- El servidor bloquea filas de producto y recalcula el total. Los productos con precio ambiguo se marcan `requires_consultation` y solo llevan a WhatsApp.
- La huella de idempotencia incluye el pedido canónico completo. Reintentar la misma solicitud devuelve el mismo pedido; cambiar datos genera otra clave.
- El token de invitado se deriva mediante HMAC con `ORDER_TOKEN_SECRET`; solo se persiste su hash. La respuesta cacheada nunca contiene `guestToken` ni `whatsappUrl`.
- El endpoint de consulta de invitado devuelve 404 tanto para pedido inexistente como para token inválido, evitando enumeración.
- Los estados avanzan únicamente por la máquina permitida. Envío confirmado es obligatorio antes de cargar un comprobante y pago verificado antes de preparar, despachar o completar.

## Archivos

- Imágenes JPEG, PNG y WebP se validan por bytes mágicos, no por el `Content-Type` declarado; límite de 5 MB y nombres aleatorios.
- Comprobantes y QR se validan antes de contactar Storage, evitando archivos huérfanos por entradas inválidas.
- Los comprobantes permanecen en bucket privado y el administrador recibe URLs firmadas de cinco minutos. Las imágenes de catálogo son públicas por diseño.
- El navegador no interpreta HTML de usuarios. Next/React escapa texto y las cabeceras aplican CSP, HSTS, `nosniff`, política de referencia, permisos y bloqueo de frames.

## Abuso, auditoría y privacidad

- Hay límites independientes para login, recuperación, pedidos, consulta de invitado y administración, además de honeypot en checkout.
- Cambios administrativos relevantes registran actor, acción, recurso y metadatos mínimos; no registran contraseñas, tokens ni cuerpos completos.
- Las respuestas y logs no incluyen secretos de sesión/pedido. Datos de checkout viajan exclusivamente por HTTPS en producción.
- No se almacenan tarjetas ni CVV. La transferencia se coordina fuera de la aplicación y solo se conserva el comprobante necesario para validarla.

## Riesgos residuales conocidos

- La CSP de Next.js conserva `'unsafe-inline'` para estilos/scripts requeridos por el framework. Evita introducir HTML arbitrario y revisa esta excepción al cambiar la estrategia de renderizado.
- El cron diario de Vercel y el plan gratuito de Supabase no garantizan disponibilidad continua. Se requiere monitoreo externo y un plan adecuado si la disponibilidad es crítica.
- Supabase Free no aporta backups automáticos. Mantén exportaciones cifradas y prueba restauración, o contrata backups administrados.
- WhatsApp usa `wa.me`, que es económico y simple, pero la entrega/lectura no es auditable desde el servidor. El panel complementa esto con sondeo de pedidos nuevos.
- El correo depende de un proveedor HTTP genérico; recuperación de contraseña no enviará mensajes si sus variables no están configuradas.
- Las promociones permanecen forzosamente inactivas hasta implementar descuentos en el cálculo transaccional.
- Los archivos personales ignorados por Git todavía existen en el equipo. Deben mantenerse fuera del repositorio y de cualquier paquete de despliegue.

## Respuesta a incidentes

No publiques secretos ni pruebas explotables en issues. Revoca primero toda credencial expuesta, revisa logs y sesiones, corrige la causa y solo después limpia el historial. Reporta de forma privada el impacto, versión y pasos mínimos de reproducción.
