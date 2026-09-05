import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { HttpError } from '../http/errors.js';
import { requireAuth, requireCsrfIfAuthenticated } from '../middleware/auth.js';
import { orderLimit } from '../middleware/limits.js';
import { imageUpload as upload } from '../middleware/upload.js';
import type { OrderService } from '../services/contracts.js';
import { orderSchema } from '../validators/schemas.js';

export function orderRoutes(service: OrderService) {
  const router = Router();

  router.get('/', requireAuth, async (request, response) => response.json({ orders: await service.list(request.auth!) }));
  router.get('/:id', requireAuth, async (request, response) => {
    const orderId = String(request.params.id);
    if (!/^[0-9a-f-]{36}$/i.test(orderId)) throw new HttpError(404, 'Pedido no encontrado.', 'NOT_FOUND');
    const order = await service.get(request.auth!, orderId);
    if (!order) throw new HttpError(404, 'Pedido no encontrado.', 'NOT_FOUND');
    response.json({ order });
  });
  router.post('/', orderLimit, requireCsrfIfAuthenticated, async (request, response) => {
    const input = orderSchema.parse(request.body);
    const idempotencyKey = request.get('idempotency-key') ?? randomUUID();
    if (!/^[a-zA-Z0-9_-]{16,100}$/.test(idempotencyKey)) {
      throw new HttpError(422, 'La clave de idempotencia no es válida.', 'INVALID_IDEMPOTENCY_KEY');
    }
    const order = await service.create(request.auth ?? null, { ...input, idempotencyKey });
    response.status(201).json({ order });
  });
  router.post('/:id/receipt', orderLimit, requireCsrfIfAuthenticated, upload.single('file'), async (request, response) => {
    const orderId = String(request.params.id);
    if (!/^[0-9a-f-]{36}$/i.test(orderId)) throw new HttpError(404, 'Pedido no encontrado.', 'NOT_FOUND');
    if (!request.file) throw new HttpError(400, 'Falta una imagen válida (jpeg, png o webp, máx. 5MB).', 'INVALID_FILE');
    const guestToken = request.get('x-order-token');
    response.status(201).json({ order: await service.attachReceipt(request.auth ?? null, orderId, request.file, guestToken) });
  });
  return router;
}
