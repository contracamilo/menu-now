-- Confirmar pedidos con place_order (design D3), como comensal anónimo.
-- Cubre (capa servidor): [table-ordering] «El comensal confirma su pedido», «El comensal pulsa confirmar
-- dos veces», «El comensal confirma sin conexión», «Un plato se archiva mientras el comensal decide»,
-- «Todos los platos del pedido dejan de estar disponibles», «El dueño cambia un precio mientras el
-- comensal decide», «El dueño archiva la mesa mientras el comensal decide», «El comensal no puede pedir
-- un plato incluido», «El comensal intenta escribir una nota de más de 140 caracteres», «El comensal
-- cambia la cantidad y quita una línea», «El comensal ve la confirmación de su pedido», «La numeración
-- empieza de nuevo cada día», «La mesa pide el postre después», «Dos comensales de la misma mesa piden
-- desde sus móviles», «El dueño cambia un plato después de pedirlo»; [table-management] «El dueño archiva
-- una mesa», «El dueño reactiva una mesa archivada».
begin;
select plan(32);

-- Los números dependen del contador del día: se parte de cero aunque la base tenga pedidos
-- de desarrollo o de e2e (se deshace con el rollback final).
delete from public.order_counters;

-- Datos de prueba (como postgres) ----------------------------------------------------
insert into public.categories (id, name) values
  ('00000000-0000-0000-0000-0000000000c1', 'Pruebas Raciones'),
  ('00000000-0000-0000-0000-0000000000c2', 'Pruebas Postres');
insert into public.dishes (id, category_id, name, allergens) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', 'Caña', '{gluten}'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000c1', 'Croquetas', '{gluten,milk}'),
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000c1', 'Patatas', '{eggs}'),
  ('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000c2', 'Flan', '{eggs,milk}');
insert into public.dish_sizes (id, dish_id, label, price_cents, position) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000d1', null, 250, 1),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000d2', 'Ración', 700, 1),
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000d2', 'Plato', 1200, 2),
  ('00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000d3', null, 400, 1),
  ('00000000-0000-0000-0000-0000000000e5', '00000000-0000-0000-0000-0000000000d5', null, 350, 1);
insert into public.dishes (id, category_id, name, included_with, no_allergens)
  select '00000000-0000-0000-0000-0000000000d4', id, 'Tapa del día', 'Con cada bebida', true
    from public.categories where is_included;

insert into public.tables (id, token, name) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000f001', 'Pruebas Mesa 4'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-00000000f002', 'Pruebas Terraza');

-- Ayer se registraron 57 pedidos: [table-ordering] «La numeración empieza de nuevo cada día»
insert into public.order_counters (service_day, last_number) values (public.current_service_day() - 1, 57);

-- Línea de pedido en JSON
create function pg_temp.line(p_dish text, p_size text, p_qty int, p_price int, p_note text default null)
returns jsonb language sql as $$
  select jsonb_build_object('dish_id', ('00000000-0000-0000-0000-0000000000' || p_dish)::uuid,
                            'size_id', ('00000000-0000-0000-0000-0000000000' || p_size)::uuid,
                            'quantity', p_qty, 'unit_price_cents', p_price, 'note', p_note);
$$;
create function pg_temp.place(p_order text, p_token text, p_items jsonb) returns jsonb language sql as $$
  select public.place_order(('00000000-0000-0000-0000-000000000' || p_order)::uuid,
                            ('00000000-0000-0000-0000-00000000' || p_token)::uuid, p_items);
$$;
grant execute on all functions in schema pg_temp to anon;

-- Comensal anónimo ---------------------------------------------------------------------
set local role anon;

create temporary table r1 as
  select pg_temp.place('001', 'f001', jsonb_build_array(
    pg_temp.line('d1', 'e1', 2, 250),
    pg_temp.line('d2', 'e2', 1, 700, '  Bien calientes  '))) as res;

select is((select res->>'status' from r1), 'placed', 'un pedido válido se registra');
select is((select (res->'order'->>'number')::int from r1), 1, 'el primer pedido del día es el número 1 aunque ayer hubiera 57');
select is((select res->'order'->>'status' from r1), 'received', 'el estado inicial es «Recibido»');
select is((select (res->'order'->>'total_cents')::int from r1), 1200, 'el total es 2 × 2,50 + 7,00');
select is((select res->'order'->>'table_name' from r1), 'Pruebas Mesa 4', 'el pedido pertenece a la mesa del QR');
select is((select res->'order'->'items'->1 from r1),
  '{"dish_name":"Croquetas","size_label":"Ración","unit_price_cents":700,"quantity":1,"note":"Bien calientes"}'::jsonb,
  'la línea copia nombre, tamaño y precio, y recorta la nota');

-- Idempotencia
select is((select pg_temp.place('001', 'f001', jsonb_build_array(pg_temp.line('d1', 'e1', 1, 250)))->'order'->>'number'),
  '1', 'confirmar otra vez el mismo pedido devuelve el ya registrado');
select throws_ok($$ select pg_temp.place('001', 'f002', jsonb_build_array(pg_temp.line('d1', 'e1', 1, 250))) $$,
  '22023', null, 'el id de un pedido no sirve desde otra mesa');

-- Formato inválido (solo posible con un cliente manipulado)
select throws_ok($$ select pg_temp.place('090', 'f001', jsonb_build_array(pg_temp.line('d1', 'e1', 0, 250))) $$,
  '22023', null, 'cantidad 0 rechazada');
select throws_ok($$ select pg_temp.place('090', 'f001', jsonb_build_array(pg_temp.line('d1', 'e1', 21, 250))) $$,
  '22023', null, 'cantidad 21 rechazada');
select throws_ok($$ select pg_temp.place('090', 'f001', jsonb_build_array(pg_temp.line('d1', 'e1', 1, 250, repeat('a', 141)))) $$,
  '22023', null, 'nota de 141 caracteres rechazada');
select lives_ok($$ select pg_temp.place('091', 'f001', jsonb_build_array(pg_temp.line('d1', 'e1', 20, 250, repeat('a', 140)))) $$,
  'cantidad 20 y nota de 140 caracteres admitidas');
select throws_ok($$ select pg_temp.place('090', 'f001', '[]'::jsonb) $$, '22023', null, 'un pedido sin líneas se rechaza');
select throws_ok($$ select pg_temp.place('090', 'f001', (select jsonb_agg(pg_temp.line('d1', 'e1', 1, 250)) from generate_series(1, 51))) $$,
  '22023', null, 'un pedido de 51 líneas se rechaza');

-- Plato incluido y tamaño de otro plato
select is((select pg_temp.place('002', 'f001', jsonb_build_array(pg_temp.line('d4', 'e1', 1, 250)))->'unavailable'->0->>'dish_name'),
  'Tapa del día', 'un plato de «Incluidos» no se puede pedir');
select is((select pg_temp.place('002', 'f001', jsonb_build_array(pg_temp.line('d1', 'e2', 1, 700)))->>'status'),
  'rejected', 'un tamaño de otro plato no se acepta');

-- Plato archivado mientras el comensal decide
reset role;
update public.dishes set archived_at = now() where id = '00000000-0000-0000-0000-0000000000d2';
set local role anon;
create temporary table r2 as
  select pg_temp.place('003', 'f001', jsonb_build_array(
    pg_temp.line('d2', 'e2', 1, 700), pg_temp.line('d1', 'e1', 1, 250))) as res;
select is((select res->>'status' from r2), 'rejected', 'un pedido con un plato archivado no se registra');
select is((select res->'unavailable' from r2),
  '[{"dish_id":"00000000-0000-0000-0000-0000000000d2","size_id":"00000000-0000-0000-0000-0000000000e2","dish_name":"Croquetas"}]'::jsonb,
  'el rechazo indica el plato que ya no está disponible');
select is((select pg_temp.place('003', 'f001', jsonb_build_array(pg_temp.line('d1', 'e1', 1, 250)))->'order'->>'number'),
  '3', 'sin el plato archivado, el mismo pedido se registra con el número siguiente');

-- Categoría archivada: todos los platos del pedido dejan de estar disponibles
reset role;
update public.categories set archived_at = now() where id = '00000000-0000-0000-0000-0000000000c2';
set local role anon;
select is((select pg_temp.place('004', 'f001', jsonb_build_array(pg_temp.line('d5', 'e5', 1, 350)))->'unavailable'->0->>'dish_name'),
  'Flan', 'un plato de una categoría archivada ya no está disponible');

-- Tamaño borrado
reset role;
delete from public.dish_sizes where id = '00000000-0000-0000-0000-0000000000e3';
insert into public.dish_sizes (dish_id, label, price_cents, position) values ('00000000-0000-0000-0000-0000000000d3', 'Grande', 600, 2);
update public.dish_sizes set label = 'Normal' where id = '00000000-0000-0000-0000-0000000000e4';
update public.dishes set archived_at = null where id = '00000000-0000-0000-0000-0000000000d2';
set local role anon;
select is((select pg_temp.place('004', 'f001', jsonb_build_array(pg_temp.line('d2', 'e3', 1, 1200)))->>'status'),
  'rejected', 'un tamaño que ya no existe no se acepta');

-- Precio cambiado mientras el comensal decide
reset role;
update public.dish_sizes set price_cents = 200 where id = '00000000-0000-0000-0000-0000000000e1';
set local role anon;
create temporary table r3 as
  select pg_temp.place('005', 'f001', jsonb_build_array(pg_temp.line('d1', 'e1', 2, 250))) as res;
select is((select res->>'status' from r3), 'rejected', 'un pedido con un precio distinto no se registra');
select is((select res->'price_changes'->0->>'price_cents' from r3), '200', 'el rechazo indica el precio nuevo');
create temporary table r4 as
  select pg_temp.place('005', 'f001', jsonb_build_array(pg_temp.line('d1', 'e1', 2, 200))) as res;
select is((select (res->'order'->>'total_cents')::int from r4), 400, 'con el precio nuevo se registra con el total nuevo');

-- Varios pedidos de la misma mesa: independientes
select is((select (res->'order'->>'number')::int from r4), 4, 'cada pedido de la mesa tiene su propio número');
select is((select pg_temp.place('001', 'f001', jsonb_build_array(pg_temp.line('d1', 'e1', 1, 200)))->'order'->'items'->0->>'unit_price_cents'),
  '250', 'el pedido número 1 conserva sus líneas y precios');

-- Mesa archivada / desconocida / reactivada
reset role;
update public.tables set archived_at = now() where id = '00000000-0000-0000-0000-0000000000b2';
set local role anon;
select is((select pg_temp.place('006', 'f002', jsonb_build_array(pg_temp.line('d1', 'e1', 1, 200)))->>'status'),
  'table_unavailable', 'una mesa archivada no admite pedidos');
select is((select pg_temp.place('006', 'f999', jsonb_build_array(pg_temp.line('d1', 'e1', 1, 200)))->>'status'),
  'table_unavailable', 'un token desconocido no admite pedidos');
reset role;
update public.tables set archived_at = null where id = '00000000-0000-0000-0000-0000000000b2';
set local role anon;
select is((select pg_temp.place('006', 'f002', jsonb_build_array(pg_temp.line('d1', 'e1', 1, 200)))->>'status'),
  'placed', 'una mesa reactivada vuelve a admitir pedidos');

-- Nada se ha insertado en los rechazos ----------------------------------------------------
reset role;
select is((select count(*)::int from public.orders where id in (
  '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000090')), 0,
  'los pedidos rechazados no se registran');
select is((select count(*)::int from public.orders), 5, 'se registran exactamente los pedidos aceptados');
select is((select array_agg(number order by number) from public.orders), array[1, 2, 3, 4, 5],
  'los números son correlativos dentro del día');

select * from finish();
rollback;
