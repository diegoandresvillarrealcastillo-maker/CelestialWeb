import type { Pool } from 'pg';
import type { ProductService } from './contracts.js';

const selectProduct = `
  SELECT p.id, p.external_id AS "externalId", p.slug, p.name, p.description,
         p.price_cop AS "priceCop", p.price_max_cop AS "priceMaxCop", p.price_label AS "priceLabel",
         p.image_path AS image, p.dimensions, p.weight, p.colors, p.fragrances, p.options, p.features,
         p.availability, p.collection, p.featured, p.popular, p.reference_image AS "referenceImage",
         COALESCE(array_agg(DISTINCT c.name) FILTER (WHERE c.name IS NOT NULL), '{}'::text[]) AS categories,
         COALESCE(jsonb_agg(DISTINCT jsonb_build_object('path', pi.image_path, 'alt', pi.alt_text, 'order', pi.sort_order))
           FILTER (WHERE pi.id IS NOT NULL), '[]'::jsonb) AS images
    FROM products p
    LEFT JOIN product_categories pc ON pc.product_id = p.id
    LEFT JOIN categories c ON c.id = pc.category_id
    LEFT JOIN product_images pi ON pi.product_id = p.id
`;

export class PostgresProductService implements ProductService {
  constructor(private pool: Pool) {}

  async list(query: Record<string, unknown>) {
    const values: unknown[] = [];
    const conditions = ['p.active = true'];
    const add = (value: unknown) => { values.push(value); return `$${values.length}`; };

    if (query.search) {
      const parameter = add(`%${query.search}%`);
      conditions.push(`(p.name ILIKE ${parameter} OR p.description ILIKE ${parameter} OR EXISTS (
        SELECT 1 FROM product_categories spc JOIN categories sc ON sc.id = spc.category_id
        WHERE spc.product_id = p.id AND sc.name ILIKE ${parameter}
      ))`);
    }
    if (query.category) {
      const parameter = add(query.category);
      conditions.push(`EXISTS (SELECT 1 FROM product_categories fpc JOIN categories fc ON fc.id = fpc.category_id
        WHERE fpc.product_id = p.id AND fc.slug = ${parameter})`);
    }
    if (query.collection) conditions.push(`p.collection = ${add(query.collection)}`);
    if (query.minPrice !== undefined) conditions.push(`p.price_cop >= ${add(query.minPrice)}`);
    if (query.maxPrice !== undefined) conditions.push(`p.price_cop <= ${add(query.maxPrice)}`);

    const orderBy = {
      popular: 'p.popular DESC, p.featured DESC, p.name ASC',
      'price-asc': 'p.price_cop ASC, p.name ASC',
      'price-desc': 'p.price_cop DESC, p.name ASC',
      newest: 'p.created_at DESC, p.name ASC',
    }[String(query.sort)] ?? 'p.popular DESC, p.name ASC';
    const limit = add(query.limit ?? 48);

    const result = await this.pool.query(
      `${selectProduct}
       WHERE ${conditions.join(' AND ')}
       GROUP BY p.id
       ORDER BY ${orderBy}
       LIMIT ${limit}`,
      values,
    );
    return result.rows;
  }

  async getBySlug(slug: string) {
    const result = await this.pool.query(
      `${selectProduct} WHERE p.slug = $1 AND p.active = true GROUP BY p.id LIMIT 1`,
      [slug],
    );
    return result.rows[0] ?? null;
  }
}
