import { Router } from 'express';
import { HttpError } from '../http/errors.js';
import { requireAuth, requireCsrf, requireRole } from '../middleware/auth.js';
import { adminLimit } from '../middleware/limits.js';
import { imageUpload as upload } from '../middleware/upload.js';
import type { AdminService } from '../services/contracts.js';
import { adminOrderNotificationQuerySchema, adminOrderUpdateSchema, adminPaymentDecisionSchema, adminProductSchema, adminCategorySchema, adminPromotionSchema, adminShippingSchema, paymentSettingsSchema } from '../validators/schemas.js';

const uuid = (value: string) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new HttpError(404, 'Recurso no encontrado.', 'NOT_FOUND');
  return value;
};

export function adminRoutes(service: AdminService) {
  const router = Router();
  router.use(adminLimit, requireAuth, requireRole('admin'));
  router.get('/overview', async (request, response) => response.json({ overview: await service.getOverview(request.auth!) }));
  router.get('/orders', async (request, response) => response.json({ orders: await service.listOrders(request.auth!) }));
  router.get('/orders/notifications', async (request, response) => {
    const { after } = adminOrderNotificationQuerySchema.parse(request.query);
    response.json({ orders: await service.getOrderNotifications(request.auth!, after) });
  });
  router.patch('/orders/:id', requireCsrf, async (request, response) => {
    const input = adminOrderUpdateSchema.parse(request.body);
    response.json({ order: await service.updateOrder(request.auth!, uuid(String(request.params.id)), input) });
  });
  router.patch('/orders/:id/shipping', requireCsrf, async (request, response) => {
    const { shippingCop } = adminShippingSchema.parse(request.body);
    response.json({ order: await service.confirmShipping(request.auth!, uuid(String(request.params.id)), shippingCop) });
  });
  router.patch('/orders/:id/payment', requireCsrf, async (request, response) => {
    const { decision } = adminPaymentDecisionSchema.parse(request.body);
    response.json({ order: await service.decidePayment(request.auth!, uuid(String(request.params.id)), decision) });
  });
  router.put('/payment-settings', requireCsrf, async (request, response) => {
    const input = paymentSettingsSchema.parse(request.body);
    response.json({ settings: await service.updatePaymentSettings(request.auth!, input) });
  });
  router.get('/products', async (request, response) => response.json({ products: await service.listProducts(request.auth!) }));
  router.post('/uploads', requireCsrf, upload.single('file'), async (request, response) => {
    if (!request.file) throw new HttpError(400, 'Falta una imagen válida (jpeg, png o webp, máx. 5MB).', 'INVALID_FILE');
    const url = await service.uploadProductImage(request.auth!, request.file);
    response.status(201).json({ url });
  });
  router.post('/products', requireCsrf, async (request, response) => {
    const input = adminProductSchema.parse(request.body);
    response.status(201).json({ product: await service.createProduct(request.auth!, input) });
  });
  router.patch('/products/:id', requireCsrf, async (request, response) => {
    const input = adminProductSchema.parse(request.body);
    response.json({ product: await service.updateProduct(request.auth!, uuid(String(request.params.id)), input) });
  });
  router.delete('/products/:id', requireCsrf, async (request, response) => {
    await service.deactivateProduct(request.auth!, uuid(String(request.params.id)));
    response.status(204).end();
  });
  router.get('/categories', async (request, response) => response.json({ categories: await service.listCategories(request.auth!) }));
  router.post('/categories', requireCsrf, async (request, response) => {
    const input = adminCategorySchema.parse(request.body);
    response.status(201).json({ category: await service.createCategory(request.auth!, input) });
  });
  router.put('/categories/:id', requireCsrf, async (request, response) => {
    const input = adminCategorySchema.parse(request.body);
    response.json({ category: await service.updateCategory(request.auth!, uuid(String(request.params.id)), input) });
  });
  router.get('/promotions', async (request, response) => response.json({ promotions: await service.listPromotions(request.auth!) }));
  router.post('/promotions', requireCsrf, async (request, response) => {
    const input = adminPromotionSchema.parse(request.body);
    response.status(201).json({ promotion: await service.createPromotion(request.auth!, input) });
  });
  router.put('/promotions/:id', requireCsrf, async (request, response) => {
    const input = adminPromotionSchema.parse(request.body);
    response.json({ promotion: await service.updatePromotion(request.auth!, uuid(String(request.params.id)), input) });
  });
  return router;
}
