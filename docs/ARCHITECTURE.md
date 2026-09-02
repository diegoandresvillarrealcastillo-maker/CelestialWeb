# Arquitectura de Celestial

## Objetivo y límites

Celestial se divide en tres superficies desplegables y sustituibles:

1. **Web**: aplicación Next/Vinext accesible y responsive. Renderiza el catálogo público, pero nunca decide precios, permisos ni estados de pedidos.
2. **API**: servicio Node.js + Express bajo `/api`. Valida entradas, autentica sesiones, aplica RBAC y propiedad de recursos, recalcula pedidos y registra auditoría.
3. **Datos**: PostgreSQL como fuente de verdad. Migraciones SQL reproducibles, consultas parametrizadas y RLS como segunda barrera de autorización.

Las imágenes son archivos estáticos optimizados. La columna `image_path` permite migrarlas a almacenamiento de objetos sin cambiar el dominio de productos.

## Flujo de seguridad

- El navegador recibe únicamente una cookie de sesión opaca, aleatoria, `HttpOnly`, `Secure` en producción y `SameSite=Lax`.
- La base de datos guarda SHA-256 del token de sesión, nunca el token original.
- Las operaciones mutables exigen además un token CSRF asociado a la sesión y validación de `Origin`.
- Las contraseñas se procesan con Argon2id; los requisitos y límites se validan también en servidor.
- El rol y el usuario efectivo se obtienen de la sesión. Nunca se aceptan `role`, `isAdmin`, `userId`, `price`, `discount` o `total` como autoridad del cliente.
- Cada pedido consulta productos activos dentro de una transacción, bloquea sus filas, toma precios vigentes y calcula subtotal, descuentos y total en servidor.
- Las consultas de recursos de usuario incluyen siempre su propietario; RLS repite ese control mediante contexto de transacción.
- Los cambios administrativos relevantes generan un registro de auditoría sin secretos ni cuerpos de solicitudes.

## Módulos de la API

```text
server/
├── app.ts                 # composición de Express
├── server.ts              # proceso HTTP y cierre ordenado
├── config/                # variables de entorno tipadas
├── database/              # pool, transacciones y contexto RLS
├── middleware/            # sesión, CSRF, RBAC, errores, límites
├── repositories/          # SQL parametrizado
├── routes/                # auth, catálogo, pedidos y administración
├── services/              # reglas de negocio y adaptadores de correo
├── security/              # tokens, hashing y comparación segura
└── validators/            # esquemas Zod y listas permitidas
```

## Modelo de datos

- `users`, `profiles`, `roles`, `user_roles`: identidad y RBAC sin duplicar datos de perfil.
- `categories`, `products`, `product_images`, `product_categories`: catálogo y relaciones de clasificación.
- `promotions`: reglas promocionales administrables, inactivas por defecto.
- `orders`, `order_items`: pedido y líneas con snapshot de nombre/precio para conservar el historial.
- `sessions`, `email_verification_tokens`, `password_reset_tokens`: credenciales revocables y de expiración corta.
- `audit_logs`: trazabilidad administrativa.
- `idempotency_keys`: evita duplicación futura de checkout y webhooks.

## Despliegue recomendado

- Web: Cloudflare Pages/Sites, Vercel o Netlify.
- API: Render, Railway, Fly.io o VPS detrás de HTTPS.
- Datos: PostgreSQL administrado o Supabase. El backend utiliza `DATABASE_URL`; no importa APIs específicas del proveedor.
- En producción, web y API deben compartir un dominio de sitio o una lista CORS explícita. HSTS se activa solo tras verificar HTTPS de extremo a extremo.

## Amenazas principales consideradas

- Control de acceso roto e IDOR: propiedad en consultas, middleware y RLS.
- Inyección: Zod, listas permitidas y parámetros de `pg`.
- XSS: React escapa texto, CSP restrictiva y ausencia de HTML arbitrario.
- CSRF: cookie `SameSite`, token por sesión y comprobación de origen.
- Fuerza bruta: límites distintos por IP/cuenta, contador persistente y bloqueo temporal.
- Manipulación de precios: recálculo transaccional desde PostgreSQL.
- Filtración de secretos: entorno validado, `.env` ignorado y ejemplos sin valores.
- Duplicación de pagos: claves de idempotencia y diseño de webhook con firma verificable.
