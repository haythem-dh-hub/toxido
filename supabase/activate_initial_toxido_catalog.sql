-- Toxido catalog activation: manual execution only.
-- Activates exactly the three listed products and six listed variants.
-- All checks run before either UPDATE; any failure aborts the transaction.
-- The script checks the supplied stock value (10,000 each); verify physical stock before running.

BEGIN;

DO $activation_preflight$
DECLARE
  actual_count integer;
  expected_count integer;
  affected_count integer;
BEGIN
  -- Serialize changes to the target records while validating and activating.
  PERFORM p.id
    FROM public.products p
   WHERE p.slug IN ('toxido-ember', 'toxido-wanted-night', 'toxido-erba')
   ORDER BY p.slug
   FOR UPDATE;

  PERFORM v.id
    FROM public.product_variants v
    JOIN public.products p ON p.id = v.product_id
   WHERE p.slug IN ('toxido-ember', 'toxido-wanted-night', 'toxido-erba')
      OR v.sku IN ('TX-SWU-50', 'TX-SWU-100', 'TX-TMW-50', 'TX-TMW-100', 'TX-ERP-50', 'TX-ERP-100')
   ORDER BY p.slug, v.sku
   FOR UPDATE OF v;

  -- Require the complete and exact target product set.
  SELECT count(*) INTO actual_count
    FROM public.products
   WHERE slug IN ('toxido-ember', 'toxido-wanted-night', 'toxido-erba');
  IF actual_count <> 3 THEN
    RAISE EXCEPTION 'Activation aborted: expected exactly 3 target products; found %.', actual_count;
  END IF;

  -- Require correct product identity/category and both corrected .png image URLs.
  IF EXISTS (
    SELECT 1
      FROM (VALUES
        ('toxido-ember', 'Toxido Ember', '/images/products/toxido-ember-50.png', '/images/products/toxido-ember-100.png'),
        ('toxido-wanted-night', 'Toxido Wanted Night', '/images/products/toxido-wanted-night-50.png', '/images/products/toxido-wanted-night-100.png'),
        ('toxido-erba', 'Toxido Erba', '/images/products/toxido-erba-50.png', '/images/products/toxido-erba-100.png')
      ) AS expected(slug, name, image_50, image_100)
      LEFT JOIN public.products p ON p.slug = expected.slug
     WHERE p.id IS NULL
        OR p.name IS DISTINCT FROM expected.name
        OR p.brand IS DISTINCT FROM 'TOXIDO'
        OR p.category IS DISTINCT FROM 'fragrance'
        OR NOT (p.images @> jsonb_build_array(jsonb_build_object('url', expected.image_50)))
        OR NOT (p.images @> jsonb_build_array(jsonb_build_object('url', expected.image_100)))
  ) THEN
    RAISE EXCEPTION 'Activation aborted: a target product identity, category, or .png image path does not match.';
  END IF;

  -- Require exactly six variants total on these products and exactly the six
  -- requested SKUs. This also prevents an unlisted variant being activated by
  -- mistake or leaving an unexpected extra variant in the launch catalog.
  SELECT count(*) INTO actual_count
    FROM public.product_variants v
    JOIN public.products p ON p.id = v.product_id
   WHERE p.slug IN ('toxido-ember', 'toxido-wanted-night', 'toxido-erba');
  IF actual_count <> 6 THEN
    RAISE EXCEPTION 'Activation aborted: expected exactly 6 variants on target products; found %.', actual_count;
  END IF;

  SELECT count(*) INTO actual_count
    FROM public.product_variants
   WHERE sku IN ('TX-SWU-50', 'TX-SWU-100', 'TX-TMW-50', 'TX-TMW-100', 'TX-ERP-50', 'TX-ERP-100');
  IF actual_count <> 6 THEN
    RAISE EXCEPTION 'Activation aborted: expected exactly 6 requested SKUs; found %.', actual_count;
  END IF;

  -- Validate SKU-to-product ownership, size, price, currency, stock and default.
  SELECT count(*) INTO expected_count
    FROM (VALUES
      ('toxido-ember', '50 ml', 'TX-SWU-50', 35000::bigint, 10000, true),
      ('toxido-ember', '100 ml', 'TX-SWU-100', 50000::bigint, 10000, false),
      ('toxido-wanted-night', '50 ml', 'TX-TMW-50', 35000::bigint, 10000, true),
      ('toxido-wanted-night', '100 ml', 'TX-TMW-100', 50000::bigint, 10000, false),
      ('toxido-erba', '50 ml', 'TX-ERP-50', 35000::bigint, 10000, true),
      ('toxido-erba', '100 ml', 'TX-ERP-100', 50000::bigint, 10000, false)
    ) AS expected(product_slug, variant_name, sku, price_millimes, stock, is_default)
    JOIN public.products p ON p.slug = expected.product_slug
    JOIN public.product_variants v ON v.sku = expected.sku AND v.product_id = p.id
   WHERE v.name = expected.variant_name
     AND v.price_millimes = expected.price_millimes
     AND v.currency = 'TND'
     AND v.stock = expected.stock
     AND v.is_default = expected.is_default;
  IF expected_count <> 6 THEN
    RAISE EXCEPTION 'Activation aborted: SKU ownership, size, price, stock, currency, or default-variant validation failed (% of 6 matched).', expected_count;
  END IF;

  -- Explicitly require one default per product, and that it is the 50 ml SKU.
  IF EXISTS (
    SELECT p.slug
      FROM public.products p
      JOIN public.product_variants v ON v.product_id = p.id
     WHERE p.slug IN ('toxido-ember', 'toxido-wanted-night', 'toxido-erba')
     GROUP BY p.slug
    HAVING count(*) FILTER (WHERE v.is_default) <> 1
        OR count(*) FILTER (WHERE v.is_default AND v.name = '50 ml') <> 1
  ) THEN
    RAISE EXCEPTION 'Activation aborted: each target product must have only its 50 ml variant marked default.';
  END IF;
END;
$activation_preflight$;

-- Scope each update to the explicit allowlist only. A row-count mismatch raises
-- inside the transaction, rolling back both updates.
DO $activate_allowlist$
DECLARE
  affected_count integer;
BEGIN
  UPDATE public.products
     SET is_active = true
   WHERE slug IN ('toxido-ember', 'toxido-wanted-night', 'toxido-erba');
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  IF affected_count <> 3 THEN
    RAISE EXCEPTION 'Activation aborted: expected to activate 3 products; updated %.', affected_count;
  END IF;

  UPDATE public.product_variants v
     SET is_active = true
    FROM public.products p
   WHERE p.id = v.product_id
     AND (p.slug, v.sku) IN (
       ('toxido-ember', 'TX-SWU-50'), ('toxido-ember', 'TX-SWU-100'),
       ('toxido-wanted-night', 'TX-TMW-50'), ('toxido-wanted-night', 'TX-TMW-100'),
       ('toxido-erba', 'TX-ERP-50'), ('toxido-erba', 'TX-ERP-100')
     );
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  IF affected_count <> 6 THEN
    RAISE EXCEPTION 'Activation aborted: expected to activate 6 variants; updated %.', affected_count;
  END IF;
END;
$activate_allowlist$;

COMMIT;

-- Read-only verification: exactly the three target products.
SELECT id, slug, name, category, is_active, images
  FROM public.products
 WHERE slug IN ('toxido-ember', 'toxido-wanted-night', 'toxido-erba')
 ORDER BY slug;

-- Read-only verification: exactly the six target variants and their unchanged data.
SELECT p.slug AS product_slug, v.name AS size, v.sku, v.price_millimes,
       v.currency, v.stock, v.is_default, v.is_active
  FROM public.product_variants v
  JOIN public.products p ON p.id = v.product_id
 WHERE v.sku IN ('TX-SWU-50', 'TX-SWU-100', 'TX-TMW-50', 'TX-TMW-100', 'TX-ERP-50', 'TX-ERP-100')
 ORDER BY p.slug, v.name;

-- Read-only count check: expected output is 3 active products and 6 active variants.
SELECT
  (SELECT count(*) FROM public.products
    WHERE slug IN ('toxido-ember', 'toxido-wanted-night', 'toxido-erba') AND is_active) AS active_target_products,
  (SELECT count(*) FROM public.product_variants
    WHERE sku IN ('TX-SWU-50', 'TX-SWU-100', 'TX-TMW-50', 'TX-TMW-100', 'TX-ERP-50', 'TX-ERP-100') AND is_active) AS active_target_variants;
