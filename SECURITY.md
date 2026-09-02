# Seguridad

## Controles implementados

- **Contraseñas**: Argon2id (19 MiB, 2 iteraciones, paralelismo 1), longitud 12-128 y requisitos de complejidad. Nunca se registran ni se devuelven.
- **Sesiones**: token aleatorio opaco; PostgreSQL conserva SHA-256. Cookie `HttpOnly`, `SameSite=Lax`, `Secure` en producción, expiración de 24 horas configurable e invalidación en logout/cambio de contraseña.
- **Login**: mensaje genérico, verificación de tiempo comparable con hash señuelo, límite por IP, contador persistente, bloqueo progresivo a 15 y 60 minutos e IP/cuenta seudonimizadas con HMAC.
- **CSRF/CORS**: token asociado a sesión, comparación de tiempo constante, comprobación de `Origin` y allowlist CORS. No existe `Access-Control-Allow-Origin: *` con credenciales.
- **Autorización**: rol obtenido en servidor, middleware administrativo, ownership explícito en pedidos y RLS como segunda barrera. No se aceptan `role`, `userId`, `price`, `discount` ni `total` del navegador.
- **Datos**: Zod en servidor, objetos estrictos contra mass assignment, SQL parametrizado, constraints e índices. Los pedidos bloquean productos y recalculan sus líneas con precios de PostgreSQL.
- **Navegador/API**: Helmet, CSP, HSTS solo en producción, `nosniff`, política de referencia, Permissions Policy y `frame-ancestors 'none'`. React escapa texto; no se admite HTML de usuarios.
- **Abuso**: límites independientes para autenticación, recuperación, búsqueda, pedidos y administración; honeypot en formularios públicos.
- **Auditoría**: cambios de producto, pedido, categoría y promoción registran actor, acción, recurso, fecha y metadatos mínimos. No se guardan secretos ni cuerpos completos.
- **Archivos**: esta versión no ofrece subida de archivos. Las imágenes administrativas deben referenciar rutas estáticas ya revisadas; por eso no hay una superficie de upload que pueda aceptar SVG/HTML o rutas arbitrarias.

## CSP web

La API usa una CSP sin scripts, formularios ni objetos. La web permite `unsafe-inline` exclusivamente en `script-src` y `style-src` por la hidratación y estilos generados por el runtime Next/Vinext; no permite `unsafe-eval`, orígenes comodín, objetos ni framing. Antes de incorporar scripts de terceros, migra a nonce por respuesta y añade solo el dominio exacto necesario.

## RLS

RLS está habilitado en todas las tablas sensibles. El backend establece `app.user_id`, `app.user_role` y, durante autenticación, un hash de sesión o token dentro de la transacción. Los pedidos y perfiles se limitan al propietario; escritura de catálogo, roles, promociones y auditoría exige administrador. No hay políticas `USING (true)` para información sensible.

RLS no sustituye la autorización de Express. La cuenta de producción no debe ser propietaria de las tablas ni tener `BYPASSRLS`; las migraciones usan una cuenta distinta.

## Auditoría OWASP final

| Severidad inicial | Hallazgo | Estado |
| --- | --- | --- |
| ALTA | 12 avisos de dependencias en el scaffolding (Next, RSC, Vite, Vinext y Cloudflare) | Corregidos mediante versiones compatibles; `npm audit` final: 0 |
| ALTA | Riesgo de IDOR en pedidos si se consultaba solo por identificador | Corregido con propietario en consulta, servicio y RLS; prueba Usuario B → pedido de A devuelve 404 |
| ALTA | Manipulación de precio/total desde DevTools | Corregido: esquema rechaza esos campos y PostgreSQL recalcula en transacción |
| MEDIA | CSRF en sesiones por cookie | Corregido con token por sesión, Origin y SameSite |
| MEDIA | Mass assignment administrativo | Corregido con Zod estricto y mapa explícito de columnas |
| MEDIA | Enumeración y fuerza bruta en login/recuperación | Corregido con mensajes genéricos, rate limit y bloqueo progresivo |
| BAJA | Dependencia de `unsafe-inline` por runtime web | Aceptada y documentada; sin `unsafe-eval`, terceros ni HTML de usuario |

No quedaron hallazgos CRÍTICOS ni ALTOS abiertos en la revisión automatizada. La integración de pagos y uploads no está activa; cuando se añadan, exige firma de webhook, idempotencia, MIME real, límites de tamaño y almacenamiento no ejecutable.

## Reporte de vulnerabilidades

No abras un issue público con un secreto o una prueba explotable. Envía un reporte privado al responsable del repositorio con impacto, pasos mínimos y versión afectada. Revoca inmediatamente cualquier credencial expuesta antes de modificar el historial Git.
