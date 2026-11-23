-- Panel de cocina (design add-panel-cocina D2–D5): rol de personal, lectura del panel, ciclo de
-- estados, cancelación y permisos del personal.
-- Cubre (capa servidor): [kitchen-panel] «Intento de cambiar un pedido sin sesión de personal ni de
-- dueño», «Un pedido de ayer quedó sin servir», «El personal ve los pedidos pendientes», «La cocina
-- empieza a preparar un pedido», «El pedido sale a la mesa», «Intento de saltar o retroceder un
-- estado fuera de la interfaz», «El personal cancela un pedido recibido», «Un pedido en preparación
-- no se puede cancelar», «Cancelar un pedido que otra tablet acaba de empezar»;
-- [backoffice-access] «El personal intenta modificar la carta fuera de la interfaz», «El personal lee las mesas
-- fuera de la interfaz».
begin;
select plan(62);

-- Los números y la lista del día dependen de lo que ya haya en la base: se parte de cero
-- (pedidos de desarrollo o de pruebas a mano; se deshace con el rollback final).
delete from public.orders;
delete from public.order_counters;

-- Datos de prueba (como postgres, sin RLS) ----------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000a001', 'owner@pruebas.test'),
  ('00000000-0000-0000-0000-00000000a003', 'extrano@pruebas.test'),
  ('00000000-0000-0000-0000-00000000a004', 'personal@pruebas.test'),
  ('00000000-0000-0000-0000-00000000a005', 'cocinero@pruebas.test');
insert into public.backoffice_users (user_id, role) values
  ('00000000-0000-0000-0000-00000000a001', 'owner');

insert into public.categories (id, name) values
  ('00000000-0000-0000-0000-0000000000c1', 'Pruebas Raciones'),
  ('00000000-0000-0000-0000-0000000000c2', 'Pruebas Bebidas');
insert into public.dishes (id, category_id, name, allergens, no_allergens) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', 'Croquetas', '{gluten}', false),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000c1', 'Bravas', '{}', true);
insert into public.dish_sizes (id, dish_id, label, price_cents, position) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000d1', 'Ración', 700, 1),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000d2', null, 500, 1);
insert into public.tables (id, token, name) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000f001', 'Pruebas Mesa 2'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-00000000f002', 'Pruebas Terraza 1');

-- Pedidos 1 (Mesa 2, con nota), 2 y 3 (Terraza 1) de hoy, y uno de ayer en «Recibido»
select public.place_order('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000f001',
  '[{"dish_id":"00000000-0000-0000-0000-0000000000d1","size_id":"00000000-0000-0000-0000-0000000000e1","quantity":2,"note":"Bien calientes","unit_price_cents":700},
    {"dish_id":"00000000-0000-0000-0000-0000000000d2","size_id":"00000000-0000-0000-0000-0000000000e2","quantity":1,"unit_price_cents":500}]');
select public.place_order('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000f002',
  '[{"dish_id":"00000000-0000-0000-0000-0000000000d2","size_id":"00000000-0000-0000-0000-0000000000e2","quantity":1,"unit_price_cents":500}]');
select public.place_order('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000f002',
  '[{"dish_id":"00000000-0000-0000-0000-0000000000d2","size_id":"00000000-0000-0000-0000-0000000000e2","quantity":3,"unit_price_cents":500}]');
-- En la misma transacción todos tienen el mismo created_at: se separan en el tiempo
update public.orders set created_at = now() - interval '10 minutes' where id = '00000000-0000-0000-0000-000000000001';
update public.orders set created_at = now() - interval '5 minutes'  where id = '00000000-0000-0000-0000-000000000002';
update public.orders set created_at = now() - interval '1 minute'   where id = '00000000-0000-0000-0000-000000000003';
insert into public.orders (id, table_id, service_day, number, total_cents, created_at)
  values ('00000000-0000-0000-0000-000000000057', '00000000-0000-0000-0000-0000000000b1',
          public.current_service_day() - 1, 57, 700, now() - interval '1 day');

create function pg_temp.as_user(p_sub text) returns void language sql as $$
  select set_config('request.jwt.claims',
    jsonb_build_object('sub', '00000000-0000-0000-0000-00000000' || p_sub, 'role', 'authenticated')::text, true);
$$;
-- Ejecuta una sentencia e ignora el error: sirve para comprobar después que no tuvo efecto
create function pg_temp.try(p_sql text) returns void language plpgsql as $$
begin
  execute p_sql;
exception when others then
  null;
end;
$$;
grant execute on all functions in schema pg_temp to anon, authenticated;

------------------------------------------------------------------------------
-- 1.6 Roles y lectura
------------------------------------------------------------------------------

select lives_ok($$ insert into public.backoffice_users (user_id, role) values ('00000000-0000-0000-0000-00000000a004', 'staff') $$,
  'backoffice_users admite el rol staff');
select throws_ok($$ insert into public.backoffice_users (user_id, role) values ('00000000-0000-0000-0000-00000000a005', 'cook') $$,
  '23514', null, 'backoffice_users rechaza cualquier otro rol');

select ok(exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'),
  'orders está publicada en supabase_realtime');
select ok(not exists (
    select 1 from unnest(array['anon', 'authenticated']) r, unnest(array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p
     where has_table_privilege(r, 'public.orders', p) or has_table_privilege(r, 'public.order_items', p)),
  'nadie inserta, actualiza ni borra pedidos o líneas por la API');

-- Sin sesión (anon)
set local role anon;
select is(public.can_manage_orders(), false, 'can_manage_orders() es falso para anon');
select throws_ok($$ select public.get_kitchen_orders() $$, '42501', null, 'anon no puede leer el panel');
select throws_ok($$ select count(*) from public.orders $$, '42501', null, 'anon no lee orders');
select throws_ok($$ select count(*) from public.order_items $$, '42501', null, 'anon no lee order_items');

-- Cuenta sin rol
reset role;
select pg_temp.as_user('a003');
set local role authenticated;
select is(public.can_manage_orders(), false, 'can_manage_orders() es falso para una cuenta sin rol');
select is(public.get_kitchen_orders()->'orders', '[]'::jsonb, 'una cuenta sin rol ve el panel vacío');
select is((select count(*)::int from public.orders), 0, 'una cuenta sin rol no lee orders');
select is((select count(*)::int from public.order_items), 0, 'una cuenta sin rol no lee order_items');

-- Dueño
reset role;
select pg_temp.as_user('a001');
set local role authenticated;
select is(public.can_manage_orders(), true, 'can_manage_orders() es verdadero para el dueño');
select is((select jsonb_agg(o->'number') from jsonb_array_elements(public.get_kitchen_orders()->'orders') o),
  '[1, 2, 3]'::jsonb, 'el dueño ve los pedidos de hoy');

-- Personal: «El personal ve los pedidos pendientes» y «Un pedido de ayer quedó sin servir»
reset role;
select pg_temp.as_user('a004');
set local role authenticated;
select is(public.can_manage_orders(), true, 'can_manage_orders() es verdadero para el personal');
select is((select jsonb_agg(o->'number') from jsonb_array_elements(public.get_kitchen_orders()->'orders') o),
  '[1, 2, 3]'::jsonb, 'el personal ve los pedidos de hoy del más antiguo al más reciente, sin el de ayer');
select is(public.get_kitchen_orders()->'orders'->0->>'table_name', 'Pruebas Mesa 2', 'cada pedido trae su mesa');
select is(public.get_kitchen_orders()->'orders'->0->'items',
  '[{"position":1,"dish_name":"Croquetas","size_label":"Ración","quantity":2,"note":"Bien calientes"},
    {"position":2,"dish_name":"Bravas","size_label":null,"quantity":1,"note":null}]'::jsonb,
  'y sus líneas en orden, con tamaño, cantidad y nota');
select is(public.get_kitchen_orders()->'orders'->0->>'status', 'received', 'y su estado');
select ok((public.get_kitchen_orders()->>'server_now')::timestamptz is not null, 'el panel recibe la hora del servidor');
select is((select count(*)::int from public.orders where id = '00000000-0000-0000-0000-000000000057'), 1,
  'el pedido de ayer sigue existiendo aunque el panel no lo muestre');

------------------------------------------------------------------------------
-- 1.7 Transiciones (como personal)
------------------------------------------------------------------------------

-- «La cocina empieza a preparar un pedido»
select is(public.advance_order('00000000-0000-0000-0000-000000000001', 'received')->'order'->>'status', 'in_preparation',
  'advance_order pasa received → in_preparation');
select ok((select preparing_at is not null and served_at is null from public.orders where id = '00000000-0000-0000-0000-000000000001'),
  'y registra preparing_at');
-- «El pedido sale a la mesa»
select is(public.advance_order('00000000-0000-0000-0000-000000000001', 'in_preparation')->'order'->>'status', 'served',
  'advance_order pasa in_preparation → served');
select ok((select served_at is not null from public.orders where id = '00000000-0000-0000-0000-000000000001'),
  'y registra served_at');

-- «Intento de saltar o retroceder un estado fuera de la interfaz»
select throws_ok($$ select public.advance_order('00000000-0000-0000-0000-000000000001', 'served') $$, '22023', null,
  'no hay transición desde served');
select throws_ok($$ select public.advance_order('00000000-0000-0000-0000-000000000002', 'cancelled') $$, '22023', null,
  'no hay transición desde cancelled');
select is(public.advance_order('00000000-0000-0000-0000-000000000002', 'in_preparation'),
  '{"status":"conflict","current_status":"received"}'::jsonb,
  'no se puede saltar de received a served: p_from desfasado devuelve conflict con el estado actual');
select is((select status::text from public.orders where id = '00000000-0000-0000-0000-000000000002'), 'received',
  'y el pedido no cambia');
select is(public.advance_order('00000000-0000-0000-0000-000000000001', 'received'),
  '{"status":"conflict","current_status":"served"}'::jsonb, 'no se puede retroceder un pedido servido');
select is((select status::text from public.orders where id = '00000000-0000-0000-0000-000000000001'), 'served',
  'y sigue servido');

-- «El personal cancela un pedido recibido»
select is(public.cancel_order('00000000-0000-0000-0000-000000000002')->'order'->>'status', 'cancelled',
  'cancel_order cancela un pedido recibido');
select ok((select cancelled_at is not null from public.orders where id = '00000000-0000-0000-0000-000000000002'),
  'registra cancelled_at y la fila sigue existiendo');
select is(public.cancel_order('00000000-0000-0000-0000-000000000002'),
  '{"status":"conflict","current_status":"cancelled"}'::jsonb, 'cancelado es un estado final');

-- «Un pedido en preparación no se puede cancelar» / «Cancelar un pedido que otra tablet acaba de empezar»
select is(public.advance_order('00000000-0000-0000-0000-000000000003', 'received')->>'status', 'ok',
  'otra tablet empieza el pedido 3');
select is(public.cancel_order('00000000-0000-0000-0000-000000000003'),
  '{"status":"conflict","current_status":"in_preparation"}'::jsonb,
  'cancelar un pedido en preparación devuelve conflict con el estado actual');
select is((select status::text from public.orders where id = '00000000-0000-0000-0000-000000000003'), 'in_preparation',
  'y el pedido sigue en preparación');

-- Pedidos de otro día o inexistentes
select is(public.advance_order('00000000-0000-0000-0000-000000000057', 'received'), '{"status":"not_found"}'::jsonb,
  'un pedido de ayer no se puede empezar');
select is(public.cancel_order('00000000-0000-0000-0000-000000000057'), '{"status":"not_found"}'::jsonb,
  'ni cancelar');
select is(public.advance_order('00000000-0000-0000-0000-000000000999', 'received'), '{"status":"not_found"}'::jsonb,
  'un pedido inexistente devuelve not_found');

-- Sin sesión de personal ni de dueño: «Intento de cambiar un pedido sin sesión…»
reset role;
set local role anon;
select throws_ok($$ select public.advance_order('00000000-0000-0000-0000-000000000057', 'received') $$, '42501', null,
  'anon no puede cambiar el estado de un pedido');
select throws_ok($$ select public.cancel_order('00000000-0000-0000-0000-000000000057') $$, '42501', null,
  'anon no puede cancelar un pedido');
reset role;
select pg_temp.as_user('a003');
set local role authenticated;
select throws_ok($$ select public.advance_order('00000000-0000-0000-0000-000000000003', 'in_preparation') $$, '42501', null,
  'una cuenta sin rol no puede cambiar el estado de un pedido');
select throws_ok($$ select public.cancel_order('00000000-0000-0000-0000-000000000003') $$, '42501', null,
  'una cuenta sin rol no puede cancelar un pedido');
reset role;
select is((select status::text from public.orders where id = '00000000-0000-0000-0000-000000000003'), 'in_preparation',
  'el pedido no cambia tras esos intentos');

-- El check orders_status_times rechaza estados incoherentes, aun con privilegios
select throws_ok($$ update public.orders set status = 'in_preparation' where id = '00000000-0000-0000-0000-000000000057' $$,
  '23514', null, 'en preparación exige preparing_at');
select throws_ok($$ update public.orders set served_at = now() where id = '00000000-0000-0000-0000-000000000003' $$,
  '23514', null, 'un pedido en preparación no puede tener served_at');
select throws_ok($$ update public.orders set status = 'cancelled', cancelled_at = now() where id = '00000000-0000-0000-0000-000000000003' $$,
  '23514', null, 'un pedido cancelado no puede tener preparing_at');

------------------------------------------------------------------------------
-- 1.8 El personal no modifica la carta, el local ni las mesas
------------------------------------------------------------------------------

select pg_temp.as_user('a004');
set local role authenticated;
select throws_ok($$ insert into public.categories (name) values ('Intrusa') $$, '42501', null,
  'el personal no puede crear categorías');
select throws_ok($$ insert into public.dishes (category_id, name, no_allergens) values ('00000000-0000-0000-0000-0000000000c1', 'Intruso', true) $$,
  '42501', null, 'el personal no puede crear platos');
select throws_ok($$ insert into public.dish_sizes (dish_id, price_cents) values ('00000000-0000-0000-0000-0000000000d1', 1) $$,
  '42501', null, 'el personal no puede añadir tamaños');
select throws_ok($$ insert into public.tables (name) values ('Intrusa') $$, '42501', null,
  'el personal no puede crear mesas');
select throws_ok($$ select public.save_dish(
    '{"category_id":"00000000-0000-0000-0000-0000000000c1","name":"Intruso","allergens":[],"no_allergens":true}'::jsonb,
    '[{"price_cents":100}]'::jsonb) $$, '42501', null, 'el personal no puede guardar platos con save_dish');
update public.categories set name = 'Hackeada';
update public.dishes set name = 'Hackeado', archived_at = now();
update public.dish_sizes set price_cents = 1;
update public.venue_settings set name = 'Hackeado';
update public.tables set name = 'Hackeada', archived_at = now();
select pg_temp.try($$ select public.move_dish('00000000-0000-0000-0000-0000000000d1', 1) $$);
select pg_temp.try($$ select public.move_category('00000000-0000-0000-0000-0000000000c1', 1) $$);

reset role;
select is((select name from public.categories where id = '00000000-0000-0000-0000-0000000000c1'), 'Pruebas Raciones',
  'las categorías no cambian tras un intento del personal');
select is((select row(name, archived_at is null)::text from public.dishes where id = '00000000-0000-0000-0000-0000000000d1'),
  '(Croquetas,t)', 'los platos no cambian ni se archivan');
select is((select price_cents from public.dish_sizes where id = '00000000-0000-0000-0000-0000000000e1'), 700,
  'los precios no cambian');
select isnt((select name from public.venue_settings), 'Hackeado', 'los datos del local no cambian');
select is((select row(name, archived_at is null)::text from public.tables where id = '00000000-0000-0000-0000-0000000000b1'),
  '("Pruebas Mesa 2",t)', 'las mesas no cambian ni se archivan');
select ok((select d1.position < d2.position from public.dishes d1, public.dishes d2
            where d1.id = '00000000-0000-0000-0000-0000000000d1' and d2.id = '00000000-0000-0000-0000-0000000000d2'),
  'move_dish no tiene efecto para el personal');
select ok((select c1.position < c2.position from public.categories c1, public.categories c2
            where c1.id = '00000000-0000-0000-0000-0000000000c1' and c2.id = '00000000-0000-0000-0000-0000000000c2'),
  'move_category no tiene efecto para el personal');

------------------------------------------------------------------------------
-- [backoffice-access] «El personal lee las mesas fuera de la interfaz» (regularize-spec-drift D-05)
------------------------------------------------------------------------------

update public.tables set archived_at = now() where id = '00000000-0000-0000-0000-0000000000b2';
select pg_temp.as_user('a004');
set local role authenticated;
select results_eq(
  $$ select name, archived_at is null, token from public.tables where name like 'Pruebas %' order by name $$,
  $$ values ('Pruebas Mesa 2'::text, true, '00000000-0000-0000-0000-00000000f001'::uuid),
            ('Pruebas Terraza 1'::text, false, '00000000-0000-0000-0000-00000000f002'::uuid) $$,
  '[backoffice-access] «El personal lee las mesas fuera de la interfaz»: nombre, estado y QR de activas y archivadas');
update public.tables set name = 'Hackeada', archived_at = null
  where id in ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2');
reset role;
select results_eq(
  $$ select name, archived_at is null from public.tables
     where id in ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2') order by name $$,
  $$ values ('Pruebas Mesa 2'::text, true), ('Pruebas Terraza 1'::text, false) $$,
  'el personal no puede cambiar ni reactivar las mesas que lee');

select * from finish();
rollback;
