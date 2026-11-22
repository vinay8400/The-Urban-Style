-- Initial THE URBAN STYLE schema.
-- Product and category IDs remain text so existing local IDs can be imported.
-- New entities use UUIDs. No localStorage data is migrated by this migration.

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table private.store_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default pg_catalog.now()
);

alter table private.store_admins enable row level security;
revoke all on table private.store_admins from public, anon, authenticated;

create or replace function private.is_store_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, auth, private
as $function$
  select exists (
    select 1
    from private.store_admins as admin_user
    where admin_user.user_id = (select auth.uid())
  );
$function$;

revoke all on function private.is_store_admin() from public, anon, authenticated;
grant execute on function private.is_store_admin() to authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$function$;

revoke all on function private.set_updated_at() from public, anon, authenticated;

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  label text,
  recipient_name text not null,
  phone text not null,
  address_line text not null,
  city text not null,
  postal_code text not null,
  country text not null default 'India',
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint addresses_required_text_nonempty check (
    pg_catalog.length(pg_catalog.btrim(recipient_name)) > 0
    and pg_catalog.length(pg_catalog.btrim(phone)) > 0
    and pg_catalog.length(pg_catalog.btrim(address_line)) > 0
    and pg_catalog.length(pg_catalog.btrim(city)) > 0
    and pg_catalog.length(pg_catalog.btrim(postal_code)) > 0
    and pg_catalog.length(pg_catalog.btrim(country)) > 0
  )
);

create table public.categories (
  id text primary key,
  name text not null,
  parent_id text references public.categories (id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint categories_name_nonempty check (
    pg_catalog.length(pg_catalog.btrim(name)) > 0
  ),
  constraint categories_not_own_parent check (parent_id is distinct from id)
);

create unique index categories_root_name_unique
  on public.categories (pg_catalog.lower(name))
  where parent_id is null;

create unique index categories_child_name_unique
  on public.categories (parent_id, pg_catalog.lower(name))
  where parent_id is not null;

create index categories_parent_id_idx on public.categories (parent_id);

create table public.products (
  id text primary key,
  sku text not null,
  name text not null,
  description text not null default '',
  category_id text references public.categories (id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft', 'published')),
  original_price numeric(12, 2) not null check (original_price >= 0),
  discount_percent numeric(5, 2) not null default 0
    check (discount_percent >= 0 and discount_percent <= 100),
  selling_price numeric(12, 2)
    generated always as (
      pg_catalog.round(original_price * (1 - discount_percent / 100), 2)
    ) stored,
  featured boolean not null default false,
  low_stock_threshold integer not null default 5
    check (low_stock_threshold >= 0),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint products_sku_nonempty check (
    pg_catalog.length(pg_catalog.btrim(sku)) > 0
  ),
  constraint products_name_nonempty check (
    pg_catalog.length(pg_catalog.btrim(name)) > 0
  )
);

create unique index products_sku_case_insensitive_unique
  on public.products (pg_catalog.lower(sku));
create index products_published_category_idx
  on public.products (category_id, created_at desc)
  where status = 'published';
create index products_published_featured_idx
  on public.products (featured, created_at desc)
  where status = 'published';

create table public.product_colors (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products (id) on delete cascade,
  name text not null,
  hex_color text not null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint product_colors_name_nonempty check (
    pg_catalog.length(pg_catalog.btrim(name)) > 0
  ),
  constraint product_colors_hex_format check (hex_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint product_colors_product_id_id_unique unique (product_id, id)
);

create unique index product_colors_name_case_insensitive_unique
  on public.product_colors (product_id, pg_catalog.lower(name));
create index product_colors_product_id_idx
  on public.product_colors (product_id);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id text not null,
  color_id uuid not null,
  size text not null,
  stock integer not null default 0 check (stock >= 0),
  reserved_stock integer not null default 0 check (reserved_stock >= 0),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint product_variants_available_stock_nonnegative
    check (reserved_stock <= stock),
  constraint product_variants_size_nonempty check (
    pg_catalog.length(pg_catalog.btrim(size)) > 0
  ),
  constraint product_variants_product_color_size_unique
    unique (product_id, color_id, size),
  constraint product_variants_product_color_fk
    foreign key (product_id, color_id)
    references public.product_colors (product_id, id)
    on delete cascade
);

create index product_variants_product_size_idx
  on public.product_variants (product_id, size);
create index product_variants_color_id_idx
  on public.product_variants (color_id);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products (id) on delete cascade,
  storage_path text not null,
  sort_order integer not null default 0 check (sort_order >= 0),
  alt_text text,
  created_at timestamptz not null default pg_catalog.now(),
  constraint product_images_storage_path_nonempty check (
    pg_catalog.length(pg_catalog.btrim(storage_path)) > 0
  ),
  constraint product_images_product_sort_order_unique
    unique (product_id, sort_order),
  constraint product_images_storage_path_unique unique (storage_path)
);

create index product_images_product_id_idx
  on public.product_images (product_id, sort_order);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  idempotency_key uuid not null,
  request_fingerprint text not null,
  customer_id uuid references auth.users (id) on delete set null,
  customer_name_snapshot text not null,
  customer_phone_snapshot text not null,
  fulfillment_method text not null
    check (fulfillment_method in ('delivery', 'pickup')),
  address_id uuid references public.addresses (id) on delete set null,
  address_recipient_snapshot text,
  address_phone_snapshot text,
  address_line_snapshot text,
  city_snapshot text,
  postal_code_snapshot text,
  country_snapshot text,
  delivery_radius_status text not null default 'not_applicable'
    check (
      delivery_radius_status in (
        'not_applicable',
        'pending_verification',
        'eligible',
        'rejected'
      )
    ),
  payment_method text not null
    check (payment_method in ('upi', 'cod', 'store')),
  order_status text not null default 'pending_confirmation'
    check (
      order_status in (
        'pending_confirmation',
        'confirmed',
        'preparing',
        'dispatched',
        'fulfilled',
        'cancelled'
      )
    ),
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  delivery_charge numeric(12, 2) not null default 0
    check (delivery_charge >= 0),
  total numeric(12, 2) not null check (total >= 0),
  customer_notes text not null default '',
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint orders_idempotency_unique unique (customer_id, idempotency_key),
  constraint orders_total_consistent check (total = subtotal + delivery_charge),
  constraint orders_customer_snapshot_nonempty check (
    pg_catalog.length(pg_catalog.btrim(customer_name_snapshot)) > 0
    and pg_catalog.length(pg_catalog.btrim(customer_phone_snapshot)) > 0
  ),
  constraint orders_delivery_snapshot_required check (
    (
      fulfillment_method = 'delivery'
      and address_recipient_snapshot is not null
      and address_phone_snapshot is not null
      and address_line_snapshot is not null
      and city_snapshot is not null
      and postal_code_snapshot is not null
      and country_snapshot is not null
      and delivery_radius_status <> 'not_applicable'
    )
    or
    (
      fulfillment_method = 'pickup'
      and address_id is null
      and address_recipient_snapshot is null
      and address_phone_snapshot is null
      and address_line_snapshot is null
      and city_snapshot is null
      and postal_code_snapshot is null
      and country_snapshot is null
      and delivery_radius_status = 'not_applicable'
    )
  )
);

create index orders_customer_created_idx
  on public.orders (customer_id, created_at desc);
create index orders_status_created_idx
  on public.orders (order_status, created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id text not null references public.products (id) on delete restrict,
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  product_name_snapshot text not null,
  sku_snapshot text not null,
  size_snapshot text not null,
  color_snapshot text not null,
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  line_total numeric(12, 2) not null check (line_total >= 0),
  created_at timestamptz not null default pg_catalog.now(),
  constraint order_items_line_total_consistent
    check (line_total = unit_price * quantity),
  constraint order_items_order_variant_unique unique (order_id, variant_id)
);

create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_product_id_idx on public.order_items (product_id);
create index order_items_variant_id_idx on public.order_items (variant_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  method text not null check (method in ('upi', 'cod', 'store')),
  amount numeric(12, 2) not null check (amount >= 0),
  status text not null
    check (
      status in (
        'pending',
        'pending_verification',
        'paid',
        'failed',
        'refund_pending',
        'refunded'
      )
    ),
  upi_reference text,
  verified_by uuid references auth.users (id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint payments_upi_reference_method check (
    method = 'upi' or upi_reference is null
  ),
  constraint payments_verification_fields check (
    (status = 'paid' and verified_by is not null and verified_at is not null)
    or status <> 'paid'
  )
);

create index payments_order_id_idx on public.payments (order_id);
create index payments_status_created_idx on public.payments (status, created_at desc);

create table public.store_settings (
  id smallint primary key default 1 check (id = 1),
  store_name text not null default 'THE URBAN STYLE',
  public_address text not null default
    'Behind RPS Inter College, Itaunja, Lucknow, Uttar Pradesh, India - 226203',
  public_phone text not null default '8090365996',
  alternate_phone text not null default '7388026659',
  delivery_enabled boolean not null default true,
  maximum_delivery_radius_km numeric(6, 2) not null default 10
    check (maximum_delivery_radius_km > 0),
  standard_delivery_radius_km numeric(6, 2) not null default 5
    check (
      standard_delivery_radius_km > 0
      and standard_delivery_radius_km <= maximum_delivery_radius_km
    ),
  store_pickup_enabled boolean not null default true,
  delivery_charges_admin_managed boolean not null default true,
    delivery_charge numeric(12, 2) not null default 0
      check (delivery_charge >= 0),
    updated_at timestamptz not null default pg_catalog.now()
);

insert into public.store_settings (id)
values (1)
on conflict (id) do nothing;

revoke all on table
  public.profiles,
  public.addresses,
  public.categories,
  public.products,
  public.product_colors,
  public.product_variants,
  public.product_images,
  public.orders,
  public.order_items,
  public.payments,
  public.store_settings
from public, anon, authenticated;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger addresses_set_updated_at
before update on public.addresses
for each row execute function private.set_updated_at();

create trigger categories_set_updated_at
before update on public.categories
for each row execute function private.set_updated_at();

create trigger products_set_updated_at
before update on public.products
for each row execute function private.set_updated_at();

create trigger product_colors_set_updated_at
before update on public.product_colors
for each row execute function private.set_updated_at();

create trigger product_variants_set_updated_at
before update on public.product_variants
for each row execute function private.set_updated_at();

create trigger orders_set_updated_at
before update on public.orders
for each row execute function private.set_updated_at();

create trigger payments_set_updated_at
before update on public.payments
for each row execute function private.set_updated_at();

comment on table public.product_variants is
  'stock is physical inventory; reserved_stock is committed to unfulfilled orders; available inventory is stock - reserved_stock.';
comment on table public.order_items is
  'Snapshots preserve the ordered product and price even if catalogue data later changes.';
comment on table public.payments is
  'Order/payment status are separate; order creation never records COD or store payments as paid.';
comment on table private.store_admins is
  'Private owner/admin allowlist. Manage through trusted database administration only, never from client-facing APIs.';

alter table public.profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_colors enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.store_settings enable row level security;

create policy profiles_select_own
  on public.profiles for select to authenticated
  using (user_id = (select auth.uid()));
create policy profiles_insert_own
  on public.profiles for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy profiles_update_own
  on public.profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy addresses_owner_all
  on public.addresses for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy categories_public_active_read
  on public.categories for select to anon, authenticated
  using (active);
create policy categories_admin_all
  on public.categories for all to authenticated
  using ((select private.is_store_admin()))
  with check ((select private.is_store_admin()));

create policy products_public_published_read
  on public.products for select to anon, authenticated
  using (status = 'published');
create policy products_admin_all
  on public.products for all to authenticated
  using ((select private.is_store_admin()))
  with check ((select private.is_store_admin()));

create policy product_colors_published_read
  on public.product_colors for select to anon, authenticated
  using (
    exists (
      select 1
      from public.products as product
      where product.id = product_id
        and product.status = 'published'
    )
  );
create policy product_colors_admin_all
  on public.product_colors for all to authenticated
  using ((select private.is_store_admin()))
  with check ((select private.is_store_admin()));

create policy product_variants_published_read
  on public.product_variants for select to anon, authenticated
  using (
    exists (
      select 1
      from public.products as product
      where product.id = product_id
        and product.status = 'published'
    )
  );
create policy product_variants_admin_all
  on public.product_variants for all to authenticated
  using ((select private.is_store_admin()))
  with check ((select private.is_store_admin()));

create policy product_images_published_read
  on public.product_images for select to anon, authenticated
  using (
    exists (
      select 1
      from public.products as product
      where product.id = product_id
        and product.status = 'published'
    )
  );
create policy product_images_admin_all
  on public.product_images for all to authenticated
  using ((select private.is_store_admin()))
  with check ((select private.is_store_admin()));

create policy orders_customer_read
  on public.orders for select to authenticated
  using (customer_id = (select auth.uid()));
create policy orders_admin_read
  on public.orders for select to authenticated
  using ((select private.is_store_admin()));

create policy order_items_customer_read
  on public.order_items for select to authenticated
  using (
    exists (
      select 1
      from public.orders as customer_order
      where customer_order.id = order_id
        and customer_order.customer_id = (select auth.uid())
    )
  );
create policy order_items_admin_read
  on public.order_items for select to authenticated
  using ((select private.is_store_admin()));

create policy payments_customer_read
  on public.payments for select to authenticated
  using (
    exists (
      select 1
      from public.orders as customer_order
      where customer_order.id = order_id
        and customer_order.customer_id = (select auth.uid())
    )
  );
create policy payments_admin_read
  on public.payments for select to authenticated
  using ((select private.is_store_admin()));
create policy payments_admin_update
  on public.payments for update to authenticated
  using ((select private.is_store_admin()))
  with check ((select private.is_store_admin()));

create policy store_settings_public_read
  on public.store_settings for select to anon, authenticated
  using (true);
create policy store_settings_admin_update
  on public.store_settings for update to authenticated
  using ((select private.is_store_admin()))
  with check ((select private.is_store_admin()));

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', false)
on conflict (id) do update
set public = false;

create policy product_images_storage_admin_all
  on storage.objects for all to authenticated
  using (
    bucket_id = 'product-images'
    and (select private.is_store_admin())
  )
  with check (
    bucket_id = 'product-images'
    and (select private.is_store_admin())
  );

grant select on
  public.categories,
  public.products,
  public.product_colors,
  public.product_variants,
  public.product_images,
  public.store_settings
to anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.addresses to authenticated;

grant insert, update, delete on
  public.categories,
  public.products,
  public.product_colors,
  public.product_variants,
  public.product_images
to authenticated;
grant update on public.store_settings to authenticated;

grant select on public.orders, public.order_items, public.payments
to authenticated;
grant update on public.payments to authenticated;

create or replace function public.create_order_and_reserve_stock(
  p_idempotency_key uuid,
  p_fulfillment_method text,
  p_payment_method text,
  p_variant_items jsonb,
  p_address_id uuid default null,
  p_customer_notes text default '',
  p_upi_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, auth, private
as $function$
declare
  v_customer_id uuid := (select auth.uid());
  v_profile public.profiles%rowtype;
  v_address public.addresses%rowtype;
  v_existing_order_id uuid;
  v_existing_fingerprint text;
  v_fingerprint text;
  v_items jsonb;
  v_item record;
  v_variant record;
  v_store public.store_settings%rowtype;
  v_subtotal numeric(12, 2) := 0;
  v_delivery_charge numeric(12, 2) := 0;
  v_order_id uuid;
  v_order_number text;
begin
  if v_customer_id is null then
    raise exception 'Authentication is required to place an order.';
  end if;
  if p_idempotency_key is null then
    raise exception 'An idempotency key is required.';
  end if;
  if p_fulfillment_method is null
     or p_fulfillment_method not in ('delivery', 'pickup') then
    raise exception 'Unsupported fulfillment method.';
  end if;
  if p_payment_method is null
     or p_payment_method not in ('upi', 'cod', 'store') then
    raise exception 'Unsupported payment method.';
  end if;
  if p_payment_method = 'upi'
     and pg_catalog.length(pg_catalog.btrim(coalesce(p_upi_reference, ''))) = 0 then
    raise exception 'A UPI transaction reference is required for manual verification.';
  end if;
  if p_payment_method <> 'upi' and p_upi_reference is not null then
    raise exception 'A UPI reference is valid only for UPI payments.';
  end if;
  if p_customer_notes is not null and pg_catalog.length(p_customer_notes) > 4000 then
    raise exception 'Customer notes exceed the permitted length.';
  end if;
  if p_variant_items is null
     or pg_catalog.jsonb_typeof(p_variant_items) <> 'array'
     or pg_catalog.jsonb_array_length(p_variant_items) = 0 then
    raise exception 'At least one product variant is required.';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_to_recordset(p_variant_items)
      as requested(variant_id uuid, quantity integer)
    where requested.variant_id is null
       or requested.quantity is null
       or requested.quantity <= 0
  ) then
    raise exception 'Each requested variant must have a valid ID and positive integer quantity.';
  end if;

  select pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'variant_id', grouped.variant_id,
      'quantity', grouped.quantity
    )
    order by grouped.variant_id
  )
  into v_items
  from (
    select requested.variant_id, pg_catalog.sum(requested.quantity::bigint) as quantity
    from pg_catalog.jsonb_to_recordset(p_variant_items)
      as requested(variant_id uuid, quantity integer)
    group by requested.variant_id
  ) as grouped;

  if exists (
    select 1
    from pg_catalog.jsonb_to_recordset(v_items)
      as requested(variant_id uuid, quantity bigint)
    where requested.quantity > 2147483647
  ) then
    raise exception 'Requested quantity exceeds the supported limit.';
  end if;

  v_fingerprint := pg_catalog.md5(
    pg_catalog.jsonb_build_object(
      'fulfillment_method', p_fulfillment_method,
      'payment_method', p_payment_method,
      'items', v_items,
      'address_id', p_address_id,
      'customer_notes', coalesce(p_customer_notes, ''),
      'upi_reference', p_upi_reference
    )::text
  );

  -- Serialize retries with the same customer/key before checking for an order.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_customer_id::text || p_idempotency_key::text, 0)
  );

  select customer_order.id, customer_order.request_fingerprint
  into v_existing_order_id, v_existing_fingerprint
  from public.orders as customer_order
  where customer_order.customer_id = v_customer_id
    and customer_order.idempotency_key = p_idempotency_key
  for update;

  if v_existing_order_id is not null then
    if v_existing_fingerprint <> v_fingerprint then
      raise exception 'This idempotency key was already used for a different order request.';
    end if;
    return v_existing_order_id;
  end if;

  select *
  into v_profile
  from public.profiles
  where user_id = v_customer_id
  for share;

  if not found
     or pg_catalog.length(pg_catalog.btrim(coalesce(v_profile.full_name, ''))) = 0
     or pg_catalog.length(pg_catalog.btrim(coalesce(v_profile.phone, ''))) = 0 then
    raise exception 'Complete your customer profile name and phone before placing an order.';
  end if;

  if p_fulfillment_method = 'delivery' then
    select *
    into v_store
    from public.store_settings
    where id = 1
    for share;
    if not found or not v_store.delivery_enabled then
      raise exception 'Local delivery is currently unavailable.';
    end if;
    v_delivery_charge := v_store.delivery_charge;
    if p_address_id is null then
      raise exception 'A saved delivery address is required.';
    end if;
    select *
    into v_address
    from public.addresses
    where id = p_address_id
      and user_id = v_customer_id
    for share;
    if not found then
      raise exception 'The selected delivery address does not belong to this customer.';
    end if;
  else
    select *
    into v_store
    from public.store_settings
    where id = 1
    for share;
    if not found or not v_store.store_pickup_enabled then
      raise exception 'Store pickup is currently unavailable.';
    end if;
    if p_address_id is not null then
      raise exception 'Store pickup orders must not include a delivery address.';
    end if;
  end if;

  -- Lock product rows before variant rows so price edits and reservations serialize.
  perform product.id
  from public.products as product
  join public.product_variants as variant
    on variant.product_id = product.id
  join pg_catalog.jsonb_to_recordset(v_items)
    as requested(variant_id uuid, quantity bigint)
    on requested.variant_id = variant.id
  order by product.id
  for share of product;

  -- Row locks serialize competing reservations; all locks use a stable order.
  perform variant.id
  from public.product_variants as variant
  join pg_catalog.jsonb_to_recordset(v_items)
    as requested(variant_id uuid, quantity bigint)
    on requested.variant_id = variant.id
  order by variant.id
  for update of variant;

  for v_item in
    select requested.variant_id, requested.quantity
    from pg_catalog.jsonb_to_recordset(v_items)
      as requested(variant_id uuid, quantity bigint)
    order by requested.variant_id
  loop
    select
      variant.id,
      variant.product_id,
      variant.color_id,
      variant.size,
      variant.stock,
      variant.reserved_stock,
      product.name as product_name,
      product.sku,
      product.status as product_status,
      product.selling_price,
      color.name as color_name
    into v_variant
    from public.product_variants as variant
    join public.products as product on product.id = variant.product_id
    join public.product_colors as color
      on color.id = variant.color_id
     and color.product_id = variant.product_id
    where variant.id = v_item.variant_id;

    if not found or v_variant.product_status <> 'published' then
      raise exception 'A requested product variant is unavailable.';
    end if;
    if v_variant.stock - v_variant.reserved_stock < v_item.quantity then
      raise exception 'Insufficient available stock for product % (%, %).',
        v_variant.product_name, v_variant.color_name, v_variant.size;
    end if;

    v_subtotal := v_subtotal + (v_variant.selling_price * v_item.quantity);
  end loop;

  v_order_number := 'TUS-' ||
    pg_catalog.upper(pg_catalog.substr(pg_catalog.replace(gen_random_uuid()::text, '-', ''), 1, 12));

  insert into public.orders (
    order_number,
    idempotency_key,
    request_fingerprint,
    customer_id,
    customer_name_snapshot,
    customer_phone_snapshot,
    fulfillment_method,
    address_id,
    address_recipient_snapshot,
    address_phone_snapshot,
    address_line_snapshot,
    city_snapshot,
    postal_code_snapshot,
    country_snapshot,
    delivery_radius_status,
    payment_method,
    order_status,
    subtotal,
    delivery_charge,
    total,
    customer_notes
  )
  values (
    v_order_number,
    p_idempotency_key,
    v_fingerprint,
    v_customer_id,
    v_profile.full_name,
    v_profile.phone,
    p_fulfillment_method,
    case when p_fulfillment_method = 'delivery' then v_address.id else null end,
    case when p_fulfillment_method = 'delivery' then v_address.recipient_name else null end,
    case when p_fulfillment_method = 'delivery' then v_address.phone else null end,
    case when p_fulfillment_method = 'delivery' then v_address.address_line else null end,
    case when p_fulfillment_method = 'delivery' then v_address.city else null end,
    case when p_fulfillment_method = 'delivery' then v_address.postal_code else null end,
    case when p_fulfillment_method = 'delivery' then v_address.country else null end,
    case
      when p_fulfillment_method = 'delivery' then 'pending_verification'
      else 'not_applicable'
    end,
    p_payment_method,
    'pending_confirmation',
    v_subtotal,
    v_delivery_charge,
    v_subtotal + v_delivery_charge,
    coalesce(p_customer_notes, '')
  )
  returning id into v_order_id;

  for v_item in
    select requested.variant_id, requested.quantity
    from pg_catalog.jsonb_to_recordset(v_items)
      as requested(variant_id uuid, quantity bigint)
    order by requested.variant_id
  loop
    select
      variant.id,
      variant.product_id,
      variant.color_id,
      variant.size,
      variant.stock,
      variant.reserved_stock,
      product.name as product_name,
      product.sku,
      product.status as product_status,
      product.selling_price,
      color.name as color_name
    into v_variant
    from public.product_variants as variant
    join public.products as product on product.id = variant.product_id
    join public.product_colors as color
      on color.id = variant.color_id
     and color.product_id = variant.product_id
    where variant.id = v_item.variant_id;

    update public.product_variants
    set reserved_stock = reserved_stock + v_item.quantity
    where id = v_variant.id
      and stock - reserved_stock >= v_item.quantity;

    if not found then
      raise exception 'Available stock changed while placing the order.';
    end if;

    insert into public.order_items (
      order_id,
      product_id,
      variant_id,
      product_name_snapshot,
      sku_snapshot,
      size_snapshot,
      color_snapshot,
      unit_price,
      quantity,
      line_total
    )
    values (
      v_order_id,
      v_variant.product_id,
      v_variant.id,
      v_variant.product_name,
      v_variant.sku,
      v_variant.size,
      v_variant.color_name,
      v_variant.selling_price,
      v_item.quantity,
      v_variant.selling_price * v_item.quantity
    );
  end loop;

  insert into public.payments (
    order_id,
    method,
    amount,
    status,
    upi_reference
  )
  values (
    v_order_id,
    p_payment_method,
    v_subtotal + v_delivery_charge,
    case
      when p_payment_method = 'upi' then 'pending_verification'
      else 'pending'
    end,
    p_upi_reference
  );

  return v_order_id;
end;
$function$;

revoke all on function public.create_order_and_reserve_stock(
  uuid, text, text, jsonb, uuid, text, text
) from public, anon, authenticated;
grant execute on function public.create_order_and_reserve_stock(
  uuid, text, text, jsonb, uuid, text, text
) to authenticated;

create or replace function public.cancel_order(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, auth, private
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_order public.orders%rowtype;
  v_item record;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found.';
  end if;
  if v_order.customer_id is distinct from v_user_id
     and not (select private.is_store_admin()) then
    raise exception 'You are not allowed to cancel this order.';
  end if;
  if v_order.order_status = 'cancelled' then
    return v_order.id;
  end if;
  if v_order.order_status = 'fulfilled' then
    raise exception 'A fulfilled order cannot be cancelled.';
  end if;
  if not (select private.is_store_admin())
     and v_order.order_status <> 'pending_confirmation' then
    raise exception 'Customers may cancel only orders awaiting store confirmation.';
  end if;

  for v_item in
    select variant_id, quantity
    from public.order_items
    where order_id = v_order.id
    order by variant_id
  loop
    update public.product_variants
    set reserved_stock = reserved_stock - v_item.quantity
    where id = v_item.variant_id
      and reserved_stock >= v_item.quantity;

    if not found then
      raise exception 'Unable to release a missing or inconsistent stock reservation.';
    end if;
  end loop;

  update public.orders
  set order_status = 'cancelled'
  where id = v_order.id;

  update public.payments
  set status = 'refund_pending'
  where order_id = v_order.id
    and method = 'upi'
    and status = 'paid';

  return v_order.id;
end;
$function$;

revoke all on function public.cancel_order(uuid) from public, anon, authenticated;
grant execute on function public.cancel_order(uuid) to authenticated;

create or replace function public.fulfill_order(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, auth, private
as $function$
declare
  v_order public.orders%rowtype;
  v_item record;
begin
  if (select auth.uid()) is null
     or not (select private.is_store_admin()) then
    raise exception 'Store admin permission is required.';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found.';
  end if;
  if v_order.order_status = 'fulfilled' then
    return v_order.id;
  end if;
  if v_order.order_status = 'cancelled' then
    raise exception 'A cancelled order cannot be fulfilled.';
  end if;
  if v_order.payment_method = 'upi'
     and not exists (
       select 1
       from public.payments as order_payment
       where order_payment.order_id = v_order.id
         and order_payment.method = 'upi'
         and order_payment.status = 'paid'
         and order_payment.verified_by is not null
         and order_payment.verified_at is not null
     ) then
    raise exception 'UPI payment must be verified before order fulfilment.';
  end if;
  if v_order.order_status not in ('confirmed', 'preparing', 'dispatched') then
    raise exception 'Only confirmed orders may be fulfilled.';
  end if;

  for v_item in
    select variant_id, quantity
    from public.order_items
    where order_id = v_order.id
    order by variant_id
  loop
    update public.product_variants
    set
      stock = stock - v_item.quantity,
      reserved_stock = reserved_stock - v_item.quantity
    where id = v_item.variant_id
      and stock >= v_item.quantity
      and reserved_stock >= v_item.quantity;

    if not found then
      raise exception 'Unable to deduct a missing or inconsistent stock reservation.';
    end if;
  end loop;

  update public.orders
  set order_status = 'fulfilled'
  where id = v_order.id;

  return v_order.id;
end;
$function$;

revoke all on function public.fulfill_order(uuid) from public, anon, authenticated;
grant execute on function public.fulfill_order(uuid) to authenticated;

create or replace function public.advance_order_status(
  p_order_id uuid,
  p_next_status text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, auth, private
as $function$
declare
  v_order public.orders%rowtype;
  v_valid_transition boolean;
begin
  if (select auth.uid()) is null
     or not (select private.is_store_admin()) then
    raise exception 'Store admin permission is required.';
  end if;

  if p_next_status not in ('confirmed', 'preparing', 'dispatched') then
    raise exception 'Use the cancellation or fulfilment function for terminal order states.';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found.';
  end if;

  v_valid_transition :=
    (v_order.order_status = 'pending_confirmation' and p_next_status = 'confirmed')
    or (v_order.order_status = 'confirmed' and p_next_status = 'preparing')
    or (v_order.order_status = 'preparing' and p_next_status = 'dispatched');

  if not v_valid_transition then
    raise exception 'Invalid order status transition from % to %.',
      v_order.order_status, p_next_status;
  end if;

  update public.orders
  set order_status = p_next_status
  where id = v_order.id;

  return v_order.id;
end;
$function$;

revoke all on function public.advance_order_status(uuid, text)
from public, anon, authenticated;
grant execute on function public.advance_order_status(uuid, text)
to authenticated;
