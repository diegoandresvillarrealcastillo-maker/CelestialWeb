# Arquitectura de Celestial

## Componentes

1. **Web Next.js / Vercel:** catálogo, carrito, checkout invitado, consulta de pedido y panel administrativo. No decide precios ni permisos.
2. **API Express / Render:** autenticación de dos administradores, CSRF/RBAC, reglas de pedido, archivos, auditoría y adaptadores externos.
3. **PostgreSQL + Storage / Supabase:** fuente de verdad, RLS, migraciones y objetos públicos/privados.

```text
Navegador ──HTTPS──> Vercel (Next.js)
    │                       │ cron diario + secreto
    └──────HTTPS────────> Render (Express) ──TLS/RLS──> Supabase
                                  │
                                  ├── enlace wa.me después del commit
                                  └── proveedor HTTP de correo (solo admins)
```

## Confianzas y límites

- El navegador no es autoridad para precio, total, rol, estado ni propiedad.
- Render guarda los secretos. Vercel solo recibe variables públicas y los secretos necesarios para el proxy de salud.
- `celestial_app` es el rol de ejecución de la API. Una credencial propietaria separada ejecuta migraciones, seed y aprovisionamiento.
- La API establece contexto transaccional para RLS. Restricciones, claves foráneas, estados y permisos de esquema repiten las reglas críticas.

## Pedido invitado

```text
Carrito canónico
  → clave de idempotencia por huella SHA-256
  → transacción: productos activos + opciones + precios + filas bloqueadas
  → pedido confirmado en PostgreSQL
  → token HMAC entregado al navegador, solo hash en DB
  → enlace wa.me
  → admin confirma costo de envío
  → cliente consulta estado y carga comprobante
  → admin verifica pago y avanza el pedido
```

Los productos `requires_consultation` no entran al carrito. Las promociones existen como borradores, pero una restricción impide activarlas. Los snapshots de nombre/precio en `order_items` preservan el historial.

## Administración

El backend resuelve la sesión y rol desde PostgreSQL. Cookie opaca, CSRF y comprobación de origen protegen escrituras. El panel sondea pedidos únicamente cuando la pestaña es visible, sin solicitudes solapadas, y limpia datos sensibles ante 401/403.

La máquina de estados permite avanzar, no saltar: `pending → confirmed → preparing → shipped → completed`, con cancelación desde estados no terminales. Preparar, enviar o completar requiere pago verificado.

## Operación y salud

`GET /health` prueba vida del proceso sin tocar la base. El cron diario de Vercel llama a su `/api/health`, que presenta `HEALTHCHECK_SECRET` a `GET /health/database`; este último ejecuta exactamente `SELECT 1`. Así una caída de PostgreSQL no reinicia ciegamente la API, pero queda detectada por la comprobación programada.

Las migraciones usan advisory lock de sesión, revalidan dentro del lock y desactivan los timeouts de consulta del pool de aplicación. `db:verify` crea una base temporal con nombre aleatorio, prueba dos migradores concurrentes, seed idempotente, RLS y restricciones, y elimina exclusivamente esa base.

## Datos principales

- `users`, `profiles`, `roles`, `user_roles`, `sessions`, `password_reset_tokens`: identidad administrativa.
- `categories`, `products`, `product_images`, `product_categories`: catálogo.
- `orders`, `order_items`, `idempotency_keys`: checkout y continuidad invitada.
- `payment_settings`, `promotions`, `audit_logs`: operación administrativa.

## Decisiones externas

- **WhatsApp:** enlace oficial `wa.me`; sin costo de API y sin dependencia de plantillas. El pedido se confirma antes de generar el enlace.
- **Notificaciones:** polling ligero de 30 segundos en el panel visible; no requiere infraestructura push.
- **Salud:** cron diario, compatible con límites de Vercel Hobby. No se considera sustituto de uptime monitoring.
- **Archivos:** Supabase Storage; catálogo público y comprobantes privados con firma temporal.
