-- Lecturas públicas de la mesa y de «Mis pedidos» (design D4) y aislamiento de los pedidos (D5).
-- Cubre (capa servidor): [menu] «El comensal abre la carta desde el QR»; [table-ordering] «El comensal
-- consulta sus pedidos», «El comensal no ve los pedidos de otro móvil», «El dueño cambia un plato
-- después de pedirlo».
begin;
select plan(14);

-- Los números dependen del contador del día: se parte de cero aunque la base tenga pedidos
-- de desarrollo o de e2e (se deshace con el rollback final).
delete from public.order_counters;

insert into public.categories (id, name) values ('00000000-0000-0000-0000-0000000000c1', 'Pruebas Raciones');
insert into public.dishes (id, category_id, name, allergens) values
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000c1', 'Croquetas', '{gluten}');
insert into public.dish_sizes (id, dish_id, label, price_cents, position) values
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000d2', 'Ración', 700, 1);
insert into public.tables (id, token, name) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000f001', 'Pruebas Mesa 4'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-00000000f002', 'Pruebas Mesa 5');

create function pg_temp.order_for(p_order text, p_token text) returns jsonb language sql as $$
  select public.place_order(('00000000-0000-0000-0000-000000000' || p_order)::uuid,
    ('00000000-0000-0000-0000-00000000' || p_token)::uuid,
    jsonb_build_array(jsonb_build_object('dish_id', '00000000-0000-0000-0000-0000000000d2',
      'size_id', '00000000-0000-0000-0000-0000000000e2', 'quantity', 1, 'unit_price_cents', 700)));
$$;
-- Pedidos 3 y 8 desde «mi» móvil, 5 desde otro móvil de la misma mesa, 9 desde otra mesa
select pg_temp.order_for('003', 'f001');
select pg_temp.order_for('005', 'f001');
select pg_temp.order_for('008', 'f001');
select pg_temp.order_for('009', 'f002');
-- Un pedido de un día anterior de la misma mesa
insert into public.orders (id, table_id, service_day, number, total_cents)
  values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', public.current_service_day() - 1, 1, 700);

create function pg_temp.mine(p_token text, p_ids text[]) returns jsonb language sql as $$
  select public.get_orders(('00000000-0000-0000-0000-00000000' || p_token)::uuid,
    (select array_agg(('00000000-0000-0000-0000-000000000' || i)::uuid) from unnest(p_ids) i));
$$;
grant execute on all functions in schema pg_temp to anon;

set local role anon;

-- get_table
select is((select row(name, active)::text from public.get_table('00000000-0000-0000-0000-00000000f001')),
  '("Pruebas Mesa 4",t)', 'get_table devuelve el nombre de la mesa y que está activa');
select is((select count(*)::int from public.get_table('00000000-0000-0000-0000-00000000f999')), 0,
  'get_table no devuelve nada para un token desconocido');
reset role;
update public.tables set name = 'Pruebas Ventana', archived_at = now() where id = '00000000-0000-0000-0000-0000000000b2';
set local role anon;
select is((select row(name, active)::text from public.get_table('00000000-0000-0000-0000-00000000f002')),
  '("Pruebas Ventana",f)', 'get_table refleja el nombre nuevo y el archivado con el mismo token');

-- get_orders: solo los id conocidos, de esa mesa y de hoy
select is((select jsonb_agg(o->'number' order by (o->>'number')::int) from jsonb_array_elements(pg_temp.mine('f001', array['003', '008'])) o),
  '[1, 3]'::jsonb, 'el comensal ve los pedidos que hizo desde su móvil');
select is((select jsonb_array_length(pg_temp.mine('f001', array['003', '008']))), 2,
  'no ve el pedido 5, hecho desde otro móvil');
select is((select jsonb_array_length(pg_temp.mine('f001', array['009']))), 0,
  'no ve pedidos de otra mesa aunque conozca su id');
select is((select jsonb_array_length(pg_temp.mine('f001', array['001']))), 0,
  'no ve pedidos de días anteriores');
select is((select jsonb_array_length(public.get_orders('00000000-0000-0000-0000-00000000f001', null))), 0,
  'sin ids no ve nada');

-- El pedido conserva lo que se pidió
reset role;
update public.dishes set name = 'Croquetas caseras' where id = '00000000-0000-0000-0000-0000000000d2';
update public.dish_sizes set price_cents = 800 where id = '00000000-0000-0000-0000-0000000000e2';
set local role anon;
select is((select pg_temp.mine('f001', array['003'])->0->'items'->0),
  '{"dish_name":"Croquetas","size_label":"Ración","unit_price_cents":700,"quantity":1,"note":null}'::jsonb,
  'tras editar el plato, el pedido conserva nombre, tamaño y precio');
select is((select pg_temp.mine('f001', array['003'])->0->>'total_cents'), '700', 'y el total que se confirmó');

-- Nadie lee ni escribe pedidos directamente
select throws_ok($$ select count(*) from public.orders $$, '42501', null, 'anon no lee orders');
select throws_ok($$ select count(*) from public.order_items $$, '42501', null, 'anon no lee order_items');
select throws_ok($$ select count(*) from public.order_counters $$, '42501', null, 'anon no lee order_counters');
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000a001', 'owner1@pruebas.test');
insert into public.backoffice_users (user_id, role) values ('00000000-0000-0000-0000-00000000a001', 'owner');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ update public.orders set total_cents = 1 $$, '42501', null, 'ni siquiera el dueño modifica pedidos por la API');

select * from finish();
rollback;
