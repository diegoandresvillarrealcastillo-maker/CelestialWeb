ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE orders ADD COLUMN guest_email citext;
ALTER TABLE orders ADD CONSTRAINT orders_owner_or_guest CHECK (user_id IS NOT NULL OR guest_email IS NOT NULL);

CREATE POLICY orders_insert_guest ON orders FOR INSERT WITH CHECK (user_id IS NULL);
CREATE POLICY orders_guest_read ON orders FOR SELECT USING (user_id IS NULL);
CREATE POLICY orders_guest_receipt_update ON orders FOR UPDATE
  USING (user_id IS NULL AND payment_status IN ('pending', 'rejected'))
  WITH CHECK (user_id IS NULL);

CREATE POLICY order_items_insert_guest ON order_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.user_id IS NULL)
);
CREATE POLICY order_items_read_guest ON order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.user_id IS NULL)
);

CREATE POLICY idempotency_guest ON idempotency_keys FOR ALL USING (user_id IS NULL) WITH CHECK (user_id IS NULL);
