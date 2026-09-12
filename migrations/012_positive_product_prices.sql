-- Celestial has no zero-price checkout flow. Reject accidental blank-to-zero
-- edits at the database boundary as well as in the admin UI and API.
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_price_cop_check;
ALTER TABLE products
  ADD CONSTRAINT products_price_cop_positive CHECK (price_cop BETWEEN 1 AND 100000000);
