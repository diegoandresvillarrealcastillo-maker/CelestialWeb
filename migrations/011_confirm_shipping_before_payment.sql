-- A customer must know the final total, including shipping, before uploading a
-- transfer receipt. Zero-cost pickup/delivery is still valid when explicitly
-- confirmed by an administrator.
ALTER TABLE orders ADD COLUMN shipping_confirmed_at timestamptz;

DROP POLICY IF EXISTS orders_customer_receipt_update ON orders;
CREATE POLICY orders_customer_receipt_update ON orders FOR UPDATE
  USING (user_id = app_user_id() AND shipping_confirmed_at IS NOT NULL AND payment_status IN ('pending', 'rejected'))
  WITH CHECK (user_id = app_user_id());

DROP POLICY IF EXISTS orders_guest_token_update ON orders;
CREATE POLICY orders_guest_token_update ON orders FOR UPDATE USING (
  user_id IS NULL
  AND guest_token_hash = NULLIF(current_setting('app.guest_order_hash', true), '')
  AND shipping_confirmed_at IS NOT NULL
  AND payment_status IN ('pending', 'rejected')
) WITH CHECK (
  user_id IS NULL
  AND guest_token_hash = NULLIF(current_setting('app.guest_order_hash', true), '')
);
