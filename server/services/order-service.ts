import type { Pool } from 'pg';
import type { AppEnv } from '../config/env.js';
import { inTransaction, setDbContext, withAuthContext } from '../database/pool.js';
import { HttpError } from '../http/errors.js';
import { hashToken } from '../security/tokens.js';
import type { AuthContext } from '../types.js';
import { writeAuditLog } from './audit.js';
import type { OrderService } from './contracts.js';
import { getSignedReceiptUrl, uploadPaymentReceipt } from './storage.js';

type OrderInput = {
  guestEmail?: string;
  items: Array<{ productId: string; quantity: number; selectedOptions: Record<string, string> }>;
  shippingAddress: Record<string, string | undefined>;
  customerNote?: string;
  idempotencyKey: string;
};

type TrustedProduct = {
  id: string; name: string; price_cop: number; colors: string[]; fragrances: string[]; options: string[];
};

export class PostgresOrderService implements OrderService {
  constructor(private pool: Pool, private env: AppEnv) {}

  async create(auth: AuthContext | null, rawInput: unknown) {
    if (auth && !auth.emailVerified) throw new HttpError(403, 'Verifica tu correo antes de crear un pedido.', 'EMAIL_NOT_VERIFIED');
    const input = rawInput as OrderInput;
    if (!auth && !input.guestEmail) throw new HttpError(422, 'Ingresa tu correo para continuar sin cuenta.', 'GUEST_EMAIL_REQUIRED');
    const keyHash = hashToken(input.idempotencyKey);
    const userId = auth?.userId ?? null;

    return inTransaction(this.pool, async (client) => {
      if (auth) await setDbContext(client, auth);
      const prior = await client.query<{ response_body: unknown }>(
        `SELECT response_body FROM idempotency_keys
          WHERE key_hash = $1 AND user_id IS NOT DISTINCT FROM $2 AND scope = 'create-order' AND expires_at > now()`,
        [keyHash, userId],
      );
      if (prior.rows[0]?.response_body) return prior.rows[0].response_body;

      const ids = [...new Set(input.items.map((item) => item.productId))];
      const productResult = await client.query<TrustedProduct>(
        `SELECT id, external_id, name, price_cop, colors, fragrances, options
           FROM products WHERE (id::text = ANY($1::text[]) OR external_id = ANY($1::text[])) AND active = true FOR SHARE`,
        [ids],
      );
      if (productResult.rowCount !== ids.length) throw new HttpError(409, 'Uno o más productos ya no están disponibles.', 'PRODUCT_UNAVAILABLE');
      const trusted = new Map<string, TrustedProduct>();
      for (const product of productResult.rows as Array<TrustedProduct & { external_id: string }>) {
        trusted.set(product.id, product);
        trusted.set(product.external_id, product);
      }

      let subtotal = 0;
      const lines = input.items.map((item) => {
        const product = trusted.get(item.productId)!;
        const allowed: Record<string, string[]> = {
          color: product.colors ?? [], fragrance: product.fragrances ?? [], option: product.options ?? [],
        };
        for (const [key, value] of Object.entries(item.selectedOptions)) {
          if (!allowed[key] || !allowed[key].includes(value)) {
            throw new HttpError(422, 'Una opción del producto no es válida.', 'INVALID_PRODUCT_OPTION');
          }
        }
        subtotal += product.price_cop * item.quantity;
        return { ...item, product };
      });

      const orderResult = await client.query<{ id: string; order_number: string }>(
        `INSERT INTO orders (user_id, guest_email, subtotal_cop, discount_cop, shipping_cop, total_cop, shipping_address, customer_note)
         VALUES ($1, $2, $3, 0, 0, $3, $4::jsonb, $5) RETURNING id, order_number`,
        [userId, auth ? null : input.guestEmail, subtotal, JSON.stringify(input.shippingAddress), input.customerNote ?? null],
      );
      const order = orderResult.rows[0];

      for (const line of lines) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, product_name, unit_price_cop, quantity, selected_options)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
          [order.id, line.product.id, line.product.name, line.product.price_cop, line.quantity, JSON.stringify(line.selectedOptions)],
        );
      }

      const response = {
        id: order.id, orderNumber: order.order_number, status: 'pending', currency: 'COP',
        subtotalCop: subtotal, discountCop: 0, shippingCop: 0, totalCop: subtotal,
        shippingNotice: 'El valor del envío se confirma según ciudad y peso.',
      };
      await client.query(
        `INSERT INTO idempotency_keys (key_hash, user_id, scope, response_status, response_body, expires_at)
         VALUES ($1, $2, 'create-order', 201, $3::jsonb, now() + interval '24 hours')
         ON CONFLICT (key_hash) DO NOTHING`,
        [keyHash, userId, JSON.stringify(response)],
      );
      return response;
    });
  }

  async list(auth: AuthContext) {
    return withAuthContext(this.pool, auth, async (client) => {
      const result = await client.query(
        `SELECT id, order_number AS "orderNumber", status, payment_status AS "paymentStatus",
                receipt_path AS "receiptPath", currency,
                subtotal_cop AS "subtotalCop", discount_cop AS "discountCop",
                shipping_cop AS "shippingCop", total_cop AS "totalCop", created_at AS "createdAt"
           FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`,
        [auth.userId],
      );
      return Promise.all(result.rows.map(async ({ receiptPath, ...order }) => ({
        ...order,
        receiptUrl: receiptPath ? await getSignedReceiptUrl(this.env, receiptPath) : null,
      })));
    });
  }

  async get(auth: AuthContext, orderId: string) {
    return withAuthContext(this.pool, auth, async (client) => {
      const orderResult = await client.query(
        `SELECT id, order_number AS "orderNumber", status, payment_status AS "paymentStatus",
                receipt_path AS "receiptPath", currency,
                subtotal_cop AS "subtotalCop", discount_cop AS "discountCop",
                shipping_cop AS "shippingCop", total_cop AS "totalCop",
                shipping_address AS "shippingAddress", customer_note AS "customerNote", created_at AS "createdAt"
           FROM orders WHERE id = $1 AND user_id = $2 LIMIT 1`,
        [orderId, auth.userId],
      );
      const { receiptPath, ...order } = orderResult.rows[0] ?? {};
      if (!order.id) return null;
      const items = await client.query(
        `SELECT product_id AS "productId", product_name AS "productName", unit_price_cop AS "unitPriceCop",
                quantity, selected_options AS "selectedOptions", line_total_cop AS "lineTotalCop"
           FROM order_items WHERE order_id = $1 ORDER BY created_at`,
        [orderId],
      );
      return { ...order, receiptUrl: receiptPath ? await getSignedReceiptUrl(this.env, receiptPath) : null, items: items.rows };
    });
  }

  async attachReceipt(auth: AuthContext | null, orderId: string, file: { buffer: Buffer; mimetype: string; originalname: string }) {
    return inTransaction(this.pool, async (client) => {
      if (auth) await setDbContext(client, auth);
      const orderResult = await client.query<{ id: string; payment_status: string }>(
        auth
          ? `SELECT id, payment_status FROM orders WHERE id = $1 AND user_id = $2 LIMIT 1`
          : `SELECT id, payment_status FROM orders WHERE id = $1 AND user_id IS NULL LIMIT 1`,
        auth ? [orderId, auth.userId] : [orderId],
      );
      const order = orderResult.rows[0];
      if (!order) throw new HttpError(404, 'Pedido no encontrado.', 'NOT_FOUND');
      if (!['pending', 'rejected'].includes(order.payment_status)) {
        throw new HttpError(409, 'Este pedido no admite un nuevo comprobante en su estado actual.', 'RECEIPT_NOT_ALLOWED');
      }
      const receiptPath = await uploadPaymentReceipt(this.env, orderId, file);
      const result = await client.query(
        `UPDATE orders SET receipt_path = $2, receipt_uploaded_at = now(), payment_status = 'pending_verification'
         WHERE id = $1 RETURNING id, payment_status AS "paymentStatus", receipt_uploaded_at AS "receiptUploadedAt"`,
        [orderId, receiptPath],
      );
      await writeAuditLog(client, auth?.userId ?? null, 'order.receipt_uploaded', 'order', orderId, {});
      return result.rows[0];
    });
  }
}
