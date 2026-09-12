-- Older create-order responses could contain the raw guest token and a
-- WhatsApp URL with customer data. Remove those short-lived cache rows and
-- make the invariant enforceable at the database boundary.
DELETE FROM idempotency_keys WHERE scope = 'create-order';

ALTER TABLE idempotency_keys
  ADD CONSTRAINT idempotency_response_has_no_guest_secrets CHECK (
    response_body IS NULL
    OR NOT (response_body ?| ARRAY['guestToken', 'whatsappUrl'])
  );
