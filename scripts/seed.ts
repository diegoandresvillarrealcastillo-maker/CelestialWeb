import { products } from '../data/catalog.js';
import { loadEnv } from '../server/config/env.js';
import { createPool, inTransaction } from '../server/database/pool.js';

const categorySlugs: Record<string, string> = {
  'Velas aromáticas': 'velas-aromaticas', 'Wax melts': 'wax-melts', Bouquets: 'bouquets',
  Recordatorios: 'recordatorios', Navidad: 'navidad',
};
const env = loadEnv();
const pool = createPool(env);

try {
  await inTransaction(pool, async (client) => {
    for (const product of products) {
      const result = await client.query<{ id: string }>(
        `INSERT INTO products (
          external_id, slug, name, description, price_cop, price_max_cop, price_label, image_path,
          dimensions, weight, colors, fragrances, options, features, availability, collection,
          source_catalog, source_page, featured, popular, reference_image
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb,$15,$16,$17,$18,$19,$20,$21)
        ON CONFLICT (external_id) DO UPDATE SET
          slug = EXCLUDED.slug, name = EXCLUDED.name, description = EXCLUDED.description,
          price_cop = EXCLUDED.price_cop, price_max_cop = EXCLUDED.price_max_cop,
          price_label = EXCLUDED.price_label, image_path = EXCLUDED.image_path,
          dimensions = EXCLUDED.dimensions, weight = EXCLUDED.weight, colors = EXCLUDED.colors,
          fragrances = EXCLUDED.fragrances, options = EXCLUDED.options, features = EXCLUDED.features,
          availability = EXCLUDED.availability, collection = EXCLUDED.collection,
          source_catalog = EXCLUDED.source_catalog, source_page = EXCLUDED.source_page,
          featured = EXCLUDED.featured, popular = EXCLUDED.popular, reference_image = EXCLUDED.reference_image
        RETURNING id`,
        [
          product.id, product.slug, product.name, product.description, product.priceCop,
          product.priceMaxCop ?? null, product.priceLabel ?? null, product.image,
          product.dimensions ?? null, product.weight ?? null, JSON.stringify(product.colors ?? []),
          JSON.stringify(product.fragrances ?? []), JSON.stringify(product.options ?? []),
          JSON.stringify(product.features), product.availability, product.collection,
          product.source.catalog, product.source.page, product.featured ?? false,
          product.popular ?? false, product.referenceImage ?? false,
        ],
      );
      const productId = result.rows[0].id;
      const category = await client.query<{ id: string }>('SELECT id FROM categories WHERE slug = $1', [categorySlugs[product.category]]);
      await client.query(
        'INSERT INTO product_categories (product_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [productId, category.rows[0].id],
      );
      await client.query('DELETE FROM product_images WHERE product_id = $1', [productId]);
      for (const [index, path] of (product.images ?? [product.image]).entries()) {
        await client.query(
          'INSERT INTO product_images (product_id, image_path, alt_text, sort_order) VALUES ($1, $2, $3, $4)',
          [productId, path, product.name, index],
        );
      }
    }
  });
  console.log(`Seeded ${products.length} products`);
} finally {
  await pool.end();
}
