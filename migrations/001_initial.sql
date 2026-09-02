CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE roles (
  id smallserial PRIMARY KEY,
  name text NOT NULL UNIQUE CHECK (name IN ('customer', 'admin', 'editor', 'support')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  password_hash text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
  email_verified_at timestamptz,
  failed_login_count integer NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
  locked_until timestamptz,
  password_changed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name varchar(120),
  phone varchar(30),
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_roles (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id smallint NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  granted_by uuid REFERENCES users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(90) NOT NULL UNIQUE,
  name varchar(100) NOT NULL UNIQUE,
  description text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id varchar(80) NOT NULL UNIQUE,
  slug varchar(140) NOT NULL UNIQUE,
  name varchar(160) NOT NULL,
  description text NOT NULL,
  price_cop integer NOT NULL CHECK (price_cop >= 0),
  price_max_cop integer CHECK (price_max_cop IS NULL OR price_max_cop >= price_cop),
  price_label varchar(120),
  image_path text NOT NULL,
  dimensions varchar(120),
  weight varchar(60),
  colors jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(colors) = 'array'),
  fragrances jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(fragrances) = 'array'),
  options jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(options) = 'array'),
  features jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(features) = 'array'),
  availability varchar(60) NOT NULL DEFAULT 'Hecho bajo pedido',
  collection varchar(30) NOT NULL CHECK (collection IN ('general', 'navidad')),
  source_catalog varchar(30) NOT NULL CHECK (source_catalog IN ('general', 'navidad')),
  source_page smallint NOT NULL CHECK (source_page > 0),
  featured boolean NOT NULL DEFAULT false,
  popular boolean NOT NULL DEFAULT false,
  reference_image boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_path text NOT NULL,
  alt_text varchar(240) NOT NULL,
  sort_order smallint NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  UNIQUE (product_id, sort_order)
);

CREATE TABLE product_categories (
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  PRIMARY KEY (product_id, category_id)
);

CREATE TABLE promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(140) NOT NULL,
  code citext UNIQUE,
  kind varchar(30) NOT NULL CHECK (kind IN ('percentage', 'fixed', 'bundle')),
  configuration jsonb NOT NULL CHECK (jsonb_typeof(configuration) = 'object'),
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status varchar(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'preparing', 'shipped', 'completed', 'cancelled')),
  currency char(3) NOT NULL DEFAULT 'COP' CHECK (currency = 'COP'),
  subtotal_cop integer NOT NULL CHECK (subtotal_cop >= 0),
  discount_cop integer NOT NULL DEFAULT 0 CHECK (discount_cop >= 0),
  shipping_cop integer NOT NULL DEFAULT 0 CHECK (shipping_cop >= 0),
  total_cop integer NOT NULL CHECK (total_cop >= 0),
  shipping_address jsonb NOT NULL CHECK (jsonb_typeof(shipping_address) = 'object'),
  customer_note varchar(500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (total_cop = subtotal_cop - discount_cop + shipping_cop),
  CHECK (discount_cop <= subtotal_cop)
);

CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name varchar(160) NOT NULL,
  unit_price_cop integer NOT NULL CHECK (unit_price_cop >= 0),
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  selected_options jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(selected_options) = 'object'),
  line_total_cop integer GENERATED ALWAYS AS (unit_price_cop * quantity) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,
  csrf_hash char(64) NOT NULL,
  ip_hash char(64),
  user_agent varchar(300),
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  invalidated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);

CREATE TABLE email_verification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE login_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_hash char(64),
  ip_hash char(64) NOT NULL,
  succeeded boolean NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action varchar(100) NOT NULL,
  resource_type varchar(80) NOT NULL,
  resource_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE idempotency_keys (
  key_hash char(64) PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  scope varchar(80) NOT NULL,
  response_status smallint,
  response_body jsonb,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX products_active_price_idx ON products (active, price_cop);
CREATE INDEX products_collection_idx ON products (collection) WHERE active;
CREATE INDEX product_categories_category_idx ON product_categories (category_id, product_id);
CREATE INDEX orders_user_created_idx ON orders (user_id, created_at DESC);
CREATE INDEX orders_status_created_idx ON orders (status, created_at DESC);
CREATE INDEX order_items_order_idx ON order_items (order_id);
CREATE INDEX sessions_user_active_idx ON sessions (user_id, expires_at) WHERE invalidated_at IS NULL;
CREATE INDEX sessions_expires_idx ON sessions (expires_at);
CREATE INDEX password_reset_active_idx ON password_reset_tokens (user_id, expires_at) WHERE consumed_at IS NULL;
CREATE INDEX email_verification_active_idx ON email_verification_tokens (user_id, expires_at) WHERE consumed_at IS NULL;
CREATE INDEX login_attempts_ip_time_idx ON login_attempts (ip_hash, attempted_at DESC);
CREATE INDEX audit_logs_actor_time_idx ON audit_logs (actor_user_id, created_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER categories_set_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER products_set_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER promotions_set_updated_at BEFORE UPDATE ON promotions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER orders_set_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION app_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app_is_admin() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(current_setting('app.user_role', true) = 'admin', false)
$$;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_verification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_read_own ON users FOR SELECT USING (id = app_user_id() OR app_is_admin());
CREATE POLICY users_auth_lookup ON users FOR SELECT USING (
  email = NULLIF(current_setting('app.login_email', true), '')::citext
);
CREATE POLICY users_register ON users FOR INSERT WITH CHECK (
  email = NULLIF(current_setting('app.registration_email', true), '')::citext
);
CREATE POLICY users_update_own ON users FOR UPDATE USING (id = app_user_id() OR app_is_admin()) WITH CHECK (id = app_user_id() OR app_is_admin());
CREATE POLICY profiles_read_own ON profiles FOR SELECT USING (user_id = app_user_id() OR app_is_admin());
CREATE POLICY profiles_update_own ON profiles FOR UPDATE USING (user_id = app_user_id() OR app_is_admin()) WITH CHECK (user_id = app_user_id() OR app_is_admin());
CREATE POLICY profiles_insert_own ON profiles FOR INSERT WITH CHECK (user_id = app_user_id() OR app_is_admin());
CREATE POLICY user_roles_read_own ON user_roles FOR SELECT USING (user_id = app_user_id() OR app_is_admin());
CREATE POLICY user_roles_admin_write ON user_roles FOR ALL USING (app_is_admin()) WITH CHECK (app_is_admin());
CREATE POLICY user_roles_customer_bootstrap ON user_roles FOR INSERT WITH CHECK (
  user_id = app_user_id() AND role_id = (SELECT id FROM roles WHERE name = 'customer')
);

CREATE POLICY categories_public_read ON categories FOR SELECT USING (active OR app_is_admin());
CREATE POLICY categories_admin_write ON categories FOR ALL USING (app_is_admin()) WITH CHECK (app_is_admin());
CREATE POLICY products_public_read ON products FOR SELECT USING (active OR app_is_admin());
CREATE POLICY products_admin_write ON products FOR ALL USING (app_is_admin()) WITH CHECK (app_is_admin());
CREATE POLICY product_images_public_read ON product_images FOR SELECT USING (
  EXISTS (SELECT 1 FROM products p WHERE p.id = product_id AND (p.active OR app_is_admin()))
);
CREATE POLICY product_images_admin_write ON product_images FOR ALL USING (app_is_admin()) WITH CHECK (app_is_admin());
CREATE POLICY product_categories_public_read ON product_categories FOR SELECT USING (
  EXISTS (SELECT 1 FROM products p WHERE p.id = product_id AND (p.active OR app_is_admin()))
);
CREATE POLICY product_categories_admin_write ON product_categories FOR ALL USING (app_is_admin()) WITH CHECK (app_is_admin());
CREATE POLICY promotions_public_read ON promotions FOR SELECT USING (
  (active AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now())) OR app_is_admin()
);
CREATE POLICY promotions_admin_write ON promotions FOR ALL USING (app_is_admin()) WITH CHECK (app_is_admin());

CREATE POLICY orders_read_own ON orders FOR SELECT USING (user_id = app_user_id() OR app_is_admin());
CREATE POLICY orders_insert_own ON orders FOR INSERT WITH CHECK (user_id = app_user_id());
CREATE POLICY orders_admin_update ON orders FOR UPDATE USING (app_is_admin()) WITH CHECK (app_is_admin());
CREATE POLICY order_items_read_own ON order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND (o.user_id = app_user_id() OR app_is_admin()))
);
CREATE POLICY order_items_insert_own ON order_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.user_id = app_user_id())
);
CREATE POLICY order_items_admin_update ON order_items FOR UPDATE USING (app_is_admin()) WITH CHECK (app_is_admin());

CREATE POLICY sessions_read_own ON sessions FOR SELECT USING (
  user_id = app_user_id() OR token_hash = NULLIF(current_setting('app.session_hash', true), '') OR app_is_admin()
);
CREATE POLICY sessions_insert_own ON sessions FOR INSERT WITH CHECK (user_id = app_user_id() OR app_is_admin());
CREATE POLICY sessions_update_own ON sessions FOR UPDATE USING (
  user_id = app_user_id() OR token_hash = NULLIF(current_setting('app.session_hash', true), '') OR app_is_admin()
) WITH CHECK (user_id = app_user_id() OR app_is_admin());
CREATE POLICY verification_tokens_own ON email_verification_tokens FOR ALL USING (
  user_id = app_user_id() OR token_hash = NULLIF(current_setting('app.verification_hash', true), '') OR app_is_admin()
) WITH CHECK (user_id = app_user_id() OR app_is_admin());
CREATE POLICY reset_tokens_own ON password_reset_tokens FOR ALL USING (
  user_id = app_user_id() OR token_hash = NULLIF(current_setting('app.reset_hash', true), '') OR app_is_admin()
) WITH CHECK (user_id = app_user_id() OR app_is_admin());
CREATE POLICY login_attempts_server_insert ON login_attempts FOR INSERT WITH CHECK (
  current_setting('app.auth_event', true) = 'true'
);
CREATE POLICY audit_admin_read ON audit_logs FOR SELECT USING (app_is_admin());
CREATE POLICY audit_admin_insert ON audit_logs FOR INSERT WITH CHECK (app_is_admin());
CREATE POLICY idempotency_own ON idempotency_keys FOR ALL USING (user_id = app_user_id() OR app_is_admin()) WITH CHECK (user_id = app_user_id() OR app_is_admin());

INSERT INTO roles (name) VALUES ('customer'), ('admin'), ('editor'), ('support') ON CONFLICT DO NOTHING;
INSERT INTO categories (slug, name, sort_order) VALUES
  ('velas-aromaticas', 'Velas aromáticas', 10),
  ('wax-melts', 'Wax melts', 20),
  ('bouquets', 'Bouquets', 30),
  ('recordatorios', 'Recordatorios', 40),
  ('navidad', 'Navidad', 50)
ON CONFLICT (slug) DO NOTHING;
