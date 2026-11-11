-- Live, automatically updated views over the authoritative public catalog.
-- Does not copy/delete products or change historical order items.
BEGIN;
CREATE OR REPLACE VIEW shopping_agent.live_products AS
SELECT 'public:' || id::text AS id, name::text, coalesce(description,'') AS description,
       coalesce(category,'')::text AS category, brand::text,
       round(price * 100)::integer AS price_minor, stock_quantity AS stock, is_active
FROM public.products;
CREATE OR REPLACE VIEW shopping_agent.live_reviews AS
SELECT 'public:' || id::text AS id, 'public:' || product_id::text AS product_id,
       rating::integer, coalesce(comment,'') AS text
FROM public.reviews;
ALTER TABLE shopping_agent.order_items ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE shopping_agent.order_items ADD COLUMN IF NOT EXISTS live_product_id integer REFERENCES public.products(id);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='order_items_one_catalog' AND conrelid='shopping_agent.order_items'::regclass) THEN
    ALTER TABLE shopping_agent.order_items ADD CONSTRAINT order_items_one_catalog CHECK ((product_id IS NULL) <> (live_product_id IS NULL));
  END IF;
END $$;
REVOKE ALL ON shopping_agent.live_products,shopping_agent.live_reviews FROM PUBLIC,anon,authenticated;
COMMIT;
