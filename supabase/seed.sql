-- Proposed TOXIDO original fragrances. This file is not run automatically.
-- Individual prices: 50 ml = 35 TND; 100 ml = 50 TND.
-- Stock is omitted so product_variants uses the schema default of zero until
-- physical inventory is confirmed. Images are omitted until approved assets exist.
-- Products and variants remain inactive until stock, SKUs and images are approved.
-- The internal inspiration references below are not written to public product fields.
insert into public.products (
  slug, name, brand, description, category, tags, is_active
)
values
  (
    'toxido-ember', 'Toxido Ember', 'TOXIDO',
    'An original Toxido fragrance with a warm, magnetic character. 50 ml.',
    'fragrance', array['original', 'fragrance', '50ml'], false
  ),
  (
    'toxido-wanted-night', 'Toxido Wanted Night', 'TOXIDO',
    'An original Toxido fragrance with a bold, intense character. 50 ml.',
    'fragrance', array['original', 'fragrance', '50ml'], false
  ),
  (
    'toxido-erba', 'Toxido Erba', 'TOXIDO',
    'An original Toxido fragrance with a bright, expressive character. 50 ml.',
    'fragrance', array['original', 'fragrance', '50ml'], false
  )
on conflict (slug) do nothing;

insert into public.product_variants (
  product_id, name, sku, price_millimes, currency, is_default, is_active
)
select p.id, v.variant_name, v.sku, v.price_millimes, 'TND', v.is_default, false
from (values
  ('toxido-ember', 'Toxido Ember', '50 ml', 'TX-EMBER-50', 35000::bigint, true),
  ('toxido-ember', 'Toxido Ember', '100 ml', 'TX-EMBER-100', 50000::bigint, false),
  ('toxido-wanted-night', 'Toxido Wanted Night', '50 ml', 'TX-WANTED-NIGHT-50', 35000::bigint, true),
  ('toxido-wanted-night', 'Toxido Wanted Night', '100 ml', 'TX-WANTED-NIGHT-100', 50000::bigint, false),
  ('toxido-erba', 'Toxido Erba', '50 ml', 'TX-ERBA-50', 35000::bigint, true),
  ('toxido-erba', 'Toxido Erba', '100 ml', 'TX-ERBA-100', 50000::bigint, false)
) as v(slug, product_name, variant_name, sku, price_millimes, is_default)
join public.products p on p.slug = v.slug and p.name = v.product_name
  and p.brand = 'TOXIDO' and p.category = 'fragrance'
on conflict (sku) do nothing;

-- Internal inspiration: Ember / Stronger With You;
-- Wanted Night / Azzaro The Most Wanted; Erba / Sospiro Erba Pura.
-- Do not use designer logos or represent these as authentic designer products.

-- Fixed offer: exactly one Ember + one Wanted Night + one Erba, 50 TND total.
-- The server-side RPC is defined in the matching migration. No gift is included
-- or charged until gift inventory and fulfillment are confirmed.
