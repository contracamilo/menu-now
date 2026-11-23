-- Día de servicio: la fecha local del local, que cambia a las 05:00 (regularize-spec-drift, design D3).
-- Cubre (capa servidor): [table-ordering] «Un pedido de madrugada sigue la numeración de la noche»,
-- «El día de servicio empieza a las 05:00»; [kitchen-panel] «Los pedidos de madrugada siguen en el panel».
--
-- now() es fijo dentro de la transacción: para situar la hora local a las 02:xx o a las 05:xx se
-- cambia la zona horaria del local a una `Etc/GMT±N` (sin horario de verano) calculada a partir de
-- la hora UTC actual. Todo se deshace con el rollback final.
begin;
select plan(6);

delete from public.orders;
delete from public.order_counters;

-- Pone la zona del local de modo que la hora local sea `p_hour`:xx
create function pg_temp.local_hour(p_hour int) returns void language plpgsql as $$
declare
  v_offset int := p_hour - extract(hour from now() at time zone 'UTC')::int;
begin
  if v_offset < -12 then v_offset := v_offset + 24; end if;
  if v_offset > 14 then v_offset := v_offset - 24; end if;
  -- En las zonas Etc/GMT el signo va al revés: UTC+2 es «Etc/GMT-2»
  update public.venue_settings
     set timezone = case when v_offset = 0 then 'Etc/GMT'
                         when v_offset > 0 then 'Etc/GMT-' || v_offset
                         else 'Etc/GMT+' || -v_offset end;
end;
$$;
create function pg_temp.local_date() returns date language sql as $$
  select (now() at time zone v.timezone)::date from public.venue_settings v;
$$;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000a004', 'personal@pruebas.test');
insert into public.backoffice_users (user_id, role) values ('00000000-0000-0000-0000-00000000a004', 'staff');
insert into public.categories (id, name) values ('00000000-0000-0000-0000-0000000000c1', 'Pruebas Bebidas');
insert into public.dishes (id, category_id, name, allergens) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', 'Caña', '{gluten}');
insert into public.dish_sizes (id, dish_id, label, price_cents, position) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000d1', null, 250, 1);
insert into public.tables (id, token, name) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000f001', 'Pruebas Mesa 4');

------------------------------------------------------------------------------
-- 02:xx hora local: el día de servicio es el de la noche anterior
------------------------------------------------------------------------------
select pg_temp.local_hour(2);

select is(public.current_service_day(), pg_temp.local_date() - 1,
  'a las 02:xx el día de servicio es la fecha local de ayer');

-- El día de servicio que empezó ayer a las 05:00 lleva 40 pedidos; el 40 sigue en «Recibido»
insert into public.order_counters (service_day, last_number) values (public.current_service_day(), 40);
insert into public.orders (id, table_id, service_day, number, total_cents, created_at)
  values ('00000000-0000-0000-0000-000000000040', '00000000-0000-0000-0000-0000000000b1',
          public.current_service_day(), 40, 250, now() - interval '3 hours');

select is(
  (public.place_order('00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-00000000f001',
     '[{"dish_id":"00000000-0000-0000-0000-0000000000d1","size_id":"00000000-0000-0000-0000-0000000000e1","quantity":1,"unit_price_cents":250}]')
   -> 'order' ->> 'number')::int,
  41,
  '[table-ordering] «Un pedido de madrugada sigue la numeración de la noche»: el pedido de las 02:xx es el 41');

-- [kitchen-panel] «Los pedidos de madrugada siguen en el panel»
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000a004","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select array_agg((o ->> 'number')::int order by (o ->> 'number')::int)
     from jsonb_array_elements(public.get_kitchen_orders() -> 'orders') o),
  array[40, 41],
  '[kitchen-panel] «Los pedidos de madrugada siguen en el panel»: el 41 de las 02:xx sale junto al 40 de la noche');
reset role;

------------------------------------------------------------------------------
-- 05:xx hora local: empieza un día de servicio nuevo
------------------------------------------------------------------------------
select pg_temp.local_hour(5);

select is(public.current_service_day(), pg_temp.local_date(),
  'a las 05:xx el día de servicio es la fecha local de hoy');

-- Con la nueva zona, la fecha local puede no ser la del bloque anterior: se recolocan los pedidos
-- de la noche (el último, el 41 de las 02:xx) en el día de servicio anterior al actual
update public.orders set service_day = public.current_service_day() - 1;
delete from public.order_counters;
insert into public.order_counters (service_day, last_number) values (public.current_service_day() - 1, 41);

select is(
  (public.place_order('00000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-00000000f001',
     '[{"dish_id":"00000000-0000-0000-0000-0000000000d1","size_id":"00000000-0000-0000-0000-0000000000e1","quantity":1,"unit_price_cents":250}]')
   -> 'order' ->> 'number')::int,
  1,
  '[table-ordering] «El día de servicio empieza a las 05:00»: el primer pedido de las 05:xx es el 1');

set local role authenticated;
select is(
  (select array_agg((o ->> 'number')::int)
     from jsonb_array_elements(public.get_kitchen_orders() -> 'orders') o),
  array[1],
  'a las 05:xx el panel ya no muestra los pedidos de la noche anterior');
reset role;

select * from finish();
rollback;
