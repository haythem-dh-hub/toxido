-- Server-validated fixed Toxido trio offer. This migration is prepared only;
-- apply it through the normal reviewed Supabase migration process.
-- Adding defaulted/nullable columns does not update existing order rows.
alter table public.orders
  add column if not exists discount_millimes bigint not null default 0
    check (discount_millimes >= 0),
  add column if not exists promotion_code text;

alter table public.order_items
  add column if not exists promotion_code text;

create or replace function public.create_fixed_trio_cod_order(
  p_idempotency_key uuid,
  p_customer jsonb,
  p_quantity integer
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_product record;
  v_line jsonb;
  v_existing public.orders%rowtype;
  v_component_count integer := 0;
  v_subtotal bigint := 0;
  v_discount bigint;
  v_total bigint;
  v_snapshots jsonb := '[]'::jsonb;
  v_order_id uuid;
  v_reference text;
begin
  if p_idempotency_key is null or p_quantity is null or p_quantity < 1 or p_quantity > 50
     or jsonb_typeof(p_customer) <> 'object' then
    raise exception using errcode = '22023', message = 'INVALID_ORDER';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));
  select * into v_existing from public.orders where idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('reference', v_existing.reference,
      'total_millimes', v_existing.total_millimes, 'currency', v_existing.currency,
      'discount_millimes', v_existing.discount_millimes);
  end if;

  if length(trim(coalesce(p_customer->>'fullName', ''))) < 2
     or length(trim(p_customer->>'fullName')) > 100
     or length(trim(coalesce(p_customer->>'phone', ''))) < 8
     or length(trim(p_customer->>'phone')) > 16
     or length(trim(coalesce(p_customer->>'email', ''))) > 254
     or length(trim(coalesce(p_customer->>'address', ''))) < 5
     or length(trim(p_customer->>'address')) > 250
     or length(trim(coalesce(p_customer->>'city', ''))) < 2
     or length(trim(p_customer->>'city')) > 100
     or length(trim(coalesce(p_customer->>'governorate', ''))) < 2
     or length(trim(p_customer->>'governorate')) > 100 then
    raise exception using errcode = '22023', message = 'INVALID_ORDER';
  end if;

  -- Fixed server-side component list: the client cannot choose or reprice items.
  -- Lock all three active default 50 ml variants in slug order.
  for v_product in
    select p.id as product_id, p.slug, p.name as product_name, p.brand, p.category,
           p.images->0->>'url' as image_url,
           v.id as variant_id, v.name as variant_name, v.sku, v.price_millimes, v.stock
      from (values ('toxido-ember'), ('toxido-erba'), ('toxido-wanted-night')) as fixed(slug)
      join public.products p on p.slug = fixed.slug
      join public.product_variants v on v.product_id = p.id
     where p.brand = 'TOXIDO' and p.category = 'fragrance' and p.is_active
       and v.name = '50 ml' and v.is_active and v.is_default
     order by p.slug
     for update of v
  loop
    v_component_count := v_component_count + 1;
    if v_product.price_millimes <> 35000 then
      raise exception using errcode = 'P0001', message = 'PROMOTION_UNAVAILABLE';
    end if;
    if v_product.stock < p_quantity then
      raise exception using errcode = 'P0001', message = 'INSUFFICIENT_STOCK';
    end if;

    v_subtotal := v_subtotal + (v_product.price_millimes * p_quantity);
    v_snapshots := v_snapshots || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.product_id, 'variant_id', v_product.variant_id,
      'slug', v_product.slug, 'product_name', v_product.product_name,
      'brand_name', v_product.brand, 'category', v_product.category,
      'image_url', v_product.image_url, 'variant_name', v_product.variant_name,
      'sku', v_product.sku, 'unit_price_millimes', v_product.price_millimes,
      'quantity', p_quantity, 'promotion_code', 'TOXIDO_FIXED_TRIO'
    ));
  end loop;

  if v_component_count <> 3 then
    raise exception using errcode = 'P0001', message = 'PROMOTION_UNAVAILABLE';
  end if;

  -- Three individual 35,000 millime items remain priced at 35,000 each.
  -- Apply the 55,000 millime pack discount at order level for a 50,000 total.
  v_discount := 55000 * p_quantity;
  v_total := v_subtotal - v_discount;
  if v_total <> 50000 * p_quantity then
    raise exception using errcode = 'P0001', message = 'PROMOTION_UNAVAILABLE';
  end if;

  v_reference := 'TX-' || to_char(now() at time zone 'UTC', 'YYYYMMDD') || '-' ||
    upper(encode(extensions.gen_random_bytes(16), 'hex'));
  insert into public.orders (
    reference, idempotency_key, customer_name, customer_email, customer_phone,
    delivery_address, delivery_city, delivery_governorate,
    total_millimes, discount_millimes, promotion_code
  ) values (
    v_reference, p_idempotency_key, trim(p_customer->>'fullName'),
    nullif(trim(coalesce(p_customer->>'email', '')), ''), trim(p_customer->>'phone'),
    trim(p_customer->>'address'), trim(p_customer->>'city'),
    trim(p_customer->>'governorate'), v_total, v_discount, 'TOXIDO_FIXED_TRIO'
  ) returning id into v_order_id;

  for v_line in select value from jsonb_array_elements(v_snapshots) loop
    update public.product_variants
       set stock = stock - (v_line->>'quantity')::integer, updated_at = now()
     where id = (v_line->>'variant_id')::uuid;
    insert into public.order_items (
      order_id, product_id, variant_id, product_slug, product_name, brand_name,
      category, variant_name, sku, image_url, unit_price_millimes,
      quantity, line_total_millimes, promotion_code
    ) values (
      v_order_id, (v_line->>'product_id')::uuid, (v_line->>'variant_id')::uuid,
      v_line->>'slug', v_line->>'product_name', v_line->>'brand_name',
      v_line->>'category', v_line->>'variant_name', v_line->>'sku',
      v_line->>'image_url', (v_line->>'unit_price_millimes')::bigint,
      (v_line->>'quantity')::integer,
      (v_line->>'unit_price_millimes')::bigint * (v_line->>'quantity')::integer,
      v_line->>'promotion_code'
    );
  end loop;

  return jsonb_build_object('reference', v_reference, 'total_millimes', v_total,
    'currency', 'TND', 'discount_millimes', v_discount);
end;
$$;

revoke all on function public.create_fixed_trio_cod_order(uuid, jsonb, integer)
  from public, anon, authenticated;
grant execute on function public.create_fixed_trio_cod_order(uuid, jsonb, integer)
  to service_role;
