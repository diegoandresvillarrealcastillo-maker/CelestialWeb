import { Router } from 'express';
import type { AdminService } from '../services/contracts.js';

export function paymentSettingsRoutes(service: AdminService) {
  const router = Router();
  router.get('/', async (_request, response) => response.json({ settings: await service.getPaymentSettings() }));
  return router;
}
