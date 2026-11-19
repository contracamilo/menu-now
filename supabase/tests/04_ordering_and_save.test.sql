-- save_dish, move_dish, move_category y posiciones (design D2 y D4).
begin;
select plan(20);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000a001', 'owner1@pruebas.test'),
  ('00000000-0000-0000-0000-00000000a003', 'extrano@pruebas.test');
insert into public.backoffice_users (user_id, role) values ('00000000-0000-0000-0000-00000000a001', 'owner');

-- Órdenes relativos de los elementos de prueba
create function pg_temp.dish_order(p_category uuid) returns text[] language sql as $$
  select array_agg(name order by position, created_at, id) from public.dishes
   where category_id = p_category and archived_at is null $$;
create function pg_temp.category_order(p_ids uuid[]) returns text[] language sql as $$
  select array_agg(name order by position, created_at, id) from public.categories
   where id = any(p_ids) and archived_at is null $$;

-- Como dueño ------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated"}', true);
set local role authenticated;

insert into public.categories (id, name) values
  ('00000000-0000-0000-0000-0000000000c1', 'Pruebas Desayunos'),
  ('00000000-0000-0000-0000-0000000000c2', 'Pruebas Bocadillos'),
  ('00000000-0000-0000-0000-0000000000c3', 'Pruebas Bebidas');

select is((select position from public.categories where id = '00000000-0000-0000-0000-0000000000c3'),
          (select max(position) from public.categories),
  'una categoría nueva queda al final');

-- save_dish: crear con tres tamaños -----------------------------------------
select lives_ok($$
  do $do$ begin
    set constraints all deferred;
    perform public.save_dish(
      '{"id":"00000000-0000-0000-0000-0000000000d1","category_id":"00000000-0000-0000-0000-0000000000c2","name":" Croquetas ","description":"","allergens":["gluten","milk"],"no_allergens":false}'::jsonb,
      '[{"label":"Una","price_cents":150},{"label":"Ración","price_cents":700},{"label":"Plato","price_cents":1200}]'::jsonb);
    set constraints all immediate;
  end $do$ $$,
  'save_dish acepta un plato nuevo con id indicado por el cliente');

select results_eq(
  $$ select label, price_cents, position from public.dish_sizes
      where dish_id = '00000000-0000-0000-0000-0000000000d1' order by position $$,
  $$ values ('Una'::text, 150, 1), ('Ración', 700, 2), ('Plato', 1200, 3) $$,
  'save_dish guarda los tres tamaños en orden');
select results_eq(
  $$ select name, description from public.dishes where id = '00000000-0000-0000-0000-0000000000d1' $$,
  $$ values ('Croquetas'::text, null::text) $$,
  'save_dish recorta el nombre y guarda la descripción vacía como nula');

-- save_dish: editar sustituye los tamaños --------------------------------------
select lives_ok($$
  do $do$
  declare v_racion uuid := (select id from public.dish_sizes
                             where dish_id = '00000000-0000-0000-0000-0000000000d1' and label = 'Ración');
  begin
    set constraints all deferred;
    perform public.save_dish(
      '{"id":"00000000-0000-0000-0000-0000000000d1","category_id":"00000000-0000-0000-0000-0000000000c2","name":"Croquetas","allergens":["gluten","milk"]}'::jsonb,
      jsonb_build_array(
        jsonb_build_object('id', v_racion, 'label', 'Media', 'price_cents', 400),
        jsonb_build_object('label', 'Ración', 'price_cents', 750)));
    set constraints all immediate;
  end $do$ $$,
  'save_dish edita un plato existente');
select results_eq(
  $$ select label, price_cents, position from public.dish_sizes
      where dish_id = '00000000-0000-0000-0000-0000000000d1' order by position $$,
  $$ values ('Media'::text, 400, 1), ('Ración', 750, 2) $$,
  'al editar, los tamaños se sustituyen por los enviados, en su orden');

-- save_dish: atómica ---------------------------------------------------------------
select throws_ok($$
  do $do$ begin
    set constraints all deferred;
    perform public.save_dish(
      '{"category_id":"00000000-0000-0000-0000-0000000000c2","name":"Plato a medias","no_allergens":true}'::jsonb,
      '[{"label":"Una","price_cents":150},{"price_cents":700}]'::jsonb);
    set constraints all immediate;
  end $do$ $$,
  '23514', null, 'save_dish rechaza varios tamaños con alguno sin nombre');
select is((select count(*)::int from public.dishes where name = 'Plato a medias'), 0,
  'si la regla de precios falla, no queda nada escrito');

-- Reordenación de platos -----------------------------------------------------------
-- (fixtures sin tamaños: la regla de precios se comprobaría al confirmar, y aquí se hace rollback)
set constraints all deferred;
insert into public.dishes (id, category_id, name, no_allergens) values
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000c1', 'Calamares', true),
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000c1', 'Archivado', true),
  ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000c1', 'Lomo', true),
  ('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000c1', 'Tortilla', true);
update public.dishes set archived_at = now() where id = '00000000-0000-0000-0000-0000000000d3';

select is(pg_temp.dish_order('00000000-0000-0000-0000-0000000000c1'), array['Calamares', 'Lomo', 'Tortilla'],
  'los platos nuevos quedan al final de su categoría, en orden de creación');

select public.move_dish('00000000-0000-0000-0000-0000000000d5', -1);
select is(pg_temp.dish_order('00000000-0000-0000-0000-0000000000c1'), array['Calamares', 'Tortilla', 'Lomo'],
  'subir intercambia con el vecino activo más cercano');

select public.move_dish('00000000-0000-0000-0000-0000000000d4', -1);
select is(pg_temp.dish_order('00000000-0000-0000-0000-0000000000c1'), array['Calamares', 'Lomo', 'Tortilla'],
  'subir ignora los platos archivados intermedios');

select public.move_dish('00000000-0000-0000-0000-0000000000d2', -1);
select public.move_dish('00000000-0000-0000-0000-0000000000d5', 1);
select is(pg_temp.dish_order('00000000-0000-0000-0000-0000000000c1'), array['Calamares', 'Lomo', 'Tortilla'],
  'en los extremos, subir o bajar no hace nada');

-- Reactivar conserva la posición
update public.dishes set archived_at = null where id = '00000000-0000-0000-0000-0000000000d3';
select is(pg_temp.dish_order('00000000-0000-0000-0000-0000000000c1'), array['Calamares', 'Archivado', 'Lomo', 'Tortilla'],
  'un plato archivado y reactivado vuelve a su posición');

-- Cambio de categoría: al final de la nueva
update public.dishes set category_id = '00000000-0000-0000-0000-0000000000c1'
 where id = '00000000-0000-0000-0000-0000000000d1';
select is(pg_temp.dish_order('00000000-0000-0000-0000-0000000000c1'),
  array['Calamares', 'Archivado', 'Lomo', 'Tortilla', 'Croquetas'],
  'un plato movido de categoría queda al final de la nueva');

-- Reordenación de categorías ----------------------------------------------------------
select public.move_category('00000000-0000-0000-0000-0000000000c1', 1);
select is(pg_temp.category_order(array['00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c2',
                                       '00000000-0000-0000-0000-0000000000c3']::uuid[]),
  array['Pruebas Bocadillos', 'Pruebas Desayunos', 'Pruebas Bebidas'],
  'bajar una categoría la intercambia con la siguiente');

select lives_ok($$ select public.move_category((select id from public.categories where is_included), 1) $$,
  '«Incluidos» se puede reordenar');

-- Sin sesión de dueño, mover no hace nada --------------------------------------------
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a003","role":"authenticated"}', true);
set local role authenticated;

select lives_ok($$ select public.move_dish('00000000-0000-0000-0000-0000000000d4', -1) $$,
  'un autenticado no dueño puede llamar a move_dish…');
select lives_ok($$ select public.move_category('00000000-0000-0000-0000-0000000000c3', -1) $$,
  '…y a move_category');

reset role;
select is(pg_temp.dish_order('00000000-0000-0000-0000-0000000000c1'),
  array['Calamares', 'Archivado', 'Lomo', 'Tortilla', 'Croquetas'],
  '…pero el orden de los platos no cambia');
select is(pg_temp.category_order(array['00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c2',
                                       '00000000-0000-0000-0000-0000000000c3']::uuid[]),
  array['Pruebas Bocadillos', 'Pruebas Desayunos', 'Pruebas Bebidas'],
  '…ni el de las categorías');

select * from finish();
rollback;
