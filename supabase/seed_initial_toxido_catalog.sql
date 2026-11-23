-- Manual, reviewable seed for the initial Toxido fragrance catalog.
-- This file is not run automatically. It does not modify existing unrelated products.
--
-- IMPORTANT STOCK NOTE: 10,000 units per variant is the quantity supplied by the
-- business. Physically verify inventory before activating any product or variant.
--
-- The repository currently contains these image filenames with a double suffix:
--   *.png.png
-- Their contents are PNG files. Paths below match the actual files on disk.
-- Each product stores both size images in products.images (50 ml first).
-- product_variants has no image column in the existing schema.

begin;

do $catalog_preflight$
begin
  if not exists (
    select 1 from public.product_categories
    where slug = 'fragrance' and is_active
  ) then
    raise exception 'Required active category fragrance is missing.';
  end if;

  -- A matching slug is safe to reuse only if it is already the intended inactive
  -- Toxido product and already contains both expected image paths. Never update it.
  if exists (
    select 1
      from (values
        ('toxido-ember', 'Toxido Ember', 'toxido-ember-50', '/images/products/toxido-ember-50.png.png', 'toxido-ember-100', '/images/products/toxido-ember-100.png.png'),
        ('toxido-wanted-night', 'Toxido Wanted Night', 'toxido-wanted-night-50', '/images/products/toxido-wanted-night-50.png.png', 'toxido-wanted-night-100', '/images/products/toxido-wanted-night-100.png.png'),
        ('toxido-erba', 'Toxido Erba', 'toxido-erba-50', '/images/products/toxido-erba-50.png.png', 'toxido-erba-100', '/images/products/toxido-erba-100.png.png')
      ) as expected(slug, name, image_50_id, image_50_url, image_100_id, image_100_url)
      join public.products p on p.slug = expected.slug
     where p.name is distinct from expected.name
        or p.brand is distinct from 'TOXIDO'
        or p.category is distinct from 'fragrance'
        or p.is_active is distinct from false
        or not (p.images @> jsonb_build_array(jsonb_build_object('id', expected.image_50_id, 'url', expected.image_50_url)))
        or not (p.images @> jsonb_build_array(jsonb_build_object('id', expected.image_100_id, 'url', expected.image_100_url)) )
  ) then
    raise exception 'A target product slug already has conflicting data, is active, or lacks the expected images. Review matching products before running this seed.';
  end if;

  -- Refuse to reuse an expected SKU if it belongs to another product or has
  -- different size, price, currency, active, or default settings. Stock is not
  -- compared: rerunning this seed must never reset inventory after it changes.
  if exists (
    select 1
      from (values
        ('toxido-ember', '50 ml', 'TX-SWU-50', 35000::bigint, true),
        ('toxido-ember', '100 ml', 'TX-SWU-100', 50000::bigint, false),
        ('toxido-wanted-night', '50 ml', 'TX-TMW-50', 35000::bigint, true),
        ('toxido-wanted-night', '100 ml', 'TX-TMW-100', 50000::bigint, false),
        ('toxido-erba', '50 ml', 'TX-ERP-50', 35000::bigint, true),
        ('toxido-erba', '100 ml', 'TX-ERP-100', 50000::bigint, false)
      ) as expected(slug, variant_name, sku, price_millimes, is_default)
      join public.product_variants v on v.sku = expected.sku
      left join public.products p on p.id = v.product_id
     where p.slug is distinct from expected.slug
        or v.name is distinct from expected.variant_name
        or v.price_millimes is distinct from expected.price_millimes
        or v.currency is distinct from 'TND'
        or v.is_active is distinct from false
        or v.is_default is distinct from expected.is_default
  ) then
    raise exception 'A target SKU already exists with conflicting data. Review matching variants before running this seed.';
  end if;

  -- Prevent a second SKU for an already-present size, and prevent an existing
  -- non-50 ml default from being silently left in place.
  if exists (
    select 1
      from (values
        ('toxido-ember', '50 ml', 'TX-SWU-50'), ('toxido-ember', '100 ml', 'TX-SWU-100'),
        ('toxido-wanted-night', '50 ml', 'TX-TMW-50'), ('toxido-wanted-night', '100 ml', 'TX-TMW-100'),
        ('toxido-erba', '50 ml', 'TX-ERP-50'), ('toxido-erba', '100 ml', 'TX-ERP-100')
      ) as expected(slug, variant_name, sku)
      join public.products p on p.slug = expected.slug
      join public.product_variants v on v.product_id = p.id and v.name = expected.variant_name
     where v.sku is distinct from expected.sku
  ) or exists (
    select 1
      from public.products p
      join public.product_variants v on v.product_id = p.id and v.is_default
     where p.slug in ('toxido-ember', 'toxido-wanted-night', 'toxido-erba')
       and v.sku not in ('TX-SWU-50', 'TX-TMW-50', 'TX-ERP-50')
  ) then
    raise exception 'A target size or default variant conflicts with existing data. Review the product variants before running this seed.';
  end if;
end;
$catalog_preflight$;

insert into public.products (
  slug, name, brand, description, category, images, is_active
)
values
  (
    'toxido-ember', 'Toxido Ember', 'TOXIDO',
    'An original Toxido fragrance.', 'fragrance',
    jsonb_build_array(
      jsonb_build_object('id', 'toxido-ember-50', 'alt', 'Toxido Ember 50 ml', 'url', '/images/products/toxido-ember-50.png.png', 'width', 1535, 'height', 1024),
      jsonb_build_object('id', 'toxido-ember-100', 'alt', 'Toxido Ember 100 ml', 'url', '/images/products/toxido-ember-100.png.png', 'width', 1536, 'height', 1024)
    ),
    false
  ),
  (
    'toxido-wanted-night', 'Toxido Wanted Night', 'TOXIDO',
    'An original Toxido fragrance.', 'fragrance',
    jsonb_build_array(
      jsonb_build_object('id', 'toxido-wanted-night-50', 'alt', 'Toxido Wanted Night 50 ml', 'url', '/images/products/toxido-wanted-night-50.png.png', 'width', 1536, 'height', 1024),
      jsonb_build_object('id', 'toxido-wanted-night-100', 'alt', 'Toxido Wanted Night 100 ml', 'url', '/images/products/toxido-wanted-night-100.png.png', 'width', 1536, 'height', 1024)
    ),
    false
  ),
  (
    'toxido-erba', 'Toxido Erba', 'TOXIDO',
    'An original Toxido fragrance.', 'fragrance',
    jsonb_build_array(
      jsonb_build_object('id', 'toxido-erba-50', 'alt', 'Toxido Erba 50 ml', 'url', '/images/products/toxido-erba-50.png.png', 'width', 1536, 'height', 1024),
      jsonb_build_object('id', 'toxido-erba-100', 'alt', 'Toxido Erba 100 ml', 'url', '/images/products/toxido-erba-100.png.png', 'width', 1536, 'height', 1024)
    ),
    false
  )
on conflict (slug) do nothing;

insert into public.product_variants (
  product_id, name, sku, price_millimes, currency, stock, is_active, is_default
)
select p.id, expected.variant_name, expected.sku, expected.price_millimes,
       'TND', 10000, false, expected.is_default
  from (values
    ('toxido-ember', 'Toxido Ember', '50 ml', 'TX-SWU-50', 35000::bigint, true),
    ('toxido-ember', 'Toxido Ember', '100 ml', 'TX-SWU-100', 50000::bigint, false),
    ('toxido-wanted-night', 'Toxido Wanted Night', '50 ml', 'TX-TMW-50', 35000::bigint, true),
    ('toxido-wanted-night', 'Toxido Wanted Night', '100 ml', 'TX-TMW-100', 50000::bigint, false),
    ('toxido-erba', 'Toxido Erba', '50 ml', 'TX-ERP-50', 35000::bigint, true),
    ('toxido-erba', 'Toxido Erba', '100 ml', 'TX-ERP-100', 50000::bigint, false)
  ) as expected(slug, product_name, variant_name, sku, price_millimes, is_default)
  join public.products p
    on p.slug = expected.slug
   and p.name = expected.product_name
   and p.brand = 'TOXIDO'
   and p.category = 'fragrance'
   and p.is_active = false
on conflict (sku) do nothing;

commit;

-- Read-only verification: target products and their saved image arrays.
select p.id, p.slug, p.name, p.brand, p.category, c.name as category_name,
       p.is_active, p.images
  from public.products p
  join public.product_categories c on c.slug = p.category
 where p.slug in ('toxido-ember', 'toxido-wanted-night', 'toxido-erba')
 order by p.slug;

-- Read-only verification: all variants attached to the target products, plus
-- any rows using the expected SKUs so a conflicting association is visible.
select v.id, p.slug as product_slug, p.name as product_name, v.name as size,
       v.sku, v.price_millimes, v.currency, v.stock, v.is_active, v.is_default
  from public.product_variants v
  left join public.products p on p.id = v.product_id
 where p.slug in ('toxido-ember', 'toxido-wanted-night', 'toxido-erba')
    or v.sku in ('TX-SWU-50', 'TX-SWU-100', 'TX-TMW-50', 'TX-TMW-100', 'TX-ERP-50', 'TX-ERP-100')
 order by p.slug, v.name, v.sku;

-- Read-only duplicate check for the requested SKUs.
select sku, count(*) as row_count
  from public.product_variants
 where sku in ('TX-SWU-50', 'TX-SWU-100', 'TX-TMW-50', 'TX-TMW-100', 'TX-ERP-50', 'TX-ERP-100')
 group by sku
having count(*) > 1;
