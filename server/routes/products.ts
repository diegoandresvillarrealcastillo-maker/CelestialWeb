import { Router } from 'express';
import { HttpError } from '../http/errors.js';
import { searchLimit } from '../middleware/limits.js';
import type { ProductService } from '../services/contracts.js';
import { productQuerySchema } from '../validators/schemas.js';

export function productRoutes(service: ProductService) {
  const router = Router();
  router.get('/', searchLimit, async (request, response) => {
    const query = productQuerySchema.parse(request.query);
    response.json({ products: await service.list(query) });
  });
  router.get('/:slug', searchLimit, async (request, response) => {
    const slug = String(request.params.slug);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new HttpError(404, 'Producto no encontrado.', 'NOT_FOUND');
    const product = await service.getBySlug(slug);
    if (!product) throw new HttpError(404, 'Producto no encontrado.', 'NOT_FOUND');
    response.json({ product });
  });
  return router;
}
