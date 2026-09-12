-- Record the informed privacy authorization presented during guest checkout.
-- Existing orders predate this control, so preserve their creation time as the
-- best available historical marker before making the column mandatory.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamptz;
UPDATE orders SET privacy_accepted_at = created_at WHERE privacy_accepted_at IS NULL;
ALTER TABLE orders ALTER COLUMN privacy_accepted_at SET DEFAULT now();
ALTER TABLE orders ALTER COLUMN privacy_accepted_at SET NOT NULL;
