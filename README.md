# Celestial Velas Artesanales

Tienda Full-Stack para el catálogo de Celestial: 22 productos trazables a los catálogos suministrados, compra como invitado, confirmación por WhatsApp, carga privada de comprobantes y panel exclusivo para dos administradores. No existen cuentas, registro ni inicio de sesión para clientes.

## Arquitectura soportada

- **Web:** Next.js en Vercel.
- **API:** Node.js + Express en Render.
- **Datos y archivos:** PostgreSQL y Storage de Supabase.
- **Administración:** exactamente dos cuentas locales con contraseña, aprovisionadas por consola. El arranque de producción falla si hay más o menos de dos administradores válidos.

## Instalación local

Requiere Node.js 22.13+ y PostgreSQL 15+.

1. Ejecuta `npm ci`.
2. Copia `.env.example` a `.env` y completa valores locales. Nunca pongas secretos en variables `NEXT_PUBLIC_*`.
3. Ejecuta `npm run db:migrate`, `npm run db:seed` y, si tu usuario PostgreSQL puede crear bases temporales, `npm run db:verify`.
4. Inicia web y API con `npm run dev:all`.

Para probar el panel localmente, crea las dos cuentas con `npm run admin:provision`, pasando `ADMIN_EMAIL`, `ADMIN_FULL_NAME` y `ADMIN_PASSWORD` solo al proceso de aprovisionamiento. No las dejes guardadas en Render ni en `.env`.

## Scripts

| Script | Función |
| --- | --- |
| `npm run dev:all` | Web y API en desarrollo |
| `npm run typecheck` / `npm run lint` | Validación estática |
| `npm test` | Pruebas de seguridad y negocio |
| `npm run build` / `npm run build:api` | Builds de producción |
| `npm run db:migrate` | Aplica migraciones serializadas con advisory lock |
| `npm run db:seed` | Reconcilia el catálogo de 22 productos |
| `npm run db:verify` | Prueba migraciones concurrentes, seed idempotente, RLS y restricciones en una base temporal |
| `npm run admin:provision` | Crea o actualiza uno de los dos administradores |
| `npm run security:audit` | Auditoría npm de nivel alto |

## Variables por plataforma

**Vercel:** `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WHATSAPP_NUMBER`, `PUBLIC_API_URL`, `HEALTHCHECK_SECRET` y `CRON_SECRET`. `CRON_SECRET` protege automáticamente la llamada programada de Vercel y no se comparte con el navegador.

**Render:** `DATABASE_URL`, `DATABASE_SSL`, `DATABASE_CA_CERT` si aplica, `WEB_ORIGIN`, `PUBLIC_API_URL`, `IP_HASH_SECRET`, `ORDER_TOKEN_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WHATSAPP_NUMBER`, `HEALTHCHECK_SECRET`, variables del proveedor de correo y `EXPECTED_ADMIN_COUNT=2`.

`HEALTHCHECK_SECRET` debe ser el mismo en Vercel y Render. `WEB_ORIGIN` debe contener únicamente los orígenes HTTPS reales de Vercel. Los números públicos y privados de WhatsApp deben representar el mismo destino.

## Base de datos y despliegue

Ejecuta migraciones y seed con una credencial propietaria/de migración. Luego configura la API con un rol `celestial_app` que tenga `LOGIN`, no sea propietario, no sea superusuario y no posea `BYPASSRLS`. Las migraciones 006–013 revocan privilegios genéricos, restringen el rol y fortalecen RLS; el arranque de producción comprueba además que el esquema esté actualizado.

Secuencia de release recomendada:

1. Crear backup/exportación verificable.
2. Desplegar migraciones con la credencial de migración.
3. Ejecutar seed.
4. Aprovisionar exactamente dos administradores.
5. Cambiar `DATABASE_URL` de Render al rol restringido `celestial_app`.
6. Desplegar la API y validar `/health`.
7. Desplegar la web y validar `/api/health` desde Vercel.

La migración 010 elimina cachés de idempotencia antiguos que podían contener credenciales de pedido. Realiza ese release en una ventana sin checkouts en curso.

## Flujo de compra

El servidor consulta productos activos, valida opciones, rechaza productos “solo cotización”, bloquea precios y calcula totales dentro de una transacción. Al confirmar, guarda el pedido y devuelve un enlace oficial `wa.me`; el navegador conserva durante 24 horas, solo en la pestaña, el token que permite consultar ese pedido. El token en claro no se guarda en PostgreSQL.

El cliente no debe transferir hasta que un administrador confirme el envío. Solo entonces aparecen instrucciones de pago y se habilita el comprobante. Los comprobantes usan firmas de archivo reales y un bucket privado; el panel recibe una URL firmada de cinco minutos.

Las promociones son borradores inactivos: el esquema y la API impiden activarlas hasta que exista cálculo de descuentos auditado en el servidor.

## Operación

Vercel llama diariamente a `/api/health`, que reenvía una solicitud protegida a `/health/database`; la comprobación ejecuta exactamente `SELECT 1`. Es una ayuda de disponibilidad, no una garantía contractual contra la pausa del plan gratuito de Supabase. El plan gratuito tampoco ofrece backups automáticos: programa exportaciones manuales verificadas o usa un plan con backups.

El directorio personal `Claude outputs/`, archivos `.env` y artefactos locales están ignorados para reducir el riesgo de publicar información privada. Si un secreto entra en Git, revócalo primero y limpia el historial después.

Consulta `SECURITY.md` y `docs/ARCHITECTURE.md` antes de publicar.
