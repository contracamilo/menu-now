-- add-panel-cocina: cuentas de personal, ciclo de estados del pedido, lectura del panel y Realtime.
-- Ver openspec/changes/add-panel-cocina/design.md (D2–D5).

------------------------------------------------------------------------------
-- D2. Rol de personal, marcas de tiempo por estado
------------------------------------------------------------------------------

alter table public.backoffice_users drop constraint backoffice_users_role_check;
alter table public.backoffice_users
  add constraint backoffice_users_role_check check (role in ('owner', 'staff'));

-- Personal o dueño: quien gestiona los pedidos
create function public.can_manage_orders() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.backoffice_users
                 where user_id = auth.uid() and role in ('owner', 'staff'));
$$;

-- Momento de cada cambio de estado; coherencia estado ↔ marcas en la propia tabla
alter table public.orders
  add column preparing_at timestamptz,
  add column served_at    timestamptz,
  add column cancelled_at timestamptz,
  add constraint orders_status_times check (
    (status = 'received'       and preparing_at is null     and served_at is null     and cancelled_at is null) or
    (status = 'in_preparation' and preparing_at is not null and served_at is null     and cancelled_at is null) or
    (status = 'served'         and preparing_at is not null and served_at is not null and cancelled_at is null) or
    (status = 'cancelled'      and preparing_at is null     and served_at is null     and cancelled_at is not null)
  );

create index orders_day_created_idx on public.orders (service_day, created_at);

------------------------------------------------------------------------------
-- D3. Cambios de estado: compare-and-set en un solo update
--   Respuestas: {status: ok, order} | {status: conflict, current_status} | {status: not_found}
------------------------------------------------------------------------------

-- Estado de un pedido tras un intento fallido: conflict (es de hoy) o not_found
create function public.order_change_miss(p_order_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select jsonb_build_object('status', 'conflict', 'current_status', o.status)
       from public.orders o
      where o.id = p_order_id and o.service_day = public.current_service_day()),
    jsonb_build_object('status', 'not_found'));
$$;

-- p_from: el estado que el panel está mostrando
create function public.advance_order(p_order_id uuid, p_from public.order_status) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_order jsonb;
begin
  if not public.can_manage_orders() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_order_id is null or p_from is null or p_from not in ('received', 'in_preparation') then
    raise exception 'no transition from %', p_from using errcode = '22023';
  end if;

  update public.orders o
     set status       = case p_from when 'received' then 'in_preparation'::public.order_status
                                    else 'served'::public.order_status end,
         preparing_at = case when p_from = 'received' then now() else o.preparing_at end,
         served_at    = case when p_from = 'in_preparation' then now() else o.served_at end
   where o.id = p_order_id
     and o.status = p_from
     and o.service_day = public.current_service_day()
  returning jsonb_build_object('id', o.id, 'number', o.number, 'status', o.status,
                               'preparing_at', o.preparing_at, 'served_at', o.served_at,
                               'cancelled_at', o.cancelled_at)
    into v_order;

  if v_order is null then
    return public.order_change_miss(p_order_id);
  end if;
  return jsonb_build_object('status', 'ok', 'order', v_order);
end;
$$;

-- Solo desde «Recibido»; no borra el pedido
create function public.cancel_order(p_order_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_order jsonb;
begin
  if not public.can_manage_orders() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_order_id is null then
    raise exception 'invalid order' using errcode = '22023';
  end if;

  update public.orders o
     set status = 'cancelled', cancelled_at = now()
   where o.id = p_order_id
     and o.status = 'received'
     and o.service_day = public.current_service_day()
  returning jsonb_build_object('id', o.id, 'number', o.number, 'status', o.status,
                               'preparing_at', o.preparing_at, 'served_at', o.served_at,
                               'cancelled_at', o.cancelled_at)
    into v_order;

  if v_order is null then
    return public.order_change_miss(p_order_id);
  end if;
  return jsonb_build_object('status', 'ok', 'order', v_order);
end;
$$;

------------------------------------------------------------------------------
-- D4. Lectura del panel: pedidos del día de servicio con su mesa y sus líneas
--   security invoker: la RLS de abajo es la única garantía (vacío sin rol)
------------------------------------------------------------------------------

create function public.get_kitchen_orders() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'server_now', now(),
    'orders', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', o.id,
               'number', o.number,
               'status', o.status,
               'created_at', o.created_at,
               'preparing_at', o.preparing_at,
               'served_at', o.served_at,
               'cancelled_at', o.cancelled_at,
               'table_name', t.name,
               'items', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'position', i.position,
                          'dish_name', i.dish_name,
                          'size_label', i.size_label,
                          'quantity', i.quantity,
                          'note', i.note) order by i.position)
                   from public.order_items i where i.order_id = o.id), '[]'::jsonb))
             order by o.created_at, o.number)
        from public.orders o join public.tables t on t.id = o.table_id
       where o.service_day = public.current_service_day()), '[]'::jsonb));
$$;

create policy "kitchen read orders" on public.orders
  for select to authenticated using (public.can_manage_orders());
create policy "kitchen read order items" on public.order_items
  for select to authenticated using (public.can_manage_orders());
create policy "kitchen read tables" on public.tables
  for select to authenticated using (public.can_manage_orders());

-- Solo lectura: nadie inserta, actualiza ni borra pedidos por la API (solo las RPC)
grant select on public.orders, public.order_items to authenticated;

------------------------------------------------------------------------------
-- D5. Tiempo real: Realtime aplica la RLS de orders a cada suscriptor
------------------------------------------------------------------------------

alter publication supabase_realtime add table public.orders;

------------------------------------------------------------------------------
-- Permisos de las funciones
------------------------------------------------------------------------------

revoke execute on function public.order_change_miss(uuid) from public, anon, authenticated;
revoke execute on function public.advance_order(uuid, public.order_status),
                           public.cancel_order(uuid),
                           public.get_kitchen_orders() from public, anon;
-- can_manage_orders() queda ejecutable por todos, como is_owner(): sin rol devuelve false
grant execute on function public.advance_order(uuid, public.order_status),
                          public.cancel_order(uuid),
                          public.get_kitchen_orders() to authenticated;
-- get_kitchen_orders es security invoker y calcula el día de servicio
grant execute on function public.current_service_day() to authenticated;
