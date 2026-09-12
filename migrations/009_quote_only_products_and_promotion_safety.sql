-- Products whose source catalog does not provide an exact variant price or
-- needs multiple free-form choices must be quoted manually, never charged at
-- a guessed minimum. Promotions stay inactive until checkout applies them.
ALTER TABLE products
  ADD COLUMN requires_consultation boolean NOT NULL DEFAULT false;

UPDATE products
   SET requires_consultation = true
 WHERE external_id IN (
   'wax-160', 'wax-100', 'rec-animals', 'rec-bears-cars', 'rec-flowers',
   'nav-dessert', 'nav-tree-glass'
 );

UPDATE promotions SET active = false WHERE active;
ALTER TABLE promotions
  ADD CONSTRAINT promotions_disabled_until_checkout CHECK (active = false);
