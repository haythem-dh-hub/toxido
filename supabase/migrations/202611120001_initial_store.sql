-- TOXIDO COD storefront schema. Prices are stored in Tunisian millimes (1 TND = 1,000 millimes).
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.product_categories (
  slug text primary key check (slug in ('fragrance', 'accessory')),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.product_categories(slug, name) values
  ('fragrance', 'Fragrance'), ('accessory', 'Accessory')
on conflict (slug) do nothing;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(trim(name)) between 1 and 160),
  brand text not null check (length(trim(brand)) between 1 and 120),
  description text not null default '',
  category text not null references public.product_categories(slug) on update cascade on delete restrict,
  images jsonb not null default '[]'::jsonb check (jsonb_typeof(images) = 'array'),
  tags text[] not null default '{}',
  fragrance_profile jsonb,
  is_featured boolean not null default false,
  best_seller boolean not null default false,
  new_arrival boolean not null default false,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 120),
  sku text not null unique check (length(trim(sku)) between 1 and 80),
  price_millimes bigint not null check (price_millimes > 0),
  currency char(3) not null default 'TND' check (currency = 'TND'),
  stock integer not null default 0 check (stock >= 0),
  is_default boolean not null default false,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_active_category_idx
  on public.products(category, name) where is_active;
create unique index if not exists product_variants_one_active_default
  on public.product_variants(product_id) where is_default and is_active;
create index if not exists product_variants_product_active_idx
  on public.product_variants(product_id, is_active);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  idempotency_key uuid not null unique,
  customer_name text not null check (length(trim(customer_name)) between 2 and 100),
  customer_email text check (customer_email is null or length(trim(customer_email)) <= 254),
  customer_phone text not null check (length(trim(customer_phone)) between 8 and 16),
  delivery_address text not null check (length(trim(delivery_address)) between 5 and 250),
  delivery_city text not null check (length(trim(delivery_city)) between 2 and 100),
  delivery_governorate text not null check (length(trim(delivery_governorate)) between 2 and 100),
  payment_method text not null default 'cash_on_delivery' check (payment_method = 'cash_on_delivery'),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'fulfilled')),
  currency char(3) not null default 'TND' check (currency = 'TND'),
  total_millimes bigint not null check (total_millimes > 0),
  created_at timestamptz not null default now()
);
create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists orders_status_created_idx on public.orders(status, created_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  product_slug text not null,
  product_name text not null,
  brand_name text not null,
  category text not null references public.product_categories(slug) on update cascade on delete restrict,
  variant_name text not null,
  sku text not null,
  image_url text,
  unit_price_millimes bigint not null check (unit_price_millimes > 0),
  quantity integer not null check (quantity between 1 and 50),
  line_total_millimes bigint not null check (line_total_millimes = unit_price_millimes * quantity),
  currency char(3) not null default 'TND' check (currency = 'TND'),
  created_at timestamptz not null default now()
);
create index if not exists order_items_order_idx on public.order_items(order_id);

alter table public.products enable row level security;
alter table public.product_categories enable row level security;
alter table public.product_variants enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "Anyone can read active products" on public.products;
create policy "Anyone can read active products" on public.products
  for select to anon, authenticated using (is_active);
drop policy if exists "Anyone can read active categories" on public.product_categories;
create policy "Anyone can read active categories" on public.product_categories
  for select to anon, authenticated using (is_active);
drop policy if exists "Anyone can read active variants" on public.product_variants;
create policy "Anyone can read active variants" on public.product_variants
  for select to anon, authenticated using (
    is_active and exists (
      select 1 from public.products p where p.id = product_id and p.is_active
    )
  );
grant select on public.product_categories, public.products, public.product_variants to anon, authenticated;
grant all on public.product_categories, public.products, public.product_variants, public.orders, public.order_items to service_role;
-- Orders and order items intentionally have no client policies. Only the server-side
-- service role may create or inspect them; the public confirmation RPC exposes no PII.

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

  if (select count(*) from jsonb_array_elements(p_items) x) <>
     (select count(distinct x.value->>'slug') from jsonb_array_elements(p_items) x) then
    raise exception using errcode = '22023', message = 'INVALID_ORDER';
  end if;

  -- Serialize requests with the same idempotency key until this transaction ends.
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));

  select * into v_existing from public.orders where idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('reference', v_existing.reference,
      'total_millimes', v_existing.total_millimes, 'currency', v_existing.currency);
  end if;

  -- Lock in slug order so overlapping carts acquire inventory locks consistently.
  for v_line in select value from jsonb_array_elements(p_items) order by value->>'slug' loop
    if coalesce(v_line->>'slug', '') !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
       or coalesce(v_line->>'quantity', '') !~ '^[0-9]+$' then
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
     where p.slug = v_line->>'slug' and p.is_active and v.is_active and v.is_default
     for update of v;
    if not found then
      select * into v_existing from public.orders where idempotency_key = p_idempotency_key;
      if found then
        return jsonb_build_object('reference', v_existing.reference,
          'total_millimes', v_existing.total_millimes, 'currency', v_existing.currency);
      end if;
      raise exception using errcode = 'P0001', message = 'PRODUCT_UNAVAILABLE';
    end if;
    -- A parallel retry can have waited for this inventory lock until the first
    -- request committed. Recheck before the new stock value is evaluated.
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

  -- A concurrent retry may have waited on the same inventory locks.
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

create or replace function public.get_public_order(p_reference text)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object('reference', o.reference, 'status', o.status,
    'total_millimes', o.total_millimes, 'currency', o.currency)
    from public.orders o where o.reference = p_reference;
$$;
revoke all on function public.get_public_order(text) from public, authenticated;
grant execute on function public.get_public_order(text) to anon;
