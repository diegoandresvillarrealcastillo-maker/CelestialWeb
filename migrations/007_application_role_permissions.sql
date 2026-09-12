-- The API role needs SQL privileges as well as RLS authorization. Keep grants
-- explicit so a compromised public Supabase role still has no table access.
GRANT SELECT ON roles TO celestial_app;
GRANT SELECT, INSERT, UPDATE ON categories, products, promotions TO celestial_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON product_images, product_categories TO celestial_app;
GRANT SELECT, UPDATE ON payment_settings TO celestial_app;
GRANT SELECT, UPDATE ON users, profiles TO celestial_app;
GRANT SELECT ON user_roles TO celestial_app;
GRANT SELECT, INSERT, UPDATE ON sessions, password_reset_tokens, login_attempts, audit_logs, idempotency_keys TO celestial_app;
GRANT SELECT, INSERT, UPDATE ON orders, order_items TO celestial_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO celestial_app;
GRANT SELECT ON schema_migrations TO celestial_app;
