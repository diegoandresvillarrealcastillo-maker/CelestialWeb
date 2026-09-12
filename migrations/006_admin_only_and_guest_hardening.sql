-- Close legacy client-account and broad guest-data surfaces, bind every guest
-- policy to an unguessable request secret, and prepare a restricted API role.
ALTER TABLE products
  ADD COLUMN option_prices jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(option_prices) = 'object');

ALTER TABLE idempotency_keys ADD COLUMN request_hash char(64);

DROP POLICY IF EXISTS users_register ON users;
DROP POLICY IF EXISTS user_roles_customer_bootstrap ON user_roles;
DROP POLICY IF EXISTS orders_insert_guest ON orders;
DROP POLICY IF EXISTS orders_guest_read ON orders;
DROP POLICY IF EXISTS orders_guest_receipt_update ON orders;
DROP POLICY IF EXISTS order_items_insert_guest ON order_items;
DROP POLICY IF EXISTS order_items_read_guest ON order_items;
DROP POLICY IF EXISTS idempotency_guest ON idempotency_keys;

CREATE POLICY orders_insert_guest_bound ON orders FOR INSERT WITH CHECK (
  user_id IS NULL
  AND guest_email = NULLIF(current_setting('app.guest_email', true), '')::citext
  AND guest_token_hash = NULLIF(current_setting('app.guest_order_hash', true), '')
);
CREATE POLICY orders_guest_token_read ON orders FOR SELECT USING (
  user_id IS NULL
  AND guest_token_hash = NULLIF(current_setting('app.guest_order_hash', true), '')
);
CREATE POLICY orders_guest_token_update ON orders FOR UPDATE USING (
  user_id IS NULL
  AND guest_token_hash = NULLIF(current_setting('app.guest_order_hash', true), '')
  AND payment_status IN ('pending', 'rejected')
) WITH CHECK (
  user_id IS NULL
  AND guest_token_hash = NULLIF(current_setting('app.guest_order_hash', true), '')
);
CREATE POLICY order_items_insert_guest_bound ON order_items FOR INSERT WITH CHECK (
  order_id::text = NULLIF(current_setting('app.guest_order_id', true), '')
);
CREATE POLICY idempotency_guest_bound ON idempotency_keys FOR ALL USING (
  user_id IS NULL
  AND key_hash = NULLIF(current_setting('app.idempotency_hash', true), '')
) WITH CHECK (
  user_id IS NULL
  AND key_hash = NULLIF(current_setting('app.idempotency_hash', true), '')
);

DROP POLICY IF EXISTS audit_server_insert ON audit_logs;
CREATE POLICY audit_server_insert ON audit_logs FOR INSERT WITH CHECK (
  current_setting('app.audit_event', true) = 'true'
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon;
    REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM authenticated;
    REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'celestial_app') THEN
    CREATE ROLE celestial_app NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
END
$$;

ALTER ROLE celestial_app NOSUPERUSER NOBYPASSRLS;
DO $$ BEGIN EXECUTE format('GRANT CONNECT ON DATABASE %I TO celestial_app', current_database()); END $$;
GRANT USAGE ON SCHEMA public TO celestial_app;
GRANT SELECT ON roles, categories, products, product_images, product_categories, payment_settings TO celestial_app;
GRANT SELECT, UPDATE ON users, profiles TO celestial_app;
GRANT SELECT ON user_roles TO celestial_app;
GRANT SELECT, INSERT, UPDATE ON sessions, password_reset_tokens, login_attempts, audit_logs, idempotency_keys TO celestial_app;
GRANT SELECT, INSERT, UPDATE ON orders, order_items, promotions TO celestial_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO celestial_app;
GRANT SELECT ON schema_migrations TO celestial_app;
