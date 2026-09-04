import { z } from 'zod';

const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string()
  .min(12, 'Usa al menos 12 caracteres.')
  .max(128)
  .regex(/[a-záéíóúñ]/i, 'Incluye una letra.')
  .regex(/[A-ZÁÉÍÓÚÑ]/, 'Incluye una mayúscula.')
  .regex(/[0-9]/, 'Incluye un número.')
  .regex(/[^\p{L}\p{N}\s]/u, 'Incluye un símbolo.');

export const registerSchema = z.object({
  email,
  password,
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(30).regex(/^[+0-9 ()-]+$/).optional(),
  hpVerify: z.string().max(0).optional(),
  turnstileToken: z.string().max(2000).optional(),
}).strict();

export const loginSchema = z.object({ email, password: z.string().min(1).max(128) }).strict();
export const googleAuthSchema = z.object({ idToken: z.string().min(20).max(4000) }).strict();
export const forgotPasswordSchema = z.object({ email, hpVerify: z.string().max(0).optional() }).strict();
export const resetPasswordSchema = z.object({ token: z.string().min(32).max(200), password }).strict();
export const verifyEmailSchema = z.object({ token: z.string().min(32).max(200) }).strict();
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: password }).strict();
export const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().min(7).max(30).regex(/^[+0-9 ()-]+$/).nullable().optional(),
  avatarUrl: z.string().url().max(500).nullable().optional(),
}).strict();

export const productQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  category: z.string().trim().max(100).optional(),
  collection: z.enum(['general', 'navidad']).optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  available: z.enum(['true', 'false']).optional(),
  sort: z.enum(['popular', 'price-asc', 'price-desc', 'newest']).default('popular'),
  limit: z.coerce.number().int().min(1).max(100).default(48),
}).strict();

export const orderSchema = z.object({
  guestEmail: email.optional(),
  items: z.array(z.object({
    productId: z.string().min(3).max(80).regex(/^[a-zA-Z0-9-]+$/),
    quantity: z.number().int().min(1).max(99),
    selectedOptions: z.record(z.string(), z.string().trim().max(100)).default({}),
  }).strict()).min(1).max(30),
  shippingAddress: z.object({
    fullName: z.string().trim().min(2).max(120),
    phone: z.string().trim().min(7).max(30).regex(/^[+0-9 ()-]+$/),
    address: z.string().trim().min(5).max(180),
    city: z.string().trim().min(2).max(100),
    notes: z.string().trim().max(200).optional(),
  }).strict(),
  customerNote: z.string().trim().max(500).optional(),
}).strict();

export const adminProductSchema = z.object({
  slug: z.string().trim().min(2).max(140).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  name: z.string().trim().min(2).max(160).optional(),
  description: z.string().trim().min(10).max(3000).optional(),
  priceCop: z.number().int().min(0).max(100_000_000).optional(),
  priceMaxCop: z.number().int().min(0).max(100_000_000).nullable().optional(),
  priceLabel: z.string().trim().max(120).nullable().optional(),
  imagePath: z.string().trim().max(500)
    .regex(/^\/images\/[a-zA-Z0-9_./-]+$|^https:\/\/[a-zA-Z0-9.-]+\.supabase\.co\/storage\/v1\/object\/public\/[a-zA-Z0-9_./-]+$/)
    .optional(),
  dimensions: z.string().trim().max(120).nullable().optional(),
  weight: z.string().trim().max(60).nullable().optional(),
  colors: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  fragrances: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  options: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
  features: z.array(z.string().trim().min(1).max(160)).max(30).optional(),
  availability: z.string().trim().min(2).max(60).optional(),
  collection: z.enum(['general', 'navidad']).optional(),
  featured: z.boolean().optional(),
  popular: z.boolean().optional(),
  active: z.boolean().optional(),
  categoryId: z.string().uuid().optional(),
}).strict();

export const adminOrderUpdateSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'preparing', 'shipped', 'completed', 'cancelled']),
}).strict();

export const adminPaymentDecisionSchema = z.object({
  decision: z.enum(['verified', 'rejected']),
}).strict();

export const paymentSettingsSchema = z.object({
  bankKey: z.string().trim().max(200).nullable().optional(),
  accountHolder: z.string().trim().max(200).nullable().optional(),
  qrImageUrl: z.string().trim().max(500)
    .regex(/^\/images\/[a-zA-Z0-9_./-]+$|^https:\/\/[a-zA-Z0-9.-]+\.supabase\.co\/storage\/v1\/object\/public\/[a-zA-Z0-9_./-]+$/)
    .nullable().optional(),
  instructions: z.string().trim().max(1000).nullable().optional(),
}).strict();

export const adminCategorySchema = z.object({
  slug: z.string().trim().min(2).max(90).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(1000).nullable().optional(),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
}).strict();

export const adminPromotionSchema = z.object({
  name: z.string().trim().min(2).max(140),
  code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/).nullable().optional(),
  kind: z.enum(['percentage', 'fixed', 'bundle']),
  configuration: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).refine((value) => Object.keys(value).length <= 20),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  active: z.boolean().default(false),
}).strict();
