-- Flouci hosted-card payments. Prepared for manual review/application; this file is not executed by the app.
-- Existing COD orders are backfilled as amount-due with zero historical delivery fee.

alter table public.orders
  drop constraint if exists orders_payment_method_check;

alter table public.orders
  add constraint orders_payment_method_check
    check (payment_method in ('cash_on_delivery', 'flouci')),
  add column if not exists payment_status text not null default 'cod_due'
    check (payment_status in ('cod_due', 'pending', 'paid', 'failed', 'expired', 'review_required')),
  add column if not exists shipping_millimes bigint not null default 0
    check (shipping_millimes >= 0),
  add column if not exists flouci_tracking_id uuid,
  add column if not exists flouci_payment_id text,
  add column if not exists flouci_payment_url text,
  add column if not exists inventory_released_at timestamptz,
  add column if not exists flouci_review_reason text;

alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check
  check (payment_status in ('cod_due', 'pending', 'paid', 'failed', 'expired', 'review_required'));

alter table public.orders
  add constraint orders_payment_details_check check (
    (payment_method = 'cash_on_delivery' and payment_status = 'cod_due'
      and flouci_tracking_id is null and flouci_payment_id is null and flouci_payment_url is null
      and inventory_released_at is null and flouci_review_reason is null)
    or
    (payment_method = 'flouci' and payment_status <> 'cod_due' and flouci_tracking_id is not null
      and (payment_status <> 'paid' or flouci_payment_id is not null))
  );

alter table public.orders add constraint orders_stock_reservation_state_check check (
  (inventory_released_at is null or
    (payment_method = 'flouci' and payment_status in ('failed', 'expired', 'review_required')))
  and (payment_status <> 'paid' or inventory_released_at is null)
);

create unique index if not exists orders_flouci_tracking_id_unique
  on public.orders(flouci_tracking_id) where flouci_tracking_id is not null;
create unique index if not exists orders_flouci_payment_id_unique
  on public.orders(flouci_payment_id) where flouci_payment_id is not null;
create index if not exists orders_pending_flouci_created_idx
  on public.orders(created_at) where payment_method = 'flouci' and payment_status = 'pending';

create table if not exists public.flouci_payment_events (
  event_id text primary key check (length(event_id) between 1 and 200),
  order_id uuid not null references public.orders(id) on delete restrict,
  payment_id text not null,
  event_type text not null check (event_type in ('payment.succeeded', 'payment.failed')),
  verified_status text not null check (verified_status in ('SUCCESS', 'FAILURE', 'EXPIRED')),
  received_at timestamptz not null default now()
);
create index if not exists flouci_payment_events_order_idx
  on public.flouci_payment_events(order_id, received_at desc);

alter table public.flouci_payment_events enable row level security;
revoke all on public.flouci_payment_events from public, anon, authenticated;
grant all on public.flouci_payment_events to service_role;

-- Definer functions below use pg_catalog built-ins plus schema-qualified objects only.
revoke create on schema public from public, anon, authenticated;

create or replace function public.create_store_order(
  p_idempotency_key uuid,
  p_customer jsonb,
  p_items jsonb,
  p_fixed_trio boolean,
  p_payment_method text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_line jsonb;
  v_product record;
  v_existing public.orders%rowtype;
  v_quantity integer;
  v_subtotal bigint := 0;
  v_discount bigint := 0;
  v_shipping bigint := 7000;
  v_total bigint;
  v_snapshots jsonb := '[]'::jsonb;
  v_order_id uuid;
  v_reference text;
  v_tracking uuid;
  v_component_count integer := 0;
begin
  if p_idempotency_key is null or jsonb_typeof(p_customer) is distinct from 'object'
     or jsonb_typeof(p_items) is distinct from 'array'
     or p_payment_method is null or p_payment_method not in ('cash_on_delivery', 'flouci')
     or p_fixed_trio is null then
    raise exception using errcode = '22023', message = 'INVALID_ORDER';
  end if;
  if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 30 then
    raise exception using errcode = '22023', message = 'INVALID_ORDER';
  end if;
  if p_fixed_trio then
    if jsonb_array_length(p_items) <> 1 or p_items->0->>'slug' <> 'toxido-fixed-trio'
       or coalesce(p_items->0->>'variantId', '') <> '' then
      raise exception using errcode = '22023', message = 'INVALID_ORDER';
    end if;
    if coalesce(p_items->0->>'quantity', '') !~ '^[0-9]{1,2}$' then
      raise exception using errcode = '22023', message = 'INVALID_ORDER';
    end if;
    if (p_items->0->>'quantity')::integer not between 1 and 50 then
      raise exception using errcode = '22023', message = 'INVALID_ORDER';
    end if;
  end if;
  if not p_fixed_trio and (select count(*) from jsonb_array_elements(p_items) x) <>
      (select count(distinct (x.value->>'slug', coalesce(x.value->>'variantId', 'DEFAULT'))) from jsonb_array_elements(p_items) x) then
    raise exception using errcode = '22023', message = 'INVALID_ORDER';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));
  select * into v_existing from public.orders where idempotency_key = p_idempotency_key for update;
  if found then
    if v_existing.payment_method <> p_payment_method
       or (coalesce(v_existing.promotion_code = 'TOXIDO_FIXED_TRIO', false) is distinct from p_fixed_trio) then
      raise exception using errcode = '22023', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    return jsonb_build_object(
      'reference', v_existing.reference, 'total_millimes', v_existing.total_millimes,
      'currency', v_existing.currency, 'payment_status', v_existing.payment_status,
      'tracking_id', v_existing.flouci_tracking_id, 'payment_id', v_existing.flouci_payment_id,
      'payment_url', v_existing.flouci_payment_url, 'created', false
    );
  end if;

  if p_fixed_trio then
    for v_product in
      select p.id as product_id, p.slug, p.name as product_name, p.brand, p.category,
             p.images->0->>'url' as image_url,
             v.id as variant_id, v.name as variant_name, v.sku, v.price_millimes, v.stock
        from (values ('toxido-ember'), ('toxido-erba'), ('toxido-wanted-night')) as fixed(slug)
        join public.products p on p.slug = fixed.slug
        join public.product_variants v on v.product_id = p.id
       where p.brand = 'TOXIDO' and p.category = 'fragrance' and p.is_active
         and v.name = '50 ml' and v.is_active and v.is_default
       order by p.slug for update of v
    loop
      v_component_count := v_component_count + 1;
      if v_product.price_millimes <> 35000 then
        raise exception using errcode = 'P0001', message = 'PROMOTION_UNAVAILABLE';
      end if;
      if v_product.stock < (p_items->0->>'quantity')::integer then
        raise exception using errcode = 'P0001', message = 'INSUFFICIENT_STOCK';
      end if;
      v_subtotal := v_subtotal + (v_product.price_millimes * (p_items->0->>'quantity')::integer);
      v_snapshots := v_snapshots || jsonb_build_array(jsonb_build_object(
        'product_id', v_product.product_id, 'variant_id', v_product.variant_id,
        'slug', v_product.slug, 'product_name', v_product.product_name,
        'brand_name', v_product.brand, 'category', v_product.category,
        'image_url', v_product.image_url, 'variant_name', v_product.variant_name,
        'sku', v_product.sku, 'unit_price_millimes', v_product.price_millimes,
        'quantity', (p_items->0->>'quantity')::integer, 'promotion_code', 'TOXIDO_FIXED_TRIO'
      ));
    end loop;
    if v_component_count <> 3 then
      raise exception using errcode = 'P0001', message = 'PROMOTION_UNAVAILABLE';
    end if;
    v_discount := 55000 * (p_items->0->>'quantity')::integer;
    if v_subtotal - v_discount <> 50000 * (p_items->0->>'quantity')::integer then
      raise exception using errcode = 'P0001', message = 'PROMOTION_UNAVAILABLE';
    end if;
  else
    for v_line in select value from jsonb_array_elements(p_items)
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
             coalesce((select img.value->>'url' from jsonb_array_elements(p.images) with ordinality img(value, ord)
                where lower(coalesce(img.value->>'alt', '')) like '%' || lower(v.name) || '%'
                order by img.ord limit 1), p.images->0->>'url') as image_url,
             v.id as variant_id, v.name as variant_name, v.sku, v.price_millimes, v.stock
        into v_product
        from public.products p join public.product_variants v on v.product_id = p.id
       where p.slug = v_line->>'slug' and p.is_active and v.is_active
         and ((v_line ? 'variantId' and v.id = (v_line->>'variantId')::uuid)
           or (not (v_line ? 'variantId') and v.is_default))
       for update of v;
      if not found then raise exception using errcode = 'P0001', message = 'PRODUCT_UNAVAILABLE'; end if;
      if v_product.stock < v_quantity then raise exception using errcode = 'P0001', message = 'INSUFFICIENT_STOCK'; end if;
      v_subtotal := v_subtotal + (v_product.price_millimes * v_quantity);
      v_snapshots := v_snapshots || jsonb_build_array(jsonb_build_object(
        'product_id', v_product.product_id, 'variant_id', v_product.variant_id,
        'slug', v_product.slug, 'product_name', v_product.product_name,
        'brand_name', v_product.brand, 'category', v_product.category,
        'image_url', v_product.image_url, 'variant_name', v_product.variant_name,
        'sku', v_product.sku, 'unit_price_millimes', v_product.price_millimes,
        'quantity', v_quantity
      ));
    end loop;
  end if;

  if length(trim(coalesce(p_customer->>'fullName', ''))) < 2
     or length(trim(p_customer->>'fullName')) > 100
     or length(trim(coalesce(p_customer->>'phone', ''))) < 8
     or length(trim(p_customer->>'phone')) > 16
     or p_customer->>'phone' !~ '^\+216[0-9]{8}$'
     or length(trim(coalesce(p_customer->>'email', ''))) > 254
     or length(trim(coalesce(p_customer->>'address', ''))) < 5
     or length(trim(p_customer->>'address')) > 250
     or length(trim(coalesce(p_customer->>'city', ''))) < 2
     or length(trim(p_customer->>'city')) > 100
     or length(trim(coalesce(p_customer->>'governorate', ''))) < 2
     or length(trim(p_customer->>'governorate')) > 100
     or not (lower(trim(p_customer->>'governorate')) = any (array[
       'ariana','beja','ben arous','bizerte','gabes','gafsa','jendouba','kairouan',
       'kasserine','kebili','kef','mahdia','manouba','medenine','monastir','nabeul',
       'sfax','sidi bouzid','siliana','sousse','tataouine','tozeur','tunis','zaghouan'
     ]::text[])) then
    raise exception using errcode = '22023', message = 'INVALID_ORDER';
  end if;

  v_total := v_subtotal - v_discount + v_shipping;
  v_tracking := case when p_payment_method = 'flouci' then gen_random_uuid() else null end;
  v_reference := 'TX-' || to_char(now() at time zone 'UTC', 'YYYYMMDD') || '-' ||
    upper(encode(extensions.gen_random_bytes(16), 'hex'));
  insert into public.orders (
    reference, idempotency_key, customer_name, customer_email, customer_phone,
    delivery_address, delivery_city, delivery_governorate, total_millimes,
    discount_millimes, promotion_code, payment_method, payment_status,
    shipping_millimes, flouci_tracking_id
  ) values (
    v_reference, p_idempotency_key, trim(p_customer->>'fullName'),
    nullif(trim(coalesce(p_customer->>'email', '')), ''), trim(p_customer->>'phone'),
    trim(p_customer->>'address'), trim(p_customer->>'city'), trim(p_customer->>'governorate'),
    v_total, v_discount, case when p_fixed_trio then 'TOXIDO_FIXED_TRIO' else null end,
    p_payment_method, case when p_payment_method = 'flouci' then 'pending' else 'cod_due' end,
    v_shipping, v_tracking
  ) returning id into v_order_id;

  for v_line in select value from jsonb_array_elements(v_snapshots) loop
    update public.product_variants set stock = stock - (v_line->>'quantity')::integer, updated_at = now()
     where id = (v_line->>'variant_id')::uuid;
    insert into public.order_items (
      order_id, product_id, variant_id, product_slug, product_name, brand_name, category,
      variant_name, sku, image_url, unit_price_millimes, quantity, line_total_millimes, promotion_code
    ) values (
      v_order_id, (v_line->>'product_id')::uuid, (v_line->>'variant_id')::uuid,
      v_line->>'slug', v_line->>'product_name', v_line->>'brand_name', v_line->>'category',
      v_line->>'variant_name', v_line->>'sku', v_line->>'image_url', (v_line->>'unit_price_millimes')::bigint,
      (v_line->>'quantity')::integer,
      (v_line->>'unit_price_millimes')::bigint * (v_line->>'quantity')::integer,
      v_line->>'promotion_code'
    );
  end loop;
  return jsonb_build_object('reference', v_reference, 'total_millimes', v_total,
    'currency', 'TND', 'payment_status', case when p_payment_method = 'flouci' then 'pending' else 'cod_due' end,
    'tracking_id', v_tracking, 'created', true);
end;
$$;

create or replace function public.create_cod_order(p_idempotency_key uuid, p_customer jsonb, p_items jsonb)
returns jsonb language sql security definer set search_path = pg_catalog as $$
  select public.create_store_order(p_idempotency_key, p_customer, p_items, false, 'cash_on_delivery');
$$;

create or replace function public.create_fixed_trio_cod_order(p_idempotency_key uuid, p_customer jsonb, p_quantity integer)
returns jsonb language sql security definer set search_path = pg_catalog as $$
  select public.create_store_order(p_idempotency_key, p_customer,
    jsonb_build_array(jsonb_build_object('slug', 'toxido-fixed-trio', 'quantity', p_quantity)), true, 'cash_on_delivery');
$$;

create or replace function public.create_flouci_order(
  p_idempotency_key uuid, p_customer jsonb, p_items jsonb, p_fixed_trio boolean
) returns jsonb language sql security definer set search_path = pg_catalog as $$
  select public.create_store_order(p_idempotency_key, p_customer, p_items, p_fixed_trio, 'flouci');
$$;

create or replace function public.record_flouci_payment_session(
  p_tracking_id uuid, p_payment_id text, p_payment_url text
) returns boolean language plpgsql security definer set search_path = pg_catalog as $$
declare v_updated integer;
begin
  if p_tracking_id is null or length(coalesce(p_payment_id, '')) not between 1 and 200
     or p_payment_url !~ '^https://checkout\.flouci\.com/' then
    raise exception using errcode = '22023', message = 'INVALID_PAYMENT_SESSION';
  end if;
  update public.orders set flouci_payment_id = p_payment_id, flouci_payment_url = p_payment_url
   where flouci_tracking_id = p_tracking_id and payment_method = 'flouci' and payment_status = 'pending'
     and (flouci_payment_id is null or flouci_payment_id = p_payment_id);
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.fail_flouci_initialization(p_tracking_id uuid)
returns boolean language plpgsql security definer set search_path = pg_catalog as $$
declare v_order public.orders%rowtype; v_item public.order_items%rowtype;
begin
  select * into v_order from public.orders where flouci_tracking_id = p_tracking_id for update;
  if not found or v_order.payment_method <> 'flouci' or v_order.payment_status <> 'pending'
     or v_order.flouci_payment_id is not null then return false; end if;
  for v_item in select * from public.order_items where order_id = v_order.id loop
    update public.product_variants set stock = stock + v_item.quantity, updated_at = now() where id = v_item.variant_id;
  end loop;
  update public.orders set payment_status = 'failed', status = 'cancelled',
    inventory_released_at = now(), flouci_review_reason = null
   where id = v_order.id and payment_status = 'pending';
  return true;
end;
$$;

create or replace function public.settle_flouci_payment_event(
  p_event_id text, p_event_type text, p_payment_id text, p_tracking_id uuid,
  p_amount_millimes bigint, p_currency text, p_verified_status text
) returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare v_order public.orders%rowtype; v_item public.order_items%rowtype;
begin
  if length(coalesce(p_event_id, '')) not between 1 and 200
     or p_payment_id is null or length(p_payment_id) not between 1 and 200
     or p_tracking_id is null or p_amount_millimes is null or p_currency is null
     or p_event_type not in ('payment.succeeded', 'payment.failed')
     or p_verified_status not in ('SUCCESS', 'FAILURE', 'EXPIRED') then
    raise exception using errcode = '22023', message = 'INVALID_PAYMENT_EVENT';
  end if;
  select * into v_order from public.orders where flouci_tracking_id = p_tracking_id for update;
  if not found or v_order.payment_method <> 'flouci'
     or v_order.total_millimes <> p_amount_millimes or p_currency <> 'TND'
     or (v_order.flouci_payment_id is not null and v_order.flouci_payment_id <> p_payment_id) then
    raise exception using errcode = '22023', message = 'PAYMENT_DETAILS_MISMATCH';
  end if;
  if exists (select 1 from public.flouci_payment_events where event_id = p_event_id) then
    return jsonb_build_object('accepted', true, 'duplicate', true, 'payment_status', v_order.payment_status);
  end if;
  insert into public.flouci_payment_events(event_id, order_id, payment_id, event_type, verified_status)
    values (p_event_id, v_order.id, p_payment_id, p_event_type, p_verified_status);
  if v_order.flouci_payment_id is null then
    update public.orders set flouci_payment_id = p_payment_id where id = v_order.id;
  end if;
  if (p_event_type = 'payment.succeeded' and p_verified_status <> 'SUCCESS')
     or (p_event_type = 'payment.failed' and p_verified_status not in ('FAILURE', 'EXPIRED')) then
    raise exception using errcode = '22023', message = 'PAYMENT_EVENT_STATUS_MISMATCH';
  end if;
  if v_order.payment_status in ('pending', 'review_required') and p_verified_status = 'SUCCESS'
     and v_order.inventory_released_at is null then
    update public.orders set payment_status = 'paid', flouci_review_reason = null where id = v_order.id;
    return jsonb_build_object('accepted', true, 'duplicate', false, 'payment_status', 'paid');
  elsif v_order.payment_status in ('pending', 'review_required') and p_verified_status in ('FAILURE', 'EXPIRED')
     and v_order.inventory_released_at is null then
    for v_item in select * from public.order_items where order_id = v_order.id loop
      update public.product_variants set stock = stock + v_item.quantity, updated_at = now() where id = v_item.variant_id;
    end loop;
    update public.orders set payment_status = case when p_verified_status = 'EXPIRED' then 'expired' else 'failed' end,
      status = 'cancelled', inventory_released_at = now(), flouci_review_reason = null where id = v_order.id;
    return jsonb_build_object('accepted', true, 'duplicate', false,
      'payment_status', case when p_verified_status = 'EXPIRED' then 'expired' else 'failed' end);
  elsif v_order.payment_status = 'paid' and p_verified_status = 'SUCCESS' then
    return jsonb_build_object('accepted', true, 'duplicate', false, 'payment_status', 'paid');
  elsif v_order.inventory_released_at is not null and p_verified_status = 'SUCCESS' then
    update public.orders set payment_status = 'review_required', status = 'cancelled',
      flouci_review_reason = 'late_success_after_stock_release' where id = v_order.id;
    return jsonb_build_object('accepted', true, 'duplicate', false, 'payment_status', 'review_required', 'reconciliation_required', true);
  end if;
  return jsonb_build_object('accepted', true, 'duplicate', false, 'payment_status', v_order.payment_status);
end;
$$;

create or replace function public.flouci_event_is_processed(p_event_id text)
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select exists (select 1 from public.flouci_payment_events where event_id = p_event_id);
$$;

revoke all on function public.create_store_order(uuid, jsonb, jsonb, boolean, text) from public, anon, authenticated;
revoke all on function public.create_cod_order(uuid, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.create_fixed_trio_cod_order(uuid, jsonb, integer) from public, anon, authenticated;
revoke all on function public.create_flouci_order(uuid, jsonb, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.record_flouci_payment_session(uuid, text, text) from public, anon, authenticated;
revoke all on function public.fail_flouci_initialization(uuid) from public, anon, authenticated;
revoke all on function public.settle_flouci_payment_event(text, text, text, uuid, bigint, text, text) from public, anon, authenticated;
revoke all on function public.flouci_event_is_processed(text) from public, anon, authenticated;
grant execute on function public.create_store_order(uuid, jsonb, jsonb, boolean, text) to service_role;
grant execute on function public.create_cod_order(uuid, jsonb, jsonb) to service_role;
grant execute on function public.create_fixed_trio_cod_order(uuid, jsonb, integer) to service_role;
grant execute on function public.create_flouci_order(uuid, jsonb, jsonb, boolean) to service_role;
grant execute on function public.record_flouci_payment_session(uuid, text, text) to service_role;
grant execute on function public.fail_flouci_initialization(uuid) to service_role;
grant execute on function public.settle_flouci_payment_event(text, text, text, uuid, bigint, text, text) to service_role;
grant execute on function public.flouci_event_is_processed(text) to service_role;

create or replace function public.get_public_order(p_reference text)
returns jsonb language sql stable security definer set search_path = pg_catalog as $$
  select jsonb_build_object('reference', o.reference, 'status', o.status,
    'total_millimes', o.total_millimes, 'currency', o.currency,
    'payment_method', o.payment_method, 'payment_status', o.payment_status)
    from public.orders o where o.reference = p_reference;
$$;

create or replace function public.flag_flouci_payment_review(p_tracking_id uuid, p_reason text)
returns boolean language plpgsql security definer set search_path = pg_catalog as $$
declare v_updated integer;
begin
  if p_tracking_id is null or p_reason is null or p_reason not in (
    'initialization_timeout', 'payment_id_missing', 'currency_unconfirmed',
    'provider_status_unknown', 'provider_unavailable', 'identity_mismatch',
    'late_success_after_stock_release'
  ) then
    raise exception using errcode = '22023', message = 'INVALID_RECONCILIATION_REVIEW';
  end if;
  update public.orders set payment_status = 'review_required', flouci_review_reason = p_reason,
    status = case when inventory_released_at is not null then 'cancelled' else status end
   where flouci_tracking_id = p_tracking_id and payment_method = 'flouci'
     and payment_status in ('pending', 'review_required', 'failed', 'expired');
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;
revoke all on function public.flag_flouci_payment_review(uuid, text) from public, anon, authenticated;
grant execute on function public.flag_flouci_payment_review(uuid, text) to service_role;
revoke all on function public.get_public_order(text) from public, authenticated;
grant execute on function public.get_public_order(text) to anon;
