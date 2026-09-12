-- Bind guest line items to the same unguessable token as their order. Also
-- prevent provider-level public roles from inheriting access to future tables
-- created by this migration owner.
DROP POLICY IF EXISTS order_items_insert_guest_bound ON order_items;
CREATE POLICY order_items_insert_guest_bound ON order_items FOR INSERT WITH CHECK (
  order_id::text = NULLIF(current_setting('app.guest_order_id', true), '')
  AND EXISTS (
    SELECT 1
      FROM orders owner_order
     WHERE owner_order.id = order_items.order_id
       AND owner_order.user_id IS NULL
       AND owner_order.guest_token_hash = NULLIF(current_setting('app.guest_order_hash', true), '')
  )
);

REVOKE CREATE ON SCHEMA public FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL PRIVILEGES ON TABLES FROM anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL PRIVILEGES ON TABLES FROM authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL PRIVILEGES ON SEQUENCES FROM authenticated;
  END IF;
END
$$;
