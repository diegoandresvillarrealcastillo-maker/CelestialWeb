-- Supabase auto-enables RLS on every new table created in the public schema.
-- `roles` and `schema_migrations` were never meant to carry row-level policies
-- (a handful of reference rows and internal tooling metadata, both already
-- gated by GRANT alone) but ended up RLS-enabled with zero policies, which is
-- deny-all for any non-bypassing role. That silently breaks role resolution
-- (every login needs to read `roles`) and the startup security check (which
-- reads `schema_migrations`) the moment the API stops connecting as an
-- RLS-bypassing owner. Disable RLS on both to match the original intent.
ALTER TABLE roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE schema_migrations DISABLE ROW LEVEL SECURITY;
