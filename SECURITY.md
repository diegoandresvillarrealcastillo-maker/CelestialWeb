# Seguridad

Este documento describe el estado real de la aplicación en producción, incluyendo
lo que falta. No es un reporte de auditoría de terceros; se actualiza a mano cada
vez que cambia un control de seguridad relevante.

## Autenticación y sesiones

- **Contraseñas**: Argon2id (19 MiB, 2 iteraciones, paralelismo 1), 12-128 caracteres
  con requisitos de complejidad. Nunca se registran ni se devuelven.
- **Login**: mensaje genérico, verificación de tiempo comparable con hash señuelo
  cuando el usuario no existe, límite por IP, contador persistente y bloqueo
  progresivo (15 min a 5 fallos, 60 min a 10).
- **Cookie de sesión**: token aleatorio opaco; solo su SHA-256 se guarda en
  PostgreSQL. `HttpOnly` siempre; `Secure` en producción; `SameSite=None` en
  producción (el frontend en Cloudflare Workers y la API en Render son dominios
  distintos, así que `Lax` nunca habría enviado la cookie en las peticiones del
  sitio — con `None` se depende íntegramente de `Secure` + CORS + verificación de
  `Origin` para que un tercero no pueda aprovecharla); `Lax` en desarrollo local.
  Expira a las 24 h (configurable) y se invalida en logout y cambio de contraseña.
- **Rol de administrador**: se asigna **exclusivamente** con una actualización
  directa en base de datos (`user_roles`). Ningún endpoint público puede otorgarlo:
  el registro y el login no aceptan ni derivan un campo `role`, y no existe (ni debe
  reintroducirse) una lista de correos que auto-promueva a admin — permitía que
  cualquiera se registrara con un correo "admin" sin haberlo verificado y obtuviera
  el rol de inmediato.
- **Google Sign-In**: el token de Google se verifica con `google-auth-library`. Las
  cuentas se buscan primero por `sub` (identificador estable), no por email — así
  un cambio de correo en Google no rompe ni suplanta la cuenta. Vincular un `sub`
  nuevo a una cuenta local existente exige `email_verified=true` de Google; si el
  correo ya está vinculado a un `sub` distinto, se rechaza en vez de re-vincular en
  silencio (evita takeover por reutilización de correo).

## CSRF / CORS / Origen

- Token CSRF ligado a la sesión, comparación de tiempo constante, verificado en
  toda escritura autenticada.
- CORS con allowlist explícita (`WEB_ORIGIN`); nunca `*` con credenciales.
- Verificación adicional de `Origin` en todo método no seguro (`originGuard`),
  independiente de la librería CORS.
- La redirección HTTP→HTTPS del API normaliza la ruta para impedir un open
  redirect vía `//host-externo/...`.

## Autorización

- Rol obtenido siempre en servidor a partir de la sesión, nunca de la petición.
- `role`, `userId`, `price`, `discount`, `total` nunca se aceptan del navegador
  (Zod estricto + mapa explícito de columnas en las actualizaciones admin).
- Pedidos de usuarios autenticados: ownership explícito (`WHERE user_id = $2`) en
  cada consulta.
- Pedidos de invitado: no requieren cuenta, pero adjuntar un comprobante exige el
  UUID del pedido **y** un token de un solo uso emitido al crear el pedido (solo
  su SHA-256 se guarda). Antes de esto, conocer el UUID bastaba para subir o
  reemplazar el comprobante de cualquier pedido de invitado.

## RLS (Row-Level Security)

RLS está habilitado en las tablas sensibles y las políticas existen (propietario
para pedidos/perfiles, admin para catálogo/roles/promociones/auditoría). **Dicho
esto, RLS aquí es defensa en profundidad, no el límite principal**: la conexión
de la API a Supabase probablemente usa el rol `postgres` por defecto del proyecto,
que tiene `BYPASSRLS`. Si es así, las políticas no se están evaluando en
producción — la protección real hoy viene de los `WHERE` explícitos en cada
consulta del backend. Pendiente: crear un rol de aplicación sin `BYPASSRLS` con
privilegios mínimos (`SELECT/INSERT/UPDATE/DELETE` solo en las tablas necesarias)
y mover `DATABASE_URL` a ese rol, probando cada flujo antes de confirmar el
cambio en producción.

## Archivos subidos

Hay tres superficies de subida: imágenes de producto y del QR de pago (admin) y
comprobantes de pago (clientes/invitados). Todas usan `multer` en memoria,
límite de 5 MB, y se guardan en Supabase Storage con nombre aleatorio (no el
nombre original). **Limitación conocida**: el tipo de archivo se valida por el
`Content-Type` que envía el navegador, no por los bytes reales del archivo — un
atacante podría subir un archivo distinto disfrazado de imagen. Los comprobantes
van a un bucket privado servido solo por URL firmada de corta duración; las
imágenes de producto van a un bucket público (es su propósito).

## Cabeceras / navegador

Helmet, CSP restrictiva en el API (`default-src 'none'`), HSTS solo en
producción, `nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` y
`frame-ancestors 'none'`. React escapa todo texto; no se interpreta HTML de
usuarios.

## Abuso

Límites de tasa independientes para login, registro, recuperación, búsqueda,
pedidos y administración. Honeypot en formularios públicos. Cloudflare Turnstile
disponible para el flujo de registro (hoy sin interfaz pública, ver más abajo).

## Auditoría

Cambios de producto, pedido, categoría, promoción y configuración de pago
registran actor, acción, recurso, fecha y metadatos mínimos — nunca secretos ni
cuerpos completos de la petición.

## Riesgos residuales conocidos (sin resolver)

- **RLS bypass probable**: ver sección RLS arriba. Requiere cambiar la credencial
  de base de datos en un momento de bajo tráfico, con pruebas completas de cada
  flujo antes de confirmar.
- **Validación de archivos por MIME declarado**, no por contenido real.
- **Registro público** (`POST /api/auth/register`) sigue activo en el backend
  aunque no tiene interfaz — solo crea cuentas `customer`, nunca admin, pero si no
  se va a usar debería cerrarse o mantenerse solo por si se reactiva el registro
  de clientes.
- **Promociones** (`/api/admin/promotions`) se pueden crear y activar desde el
  panel, pero el proceso de checkout no las aplica todavía a ningún pedido.

## Reporte de vulnerabilidades

No abras un issue público con un secreto o una prueba explotable. Envía un
reporte privado al responsable del repositorio con impacto, pasos mínimos y
versión afectada. Revoca inmediatamente cualquier credencial expuesta antes de
modificar el historial Git.
