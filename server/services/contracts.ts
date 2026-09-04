import type { AuthContext, SessionResult } from '../types.js';

export type RequestMeta = { ip: string; userAgent?: string };

export interface AuthService {
  getSession(rawToken: string): Promise<AuthContext | null>;
  register(input: { email: string; password: string; fullName: string; phone?: string }, meta: RequestMeta): Promise<void>;
  login(input: { email: string; password: string }, meta: RequestMeta): Promise<SessionResult>;
  loginWithGoogle(idToken: string, meta: RequestMeta): Promise<SessionResult>;
  logout(auth: AuthContext): Promise<void>;
  rotateCsrf(auth: AuthContext): Promise<string>;
  forgotPassword(email: string, meta: RequestMeta): Promise<void>;
  resetPassword(token: string, password: string): Promise<void>;
  verifyEmail(token: string): Promise<void>;
  updateProfile(auth: AuthContext, input: { fullName?: string; phone?: string | null; avatarUrl?: string | null }): Promise<AuthContext>;
  changePassword(auth: AuthContext, currentPassword: string, newPassword: string): Promise<void>;
}

export interface ProductService {
  list(query: Record<string, unknown>): Promise<unknown[]>;
  getBySlug(slug: string): Promise<unknown | null>;
}

export interface OrderService {
  create(auth: AuthContext | null, input: unknown): Promise<unknown>;
  list(auth: AuthContext): Promise<unknown[]>;
  get(auth: AuthContext, orderId: string): Promise<unknown | null>;
  attachReceipt(auth: AuthContext | null, orderId: string, file: { buffer: Buffer; mimetype: string; originalname: string }): Promise<unknown>;
}

export interface AdminService {
  getOverview(auth: AuthContext): Promise<unknown>;
  listOrders(auth: AuthContext): Promise<unknown[]>;
  updateOrder(auth: AuthContext, orderId: string, input: unknown): Promise<unknown>;
  listProducts(auth: AuthContext): Promise<unknown[]>;
  updateProduct(auth: AuthContext, productId: string, input: unknown): Promise<unknown>;
  createProduct(auth: AuthContext, input: unknown): Promise<unknown>;
  deactivateProduct(auth: AuthContext, productId: string): Promise<void>;
  uploadProductImage(auth: AuthContext, file: { buffer: Buffer; mimetype: string; originalname: string }): Promise<string>;
  decidePayment(auth: AuthContext, orderId: string, decision: 'verified' | 'rejected'): Promise<unknown>;
  getPaymentSettings(): Promise<unknown>;
  updatePaymentSettings(auth: AuthContext, input: unknown): Promise<unknown>;
  listCategories(auth: AuthContext): Promise<unknown[]>;
  createCategory(auth: AuthContext, input: unknown): Promise<unknown>;
  updateCategory(auth: AuthContext, categoryId: string, input: unknown): Promise<unknown>;
  listPromotions(auth: AuthContext): Promise<unknown[]>;
  createPromotion(auth: AuthContext, input: unknown): Promise<unknown>;
  updatePromotion(auth: AuthContext, promotionId: string, input: unknown): Promise<unknown>;
}

export type Services = { auth: AuthService; products: ProductService; orders: OrderService; admin: AdminService };
