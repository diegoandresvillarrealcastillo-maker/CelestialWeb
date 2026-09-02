# Celestial Velas Artesanales

Tienda Full-Stack para el catálogo 2026 de Celestial. Incluye 22 productos extraídos de los dos catálogos suministrados, búsqueda y filtros, detalle de producto, carrito, cuentas, pedidos, panel administrativo, PostgreSQL, RLS, auditoría y hardening HTTP.

## Requisitos

- Node.js 22.13 o superior.
- PostgreSQL 15 o superior (local, administrado o Supabase).
- Un proveedor HTTP de correo para verificación y recuperación.
- HTTPS en cualquier entorno público.

## Instalación local

1. Instala dependencias: `npm ci`.
2. Copia `.env.example` como `.env` y completa únicamente en tu equipo:
   - `DATABASE_URL`: conexión PostgreSQL.
   - `IP_HASH_SECRET`: valor aleatorio de al menos 32 caracteres.
   - `WEB_ORIGIN`: orígenes web permitidos, separados por coma.
   - `PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL` y `NEXT_PUBLIC_API_URL`: URLs locales o públicas.
   - Proveedor de correo: `EMAIL_PROVIDER_URL`, `EMAIL_PROVIDER_API_KEY`, `EMAIL_FROM`.
3. Valores locales habituales: web en puerto 3000 y API en 4000. No copies secretos a variables `NEXT_PUBLIC_*`.
4. Ejecuta `npm run db:migrate` y luego `npm run db:seed`.
5. Inicia ambas superficies con `npm run dev:all`.

La API espera que el proveedor de correo acepte un `POST` JSON con `from`, `to`, `subject` y `text`, autenticado mediante Bearer. Si no se configura, la cuenta se crea pero no se envía correo; el endpoint nunca expone el token.

## Scripts

| Script | Función |
| --- | --- |
| `npm run dev:all` | Web y API en desarrollo |
| `npm run build` | Build de producción de la web |
| `npm run build:api` | Compila la API a `dist-api/` |
| `npm run typecheck` | Verificación TypeScript |
| `npm test` | Pruebas de seguridad y negocio |
| `npm run db:migrate` | Aplica migraciones pendientes con lock transaccional |
| `npm run db:seed` | Carga o actualiza los 22 productos |
| `npm run security:audit` | Auditoría npm de nivel alto |

## Catálogo

`data/catalog.ts` es la representación normalizada y trazable del catálogo. Cada registro conserva catálogo y página de origen. `scripts/extract_catalog_assets.py` extrae las fotografías incrustadas de los PDFs y las convierte a WebP; requiere Pillow y pypdf. Los campos que el material no proporciona no se inventan.

## Base de datos

La migración `migrations/001_initial.sql` crea identidades, perfiles, roles, productos, categorías, promociones, pedidos, sesiones, tokens, idempotencia y auditoría. Incluye claves foráneas, restricciones, índices y RLS. En producción usa un usuario de aplicación que no sea propietario de las tablas ni tenga `BYPASSRLS`.

Para conceder el primer administrador, realiza el cambio una sola vez con una cuenta de migración, insertando en `user_roles` el `user_id` y el rol `admin`. No expongas un endpoint de “convertirme en admin”.

## Despliegue

- Web: Cloudflare Sites/Pages, Vercel o Netlify.
- API: Render, Railway, Fly.io o un VPS con `Dockerfile.api`.
- Datos: PostgreSQL administrado o Supabase.
- Los contenedores `Dockerfile.web` y `Dockerfile.api` ejecutan como usuario sin privilegios.
- Configura secretos desde el panel del proveedor, nunca en el repositorio.
- Habilita health checks sobre `/health` y termina TLS en el proxy. La API rechaza o redirige HTTP en producción según `PUBLIC_API_URL`.
- Ejecuta migraciones como una tarea de release separada y con credenciales de migración; la aplicación debe usar una cuenta restringida.

## Operación segura

- Haz backup automático y pruebas periódicas de restauración.
- Activa protección de ramas, Dependabot/Renovate y secret scanning.
- El workflow `.github/workflows/security.yml` ejecuta build, pruebas, `npm audit` y Gitleaks.
- Si un secreto entra en Git: revócalo/rota primero, elimínalo del código, reemplázalo por variable de entorno y limpia el historial solo después de confirmar la rotación.
- No almacenes CVV ni tarjetas. La integración futura de pagos debe tokenizar con el proveedor y verificar firmas e idempotencia del webhook.

Consulta `SECURITY.md` para el modelo de amenazas y las decisiones de hardening.
