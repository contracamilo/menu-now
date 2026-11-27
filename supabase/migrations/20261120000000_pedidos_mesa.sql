-- add-pedidos-mesa: mesas con QR, pedidos anónimos desde la mesa y su consulta.
-- Ver openspec/changes/archive/2026-11-19-add-pedidos-mesa/design.md (D2–D5).

------------------------------------------------------------------------------
-- D2. Modelo de datos
------------------------------------------------------------------------------

-- Zona horaria del local (no editable desde la interfaz; acción manual si no es la peninsular).
-- Una zona inexistente hace fallar el check.
alter table public.venue_settings
  add column timezone text not null default 'Europe/Madrid'
  check ((timestamptz '2000-01-01 00:00+00' at time zone timezone) is not null);

-- Día de servicio: fecha local que cambia a las 05:00 (no reinicia la numeración a medianoche)
create function public.current_service_day() returns date
language sql stable security definer set search_path = '' as $$
  select ((now() at time zone v.timezone) - interval '5 hours')::date
    from public.venue_settings v;
$$;

create table public.tables (
  id          uuid primary key default gen_random_uuid(),
  token       uuid not null unique default gen_random_uuid(),  -- lo que va en el QR
  name        text not null check (char_length(btrim(name)) between 1 and 20),
  archived_at timestamptz,
  created_at  timestamptz not null default now()
);
create unique index tables_active_name_unique on public.tables (lower(btrim(name)))
  where archived_at is null;

create type public.order_status as enum ('received');  -- panel-cocina añadirá valores

create table public.orders (
  id          uuid primary key,                -- lo genera el cliente: idempotencia (D3)
  table_id    uuid not null references public.tables(id) on delete restrict,
  service_day date not null,
  number      integer not null check (number > 0),
  status      public.order_status not null default 'received',
  total_cents integer not null check (total_cents > 0),
  created_at  timestamptz not null default now(),
  constraint orders_number_per_day unique (service_day, number)
);
create index orders_table_day_idx on public.orders (table_id, service_day);

create table public.order_items (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders(id) on delete cascade,
  position         integer not null,
  dish_id          uuid not null references public.dishes(id) on delete restrict,
  size_id          uuid references public.dish_sizes(id) on delete set null,
  dish_name        text not null,             -- copia al confirmar
  size_label       text,                      -- copia al confirmar (null = tamaño sin nombre)
  unit_price_cents integer not null check (unit_price_cents > 0),
  quantity         integer not null check (quantity between 1 and 20),
  note             text check (note is null or char_length(note) between 1 and 140),
  constraint order_items_position_unique unique (order_id, position)
);

-- Contador por día de servicio: una fila por día, incrementada con bloqueo de fila
create table public.order_counters (
  service_day date primary key,
  last_number integer not null
);

------------------------------------------------------------------------------
-- D4. Representación de un pedido (uso interno de las funciones públicas)
------------------------------------------------------------------------------

create function public.order_json(p_order_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', o.id,
    'number', o.number,
    'status', o.status,
    'table_name', t.name,
    'total_cents', o.total_cents,
    'created_at', o.created_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'dish_name', i.dish_name,
               'size_label', i.size_label,
               'unit_price_cents', i.unit_price_cents,
               'quantity', i.quantity,
               'note', i.note) order by i.position)
        from public.order_items i where i.order_id = o.id), '[]'::jsonb))
  from public.orders o join public.tables t on t.id = o.table_id
  where o.id = p_order_id;
$$;

------------------------------------------------------------------------------
-- D3. Confirmar el pedido: anónima, atómica e idempotente
--   p_items: [{dish_id, size_id, quantity, note?, unit_price_cents}]
--   Devuelve {status: placed | rejected | table_unavailable, ...}
------------------------------------------------------------------------------

create function public.place_order(p_order_id uuid, p_table_token uuid, p_items jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_existing_table uuid;
  v_table_id uuid;
  v_count integer;
  v_item record;
  v_current record;
  v_unavailable jsonb := '[]'::jsonb;
  v_changes jsonb := '[]'::jsonb;
  v_total integer := 0;
  v_day date;
  v_number integer;
begin
  if p_order_id is null or p_table_token is null or p_items is null
     or jsonb_typeof(p_items) <> 'array' then
    raise exception 'invalid order' using errcode = '22023';
  end if;

  -- 1. Idempotencia: el mismo pedido confirmado otra vez devuelve el ya registrado
  select o.table_id into v_existing_table from public.orders o where o.id = p_order_id;
  if found then
    if v_existing_table is distinct from (select id from public.tables where token = p_table_token) then
      raise exception 'order belongs to another table' using errcode = '22023';
    end if;
    return jsonb_build_object('status', 'placed', 'order', public.order_json(p_order_id));
  end if;

  -- 2. Mesa activa
  select id into v_table_id from public.tables where token = p_table_token and archived_at is null;
  if not found then
    return jsonb_build_object('status', 'table_unavailable');
  end if;

  -- 3. Forma
  v_count := jsonb_array_length(p_items);
  if v_count < 1 or v_count > 50 then
    raise exception 'an order needs between 1 and 50 lines' using errcode = '22023';
  end if;

  -- 4. Disponibilidad y precio de cada línea contra el estado actual
  for v_item in
    select (e->>'dish_id')::uuid as dish_id,
           (e->>'size_id')::uuid as size_id,
           (e->>'quantity')::integer as quantity,
           nullif(btrim(e->>'note'), '') as note,
           (e->>'unit_price_cents')::integer as unit_price_cents
      from jsonb_array_elements(p_items) as t(e)
  loop
    if v_item.dish_id is null or v_item.size_id is null or v_item.unit_price_cents is null
       or v_item.quantity is null or v_item.quantity not between 1 and 20
       or char_length(coalesce(v_item.note, '')) > 140 then
      raise exception 'invalid order line' using errcode = '22023';
    end if;

    select d.name, s.price_cents into v_current
      from public.dishes d
      join public.categories c on c.id = d.category_id
      join public.dish_sizes s on s.dish_id = d.id and s.id = v_item.size_id
     where d.id = v_item.dish_id
       and d.archived_at is null and c.archived_at is null and not c.is_included;

    if not found then
      v_unavailable := v_unavailable || jsonb_build_object(
        'dish_id', v_item.dish_id, 'size_id', v_item.size_id,
        'dish_name', (select name from public.dishes where id = v_item.dish_id));
    elsif v_current.price_cents <> v_item.unit_price_cents then
      v_changes := v_changes || jsonb_build_object(
        'dish_id', v_item.dish_id, 'size_id', v_item.size_id,
        'dish_name', v_current.name, 'price_cents', v_current.price_cents);
    else
      v_total := v_total + v_current.price_cents * v_item.quantity;
    end if;
  end loop;

  -- 5. Rechazo sin insertar nada
  if jsonb_array_length(v_unavailable) > 0 or jsonb_array_length(v_changes) > 0 then
    return jsonb_build_object('status', 'rejected', 'unavailable', v_unavailable, 'price_changes', v_changes);
  end if;

  -- 6. Número del día y registro con copia de nombre, tamaño y precio
  begin
    v_day := public.current_service_day();
    insert into public.order_counters (service_day, last_number) values (v_day, 1)
      on conflict (service_day) do update set last_number = public.order_counters.last_number + 1
      returning last_number into v_number;

    insert into public.orders (id, table_id, service_day, number, total_cents)
    values (p_order_id, v_table_id, v_day, v_number, v_total);

    insert into public.order_items (order_id, position, dish_id, size_id, dish_name, size_label,
                                    unit_price_cents, quantity, note)
    select p_order_id, t.ord, d.id, s.id, d.name, s.label, s.price_cents,
           (t.e->>'quantity')::integer, nullif(btrim(t.e->>'note'), '')
      from jsonb_array_elements(p_items) with ordinality as t(e, ord)
      join public.dishes d on d.id = (t.e->>'dish_id')::uuid
      join public.dish_sizes s on s.id = (t.e->>'size_id')::uuid;
  exception when unique_violation then
    -- Dos confirmaciones simultáneas del mismo pedido: gana la primera
    if exists (select 1 from public.orders where id = p_order_id and table_id = v_table_id) then
      return jsonb_build_object('status', 'placed', 'order', public.order_json(p_order_id));
    end if;
    raise;
  end;

  return jsonb_build_object('status', 'placed', 'order', public.order_json(p_order_id));
end;
$$;

------------------------------------------------------------------------------
-- D4. Lecturas públicas: mesa del QR y «Mis pedidos»
------------------------------------------------------------------------------

-- Nombre y estado de la mesa del QR (ninguna fila si el token no existe)
create function public.get_table(p_token uuid)
returns table (name text, active boolean)
language sql stable security definer set search_path = '' as $$
  select t.name, t.archived_at is null from public.tables t where t.token = p_token;
$$;

-- Pedidos del día de servicio de esa mesa cuyos id conoce el móvil, del más reciente al más antiguo
create function public.get_orders(p_table_token uuid, p_order_ids uuid[])
returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(public.order_json(o.id) order by o.created_at desc), '[]'::jsonb)
    from public.orders o join public.tables t on t.id = o.table_id
   where t.token = p_table_token
     and o.id = any(coalesce(p_order_ids, '{}'))
     and o.service_day = public.current_service_day();
$$;

------------------------------------------------------------------------------
-- D5. RLS y permisos
------------------------------------------------------------------------------

alter table public.tables         enable row level security;
alter table public.orders         enable row level security;
alter table public.order_items    enable row level security;
alter table public.order_counters enable row level security;

-- Mesas: solo el dueño lee y escribe; sin borrado
create policy "owner read tables" on public.tables
  for select to authenticated using (public.is_owner());
create policy "owner insert tables" on public.tables
  for insert to authenticated with check (public.is_owner());
create policy "owner update tables" on public.tables
  for update to authenticated using (public.is_owner()) with check (public.is_owner());

revoke all on public.tables from anon;
-- El token no se elige ni se cambia desde la API (renombrar no cambia el QR)
revoke insert, update, delete, truncate on public.tables from authenticated;
grant insert (name) on public.tables to authenticated;
grant update (name, archived_at) on public.tables to authenticated;

-- Pedidos: sin políticas ni permisos → solo place_order / get_orders
revoke all on public.orders, public.order_items, public.order_counters from anon, authenticated;

-- Funciones: las internas no se exponen; las públicas, a anon y authenticated
revoke execute on function public.order_json(uuid) from public, anon, authenticated;
revoke execute on function public.current_service_day() from public, anon, authenticated;
revoke execute on function public.place_order(uuid, uuid, jsonb) from public;
revoke execute on function public.get_table(uuid) from public;
revoke execute on function public.get_orders(uuid, uuid[]) from public;
grant execute on function public.place_order(uuid, uuid, jsonb) to anon, authenticated;
grant execute on function public.get_table(uuid) to anon, authenticated;
grant execute on function public.get_orders(uuid, uuid[]) to anon, authenticated;
