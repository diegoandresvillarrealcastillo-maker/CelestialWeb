import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { withAuthContext } from '../database/pool.js';
import { HttpError } from '../http/errors.js';
import type { AuthContext } from '../types.js';
import type { AdminService } from './contracts.js';

const columnMap: Record<string, string> = {
  slug: 'slug', name: 'name', description: 'description', priceCop: 'price_cop',
  priceMaxCop: 'price_max_cop', priceLabel: 'price_label', imagePath: 'image_path',
  dimensions: 'dimensions', weight: 'weight', colors: 'colors', fragrances: 'fragrances',
  options: 'options', features: 'features', availability: 'availability', collection: 'collection',
  featured: 'featured', popular: 'popular', active: 'active',
};

const jsonFields = new Set(['colors', 'fragrances', 'options', 'features']);

export class PostgresAdminService implements AdminService {
  constructor(private pool: Pool) {}

  async getOverview(auth: AuthContext) {
    return withAuthContext(this.pool, auth, async (client) => {
      const result = await client.query(
        `SELECT
          (SELECT count(*)::int FROM products WHERE active) AS "activeProducts",
          (SELECT count(*)::int FROM orders WHERE status = 'pending') AS "pendingOrders",
          (SELECT count(*)::int FROM users WHERE status = 'active') AS customers,
          (SELECT COALESCE(sum(total_cop), 0)::int FROM orders WHERE status IN ('confirmed','preparing','shipped','completed')) AS "confirmedRevenueCop"`,
      );
      return result.rows[0];
    });
  }

  async listOrders(auth: AuthContext) {
    return withAuthContext(this.pool, auth, async (client) => {
      const result = await client.query(
        `SELECT o.id, o.order_number AS "orderNumber", o.status, o.total_cop AS "totalCop",
                o.created_at AS "createdAt", u.email::text, p.full_name AS "customerName"
           FROM orders o JOIN users u ON u.id = o.user_id LEFT JOIN profiles p ON p.user_id = u.id
          ORDER BY o.created_at DESC LIMIT 200`,
      );
      return result.rows;
    });
  }

  async updateOrder(auth: AuthContext, orderId: string, input: unknown) {
    const status = (input as { status: string }).status;
    return withAuthContext(this.pool, auth, async (client) => {
      const result = await client.query(
        'UPDATE orders SET status = $2 WHERE id = $1 RETURNING id, order_number AS "orderNumber", status, total_cop AS "totalCop"',
        [orderId, status],
      );
      if (!result.rows[0]) throw new HttpError(404, 'Pedido no encontrado.', 'NOT_FOUND');
      await this.audit(client, auth, 'order.status_changed', 'order', orderId, { status });
      return result.rows[0];
    });
  }

  async updateProduct(auth: AuthContext, productId: string, input: unknown) {
    const entries = Object.entries(input as Record<string, unknown>).filter(([key]) => columnMap[key]);
    if (!entries.length) throw new HttpError(422, 'No hay campos permitidos para actualizar.', 'EMPTY_UPDATE');
    const values: unknown[] = [productId];
    const assignments = entries.map(([key, value], index) => {
      values.push(jsonFields.has(key) ? JSON.stringify(value) : value);
      return `${columnMap[key]} = $${index + 2}${jsonFields.has(key) ? '::jsonb' : ''}`;
    });
    return withAuthContext(this.pool, auth, async (client) => {
      const result = await client.query(
        `UPDATE products SET ${assignments.join(', ')} WHERE id = $1
         RETURNING id, slug, name, price_cop AS "priceCop", active`, values,
      );
      if (!result.rows[0]) throw new HttpError(404, 'Producto no encontrado.', 'NOT_FOUND');
      await this.audit(client, auth, 'product.updated', 'product', productId, { fields: entries.map(([key]) => key) });
      return result.rows[0];
    });
  }

  async createProduct(auth: AuthContext, input: unknown) {
    const product = input as Record<string, unknown>;
    const required = ['slug', 'name', 'description', 'priceCop', 'imagePath', 'collection'];
    if (required.some((field) => product[field] === undefined)) {
      throw new HttpError(422, 'Faltan campos obligatorios del producto.', 'VALIDATION_ERROR');
    }
    const externalId = `admin-${randomUUID()}`;
    return withAuthContext(this.pool, auth, async (client) => {
      const result = await client.query(
        `INSERT INTO products (
           external_id, slug, name, description, price_cop, price_max_cop, price_label, image_path,
           dimensions, weight, colors, fragrances, options, features, availability, collection,
           source_catalog, source_page, featured, popular, active
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb,$15,$16,$16,1,$17,$18,$19)
         RETURNING id, slug, name, price_cop AS "priceCop", active`,
        [
          externalId, product.slug, product.name, product.description, product.priceCop,
          product.priceMaxCop ?? null, product.priceLabel ?? null, product.imagePath,
          product.dimensions ?? null, product.weight ?? null, JSON.stringify(product.colors ?? []),
          JSON.stringify(product.fragrances ?? []), JSON.stringify(product.options ?? []), JSON.stringify(product.features ?? []),
          product.availability ?? 'Hecho bajo pedido', product.collection, product.featured ?? false,
          product.popular ?? false, product.active ?? true,
        ],
      );
      if (typeof product.categoryId === 'string') {
        await client.query('INSERT INTO product_categories (product_id, category_id) VALUES ($1, $2)', [result.rows[0].id, product.categoryId]);
      }
      await this.audit(client, auth, 'product.created', 'product', result.rows[0].id, { fields: Object.keys(product) });
      return result.rows[0];
    });
  }

  async deactivateProduct(auth: AuthContext, productId: string) {
    await withAuthContext(this.pool, auth, async (client) => {
      const result = await client.query('UPDATE products SET active = false WHERE id = $1 RETURNING id', [productId]);
      if (!result.rows[0]) throw new HttpError(404, 'Producto no encontrado.', 'NOT_FOUND');
      await this.audit(client, auth, 'product.deactivated', 'product', productId, {});
    });
  }

  async listCategories(auth: AuthContext) {
    return withAuthContext(this.pool, auth, async (client) => {
      const result = await client.query('SELECT id, slug, name, description, active, sort_order AS "sortOrder" FROM categories ORDER BY sort_order, name');
      return result.rows;
    });
  }

  async createCategory(auth: AuthContext, rawInput: unknown) {
    const input = rawInput as { slug: string; name: string; description?: string | null; active: boolean; sortOrder: number };
    return withAuthContext(this.pool, auth, async (client) => {
      const result = await client.query(
        `INSERT INTO categories (slug, name, description, active, sort_order)
         VALUES ($1,$2,$3,$4,$5) RETURNING id, slug, name, description, active, sort_order AS "sortOrder"`,
        [input.slug, input.name, input.description ?? null, input.active, input.sortOrder],
      );
      await this.audit(client, auth, 'category.created', 'category', result.rows[0].id, { name: input.name });
      return result.rows[0];
    });
  }

  async updateCategory(auth: AuthContext, categoryId: string, rawInput: unknown) {
    const input = rawInput as { slug: string; name: string; description?: string | null; active: boolean; sortOrder: number };
    return withAuthContext(this.pool, auth, async (client) => {
      const result = await client.query(
        `UPDATE categories SET slug=$2, name=$3, description=$4, active=$5, sort_order=$6 WHERE id=$1
         RETURNING id, slug, name, description, active, sort_order AS "sortOrder"`,
        [categoryId, input.slug, input.name, input.description ?? null, input.active, input.sortOrder],
      );
      if (!result.rows[0]) throw new HttpError(404, 'Categoría no encontrada.', 'NOT_FOUND');
      await this.audit(client, auth, 'category.updated', 'category', categoryId, { name: input.name, active: input.active });
      return result.rows[0];
    });
  }

  async listPromotions(auth: AuthContext) {
    return withAuthContext(this.pool, auth, async (client) => {
      const result = await client.query(
        `SELECT id, name, code::text, kind, configuration, starts_at AS "startsAt", ends_at AS "endsAt", active
           FROM promotions ORDER BY created_at DESC`,
      );
      return result.rows;
    });
  }

  async createPromotion(auth: AuthContext, rawInput: unknown) {
    const input = rawInput as { name: string; code?: string | null; kind: string; configuration: object; startsAt?: string | null; endsAt?: string | null; active: boolean };
    return withAuthContext(this.pool, auth, async (client) => {
      const result = await client.query(
        `INSERT INTO promotions (name, code, kind, configuration, starts_at, ends_at, active)
         VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7)
         RETURNING id, name, code::text, kind, configuration, starts_at AS "startsAt", ends_at AS "endsAt", active`,
        [input.name, input.code ?? null, input.kind, JSON.stringify(input.configuration), input.startsAt ?? null, input.endsAt ?? null, input.active],
      );
      await this.audit(client, auth, 'promotion.created', 'promotion', result.rows[0].id, { name: input.name, active: input.active });
      return result.rows[0];
    });
  }

  async updatePromotion(auth: AuthContext, promotionId: string, rawInput: unknown) {
    const input = rawInput as { name: string; code?: string | null; kind: string; configuration: object; startsAt?: string | null; endsAt?: string | null; active: boolean };
    return withAuthContext(this.pool, auth, async (client) => {
      const result = await client.query(
        `UPDATE promotions SET name=$2, code=$3, kind=$4, configuration=$5::jsonb, starts_at=$6, ends_at=$7, active=$8 WHERE id=$1
         RETURNING id, name, code::text, kind, configuration, starts_at AS "startsAt", ends_at AS "endsAt", active`,
        [promotionId, input.name, input.code ?? null, input.kind, JSON.stringify(input.configuration), input.startsAt ?? null, input.endsAt ?? null, input.active],
      );
      if (!result.rows[0]) throw new HttpError(404, 'Promoción no encontrada.', 'NOT_FOUND');
      await this.audit(client, auth, 'promotion.updated', 'promotion', promotionId, { name: input.name, active: input.active });
      return result.rows[0];
    });
  }

  private async audit(client: { query: Pool['query'] }, auth: AuthContext, action: string, resourceType: string, resourceId: string, metadata: object) {
    await client.query(
      'INSERT INTO audit_logs (actor_user_id, action, resource_type, resource_id, metadata) VALUES ($1, $2, $3, $4, $5::jsonb)',
      [auth.userId, action, resourceType, resourceId, JSON.stringify(metadata)],
    );
  }
}
