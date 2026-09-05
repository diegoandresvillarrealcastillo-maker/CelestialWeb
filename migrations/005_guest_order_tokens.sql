-- Guest orders were authorized by UUID alone (an attacker who learned/guessed an
-- order id could upload or replace its payment receipt). Add a per-order secret
-- token; only its SHA-256 hash is stored, mirroring session/reset tokens.
ALTER TABLE orders ADD COLUMN guest_token_hash char(64);

COMMENT ON COLUMN orders.guest_token_hash IS
  'SHA-256 hash of the one-time token returned to a guest at checkout; required (with the order id) to attach a payment receipt to a guest order. NULL for authenticated orders and for guest orders created before this column existed.';
