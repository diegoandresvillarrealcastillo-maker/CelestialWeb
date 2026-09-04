ALTER TABLE orders
  ADD COLUMN payment_status text NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'pending_verification', 'verified', 'rejected')),
  ADD COLUMN receipt_path text,
  ADD COLUMN receipt_uploaded_at timestamptz;

CREATE INDEX orders_payment_status_idx ON orders (payment_status, created_at DESC);

CREATE TABLE payment_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  bank_key text,
  account_holder text,
  qr_image_url text,
  instructions text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER payment_settings_set_updated_at BEFORE UPDATE ON payment_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY payment_settings_public_read ON payment_settings FOR SELECT USING (true);
CREATE POLICY payment_settings_admin_write ON payment_settings FOR ALL USING (app_is_admin()) WITH CHECK (app_is_admin());

CREATE POLICY orders_customer_receipt_update ON orders FOR UPDATE
  USING (user_id = app_user_id() AND payment_status IN ('pending', 'rejected'))
  WITH CHECK (user_id = app_user_id());

INSERT INTO payment_settings (id) VALUES (true) ON CONFLICT DO NOTHING;
