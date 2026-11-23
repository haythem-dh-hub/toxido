-- Allow COD requests to identify a product variant. Prices, SKUs, and stock
-- continue to come from the locked database row, never from the request body.
create or replace function public.create_cod_order(
  p_idempotency_key uuid,
  p_customer jsonb,
  p_items jsonb
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_line jsonb;
  v_product record;
  v_quantity integer;
  v_total bigint := 0;
  v_snapshots jsonb := '[]'::jsonb;
  v_order_id uuid;
  v_reference text;
  v_existing public.orders%rowtype;
begin
  if p_idempotency_key is null or jsonb_typeof(p_customer) <> 'object'
     or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1
     or jsonb_array_length(p_items) > 30 then
    raise exception using errcode = '22023', message = 'INVALID_ORDER';
  end if;

  -- A product may appear more than once only when the variants differ.
  if (select count(*) from jsonb_array_elements(p_items) x) <>
     (select count(distinct (x.value->>'slug', coalesce(x.value->>'variantId', 'DEFAULT'))) from jsonb_array_elements(p_items) x) then
    raise exception using errcode = '22023', message = 'INVALID_ORDER';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));
  select * into v_existing from public.orders where idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('reference', v_existing.reference,
      'total_millimes', v_existing.total_millimes, 'currency', v_existing.currency);
  end if;

  -- Lock selected variants in a stable order so mixed-size carts avoid deadlocks.
  for v_line in
    select value from jsonb_array_elements(p_items)
    order by value->>'slug', coalesce(value->>'variantId', 'DEFAULT')
  loop
    if coalesce(v_line->>'slug', '') !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
       or coalesce(v_line->>'quantity', '') !~ '^[0-9]+$'
       or ((v_line ? 'variantId') and coalesce(v_line->>'variantId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') then
      raise exception using errcode = '22023', message = 'INVALID_ORDER';
    end if;
    v_quantity := (v_line->>'quantity')::integer;
    if v_quantity < 1 or v_quantity > 50 then
      raise exception using errcode = '22023', message = 'INVALID_ORDER';
    end if;

    select p.id as product_id, p.slug, p.name as product_name, p.brand, p.category,
           p.images->0->>'url' as image_url,
           v.id as variant_id, v.name as variant_name, v.sku, v.price_millimes, v.stock
      into v_product
      from public.products p
      join public.product_variants v on v.product_id = p.id
     where p.slug = v_line->>'slug' and p.is_active and v.is_active
       and ((v_line ? 'variantId' and v.id = (v_line->>'variantId')::uuid)
         or (not (v_line ? 'variantId') and v.is_default))
     for update of v;
    if not found then
      select * into v_existing from public.orders where idempotency_key = p_idempotency_key;
      if found then
        return jsonb_build_object('reference', v_existing.reference,
          'total_millimes', v_existing.total_millimes, 'currency', v_existing.currency);
      end if;
      raise exception using errcode = 'P0001', message = 'PRODUCT_UNAVAILABLE';
    end if;

    select * into v_existing from public.orders where idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object('reference', v_existing.reference,
        'total_millimes', v_existing.total_millimes, 'currency', v_existing.currency);
    end if;
    if v_product.stock < v_quantity then
      raise exception using errcode = 'P0001', message = 'INSUFFICIENT_STOCK';
    end if;

    v_total := v_total + (v_product.price_millimes * v_quantity);
    v_snapshots := v_snapshots || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.product_id, 'variant_id', v_product.variant_id,
      'slug', v_product.slug, 'product_name', v_product.product_name,
      'brand_name', v_product.brand, 'category', v_product.category,
      'image_url', v_product.image_url, 'variant_name', v_product.variant_name,
      'sku', v_product.sku, 'unit_price_millimes', v_product.price_millimes,
      'quantity', v_quantity
    ));
  end loop;

  select * into v_existing from public.orders where idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('reference', v_existing.reference,
      'total_millimes', v_existing.total_millimes, 'currency', v_existing.currency);
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

  v_reference := 'TX-' || to_char(now() at time zone 'UTC', 'YYYYMMDD') || '-' ||
    upper(encode(extensions.gen_random_bytes(16), 'hex'));
  insert into public.orders (
    reference, idempotency_key, customer_name, customer_email, customer_phone,
    delivery_address, delivery_city, delivery_governorate, total_millimes
  ) values (
    v_reference, p_idempotency_key, trim(p_customer->>'fullName'),
    nullif(trim(coalesce(p_customer->>'email', '')), ''), trim(p_customer->>'phone'),
    trim(p_customer->>'address'), trim(p_customer->>'city'), trim(p_customer->>'governorate'), v_total
  ) returning id into v_order_id;

  for v_line in select value from jsonb_array_elements(v_snapshots) loop
    update public.product_variants
       set stock = stock - (v_line->>'quantity')::integer, updated_at = now()
     where id = (v_line->>'variant_id')::uuid;
    insert into public.order_items (
      order_id, product_id, variant_id, product_slug, product_name, brand_name, category,
      variant_name, sku, image_url, unit_price_millimes, quantity, line_total_millimes
    ) values (
      v_order_id, (v_line->>'product_id')::uuid, (v_line->>'variant_id')::uuid,
      v_line->>'slug', v_line->>'product_name', v_line->>'brand_name', v_line->>'category',
      v_line->>'variant_name', v_line->>'sku', v_line->>'image_url', (v_line->>'unit_price_millimes')::bigint,
      (v_line->>'quantity')::integer,
      (v_line->>'unit_price_millimes')::bigint * (v_line->>'quantity')::integer
    );
  end loop;

  return jsonb_build_object('reference', v_reference, 'total_millimes', v_total, 'currency', 'TND');
end;
$$;

revoke all on function public.create_cod_order(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_cod_order(uuid, jsonb, jsonb) to service_role;
