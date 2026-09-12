import { createHmac, randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { AppEnv } from '../config/env.js';
import { inTransaction, setDbContext, withAuthContext } from '../database/pool.js';
import { HttpError } from '../http/errors.js';
import { hashToken, safeTokenMatch } from '../security/tokens.js';
import type { AuthContext } from '../types.js';
import { writeAuditLog } from './audit.js';
import type { OrderService } from './contracts.js';
import { getSignedReceiptUrl, uploadPaymentReceipt } from './storage.js';

type OrderInput = {
  guestEmail?: string;
  privacyAccepted: true;
  items: Array<{ productId: string; quantity: number; selectedOptions: Record<string, string> }>;
  shippingAddress: { fullName: string; phone: string; address: string; city: string; notes?: string };
  customerNote?: string;
  idempotencyKey: string;
};

type TrustedProduct = {
  id: string; external_id: string; name: string; price_cop: number; price_max_cop: number | null;
  colors: string[]; fragrances: string[]; options: string[]; option_prices: Record<string, number>;
  requires_consultation: boolean;
};

type OrderLineResponse = {
  productName: string; quantity: number; selectedOptions: Record<string, string>;
  unitPriceCop: number; lineTotalCop: number;
};

type StoredOrderResponse = {
  id: string; orderNumber: string; createdAt: string; status: string; paymentStatus: string; currency: string;
  subtotalCop: number; discountCop: number; shippingCop: number; totalCop: number;
  shippingConfirmed: boolean; shippingNotice: string; items: OrderLineResponse[];
};

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function formatCop(value: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
}

function guestOrderToken(secret: string, orderId: string, keyHash: string) {
  return createHmac('sha256', secret).update(`guest-order:${orderId}:${keyHash}`).digest('base64url');
}

function whatsappUrl(
  number: string,
  order: { orderNumber: string; createdAt: Date },
  input: OrderInput,
  lines: OrderLineResponse[],
  totalCop: number,
) {
  const heading = [
    `Nuevo pedido Celestial #${order.orderNumber}`,
    `Fecha: ${order.createdAt.toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`,
    `Cliente: ${input.shippingAddress.fullName}`,
    `Correo: ${input.guestEmail ?? 'No informado'}`,
    `Teléfono: ${input.shippingAddress.phone}`,
    `Entrega: ${input.shippingAddress.address}, ${input.shippingAddress.city}`,
    '',
    'Productos:',
  ];
  const detail = lines.map((line, index) => {
    const options = Object.entries(line.selectedOptions).map(([key, value]) => `${key}: ${value}`).join(', ');
    return `${index + 1}. ${line.productName} · ${line.quantity} × ${formatCop(line.unitPriceCop)} = ${formatCop(line.lineTotalCop)}${options ? ` · ${options}` : ''}`;
  });
  const footer = [
    '',
    `Subtotal: ${formatCop(totalCop)}`,
    'Envío: por confirmar según ciudad y peso',
    `Total parcial: ${formatCop(totalCop)}`,
    'Pago: pendiente',
    ...(input.customerNote ? [`Nota: ${input.customerNote}`] : []),
  ];
  const available = 5_500 - heading.join('\n').length - footer.join('\n').length;
  let used = 0;
  const visibleDetail = detail.filter((line) => {
    if (used + line.length + 1 > available) return false;
    used += line.length + 1;
    return true;
  });
  if (visibleDetail.length < detail.length) visibleDetail.push(`…y ${detail.length - visibleDetail.length} producto(s) más en el pedido registrado.`);
  return `https://wa.me/${number}?text=${encodeURIComponent([...heading, ...visibleDetail, ...footer].join('\n'))}`;
}

export class PostgresOrderService implements OrderService {
  constructor(private pool: Pool, private env: AppEnv) {}

  async create(auth: AuthContext | null, rawInput: unknown) {
    const input = rawInput as OrderInput;
    if (!auth && !input.guestEmail) throw new HttpError(422, 'Ingresa tu correo para continuar sin cuenta.', 'GUEST_EMAIL_REQUIRED');
    const userId = auth?.userId ?? null;
    const keyHash = hashToken(`${userId ?? 'guest'}:${input.idempotencyKey}`);
    const requestHash = hashToken(stableJson({ guestEmail: input.guestEmail, privacyAccepted: input.privacyAccepted, items: input.items, shippingAddress: input.shippingAddress, customerNote: input.customerNote }));
    const decorateResponse = (response: StoredOrderResponse) => ({
      ...response,
      whatsappUrl: whatsappUrl(this.env.WHATSAPP_NUMBER, { orderNumber: response.orderNumber, createdAt: new Date(response.createdAt) }, input, response.items, response.totalCop),
      ...(!auth ? { guestToken: guestOrderToken(this.env.ORDER_TOKEN_SECRET, response.id, keyHash) } : {}),
    });

    return inTransaction(this.pool, async (client) => {
      if (auth) await setDbContext(client, auth);
      await client.query("SELECT set_config('app.idempotency_hash', $1, true)", [keyHash]);
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [keyHash]);
      const prior = await client.query<{ response_body: StoredOrderResponse | null; request_hash: string | null }>(
        `SELECT response_body, request_hash FROM idempotency_keys
          WHERE key_hash = $1 AND user_id IS NOT DISTINCT FROM $2 AND scope = 'create-order' AND expires_at > now()`,
        [keyHash, userId],
      );
      if (prior.rows[0]?.response_body) {
        if (prior.rows[0].request_hash && prior.rows[0].request_hash !== requestHash) {
          throw new HttpError(409, 'La clave de idempotencia ya fue usada con otro pedido.', 'IDEMPOTENCY_CONFLICT');
        }
        return decorateResponse(prior.rows[0].response_body);
      }

      const ids = [...new Set(input.items.map((item) => item.productId))];
      const productResult = await client.query<TrustedProduct>(
        `SELECT id, external_id, name, price_cop, price_max_cop, colors, fragrances, options, option_prices, requires_consultation
           FROM products WHERE (id::text = ANY($1::text[]) OR external_id = ANY($1::text[])) AND active = true FOR SHARE`,
        [ids],
      );
      if (productResult.rowCount !== ids.length) throw new HttpError(409, 'Uno o más productos ya no están disponibles.', 'PRODUCT_UNAVAILABLE');
      const trusted = new Map<string, TrustedProduct>();
      for (const product of productResult.rows) {
        trusted.set(product.id, product);
        trusted.set(product.external_id, product);
      }

      let subtotal = 0;
      const lines = input.items.map((item) => {
        const product = trusted.get(item.productId)!;
        const allowed: Record<string, string[]> = {
          color: product.colors ?? [], fragrance: product.fragrances ?? [], option: product.options ?? [],
        };
        for (const [key, values] of Object.entries(allowed)) {
          if (values.length && !item.selectedOptions[key]) {
            throw new HttpError(422, 'Elige todas las opciones requeridas del producto.', 'PRODUCT_OPTION_REQUIRED');
          }
        }
        for (const [key, value] of Object.entries(item.selectedOptions)) {
          if (!allowed[key] || !allowed[key].includes(value)) {
            throw new HttpError(422, 'Una opción del producto no es válida.', 'INVALID_PRODUCT_OPTION');
          }
        }
        const unitPriceCop = product.option_prices?.[item.selectedOptions.option] ?? product.price_cop;
        if (!Number.isInteger(unitPriceCop) || unitPriceCop < 1 || unitPriceCop > 100_000_000) {
          throw new HttpError(409, 'El precio configurado para una opción no es válido.', 'INVALID_OPTION_PRICE');
        }
        if (product.requires_consultation || (product.price_max_cop !== null && product.price_max_cop > product.price_cop && !product.option_prices?.[item.selectedOptions.option])) {
          throw new HttpError(409, 'Este producto necesita cotización antes de crear el pedido.', 'PRODUCT_REQUIRES_QUOTE');
        }
        subtotal += unitPriceCop * item.quantity;
        if (!Number.isSafeInteger(subtotal) || subtotal > 2_000_000_000) {
          throw new HttpError(422, 'El total del pedido excede el máximo permitido.', 'ORDER_TOTAL_TOO_HIGH');
        }
        return { ...item, product, unitPriceCop };
      });

      const orderId = randomUUID();
      const guestToken = auth ? null : guestOrderToken(this.env.ORDER_TOKEN_SECRET, orderId, keyHash);
      if (guestToken) {
        await client.query(
          "SELECT set_config('app.guest_email', $1, true), set_config('app.guest_order_hash', $2, true)",
          [input.guestEmail!, hashToken(guestToken)],
        );
      }
      const orderResult = await client.query<{ id: string; order_number: string; created_at: Date }>(
        `INSERT INTO orders (id, user_id, guest_email, guest_token_hash, subtotal_cop, discount_cop, shipping_cop, total_cop, shipping_address, customer_note, privacy_accepted_at)
         VALUES ($1, $2, $3, $4, $5, 0, 0, $5, $6::jsonb, $7, now()) RETURNING id, order_number, created_at`,
        [orderId, userId, auth ? null : input.guestEmail, guestToken ? hashToken(guestToken) : null, subtotal, JSON.stringify(input.shippingAddress), input.customerNote ?? null],
      );
      const order = orderResult.rows[0];
      if (guestToken) await client.query("SELECT set_config('app.guest_order_id', $1, true)", [order.id]);

      for (const line of lines) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, product_name, unit_price_cop, quantity, selected_options)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
          [order.id, line.product.id, line.product.name, line.unitPriceCop, line.quantity, JSON.stringify(line.selectedOptions)],
        );
      }

      const response: StoredOrderResponse = {
        id: order.id, orderNumber: order.order_number, status: 'pending', paymentStatus: 'pending', currency: 'COP',
        createdAt: order.created_at.toISOString(),
        subtotalCop: subtotal, discountCop: 0, shippingCop: 0, totalCop: subtotal,
        shippingConfirmed: false,
        shippingNotice: 'El valor del envío se confirma según ciudad y peso.',
        items: lines.map((line) => ({
          productName: line.product.name, quantity: line.quantity, selectedOptions: line.selectedOptions,
          unitPriceCop: line.unitPriceCop, lineTotalCop: line.unitPriceCop * line.quantity,
        })),
      };
      await client.query(
        `INSERT INTO idempotency_keys (key_hash, user_id, scope, request_hash, response_status, response_body, expires_at)
         VALUES ($1, $2, 'create-order', $3, 201, $4::jsonb, now() + interval '24 hours')
         ON CONFLICT (key_hash) DO UPDATE SET
           user_id = EXCLUDED.user_id, scope = EXCLUDED.scope, request_hash = EXCLUDED.request_hash,
           response_status = EXCLUDED.response_status, response_body = EXCLUDED.response_body,
           expires_at = EXCLUDED.expires_at
         WHERE idempotency_keys.expires_at <= now()`,
        [keyHash, userId, requestHash, JSON.stringify(response)],
      );
      return decorateResponse(response);
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

  async getGuest(orderId: string, guestToken: string) {
    return inTransaction(this.pool, async (client) => {
      await client.query("SELECT set_config('app.guest_order_hash', $1, true)", [hashToken(guestToken)]);
      const result = await client.query(
        `SELECT id, order_number AS "orderNumber", status, payment_status AS "paymentStatus", currency,
                subtotal_cop AS "subtotalCop", discount_cop AS "discountCop", shipping_cop AS "shippingCop",
                total_cop AS "totalCop", (shipping_confirmed_at IS NOT NULL) AS "shippingConfirmed",
                created_at AS "createdAt"
           FROM orders WHERE id = $1 AND user_id IS NULL LIMIT 1`,
        [orderId],
      );
      return result.rows[0] ?? null;
    });
  }

  async attachReceipt(auth: AuthContext | null, orderId: string, file: { buffer: Buffer; mimetype: string; originalname: string }, guestToken?: string) {
    return inTransaction(this.pool, async (client) => {
      if (auth) await setDbContext(client, auth);
      if (!auth && guestToken) await client.query("SELECT set_config('app.guest_order_hash', $1, true)", [hashToken(guestToken)]);
      const orderResult = await client.query<{ id: string; payment_status: string; guest_token_hash: string | null; shipping_confirmed_at: Date | null }>(
        auth
          ? `SELECT id, payment_status, NULL AS guest_token_hash, shipping_confirmed_at FROM orders WHERE id = $1 AND user_id = $2 LIMIT 1`
          : `SELECT id, payment_status, guest_token_hash, shipping_confirmed_at FROM orders WHERE id = $1 AND user_id IS NULL LIMIT 1`,
        auth ? [orderId, auth.userId] : [orderId],
      );
      const order = orderResult.rows[0];
      if (!order) throw new HttpError(404, 'Pedido no encontrado.', 'NOT_FOUND');
      if (!auth) {
        if (!order.guest_token_hash || !guestToken || !safeTokenMatch(guestToken, order.guest_token_hash)) {
          throw new HttpError(403, 'No es posible verificar que este pedido te pertenece.', 'ORDER_TOKEN_INVALID');
        }
      }
      if (!order.shipping_confirmed_at) {
        throw new HttpError(409, 'Espera la confirmación del total con envío antes de adjuntar el comprobante.', 'SHIPPING_NOT_CONFIRMED');
      }
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
