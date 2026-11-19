-- RLS y permisos (design D3): qué ve el público, quién escribe y que nada se borra.
-- Cubre (capa servidor): [backoffice-access] «Intento de modificar el catálogo sin sesión»,
-- «Dos dueños gestionan la misma carta»; [catalog-management] «El dueño archiva un plato y este se conserva»;
-- [menu] «Una categoría archivada oculta sus platos».
begin;
select plan(27);

-- Datos de prueba (como postgres, sin RLS) ----------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000a001', 'owner1@pruebas.test'),
  ('00000000-0000-0000-0000-00000000a002', 'owner2@pruebas.test'),
  ('00000000-0000-0000-0000-00000000a003', 'extrano@pruebas.test');
insert into public.backoffice_users (user_id, role) values
  ('00000000-0000-0000-0000-00000000a001', 'owner'),
  ('00000000-0000-0000-0000-00000000a002', 'owner');

insert into public.categories (id, name) values ('00000000-0000-0000-0000-0000000000c1', 'Pruebas Activa');
insert into public.categories (id, name, archived_at) values ('00000000-0000-0000-0000-0000000000c2', 'Pruebas Archivada', now());

insert into public.dishes (id, category_id, name, description, allergens) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', 'Visible', null, '{gluten}');
insert into public.dishes (id, category_id, name, description, allergens, archived_at) values
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000c1', 'Croquetas', 'De jamón', '{gluten,milk}', now());
insert into public.dishes (id, category_id, name, no_allergens) values
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000c2', 'En categoría archivada', true);
update public.venue_settings set name = 'Local de pruebas';
insert into public.dish_sizes (id, dish_id, price_cents) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000d1', 250),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000d2', 700),
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000d3', 300);

-- Comensal (anon): [menu] «Una categoría archivada oculta sus platos» y
-- [backoffice-access] «Intento de modificar el catálogo sin sesión» ---------------
set local role anon;

select is((select count(*)::int from public.categories where id = '00000000-0000-0000-0000-0000000000c2'), 0,
  'anon no ve categorías archivadas');
select is((select count(*)::int from public.dishes where id = '00000000-0000-0000-0000-0000000000d2'), 0,
  'anon no ve platos archivados');
select is((select count(*)::int from public.dishes where id = '00000000-0000-0000-0000-0000000000d3'), 0,
  'anon no ve platos activos de categorías archivadas');
select is((select count(*)::int from public.dishes where id = '00000000-0000-0000-0000-0000000000d1'), 1,
  'anon ve los platos activos de categorías activas');
select is((select array_agg(id order by id) from public.dish_sizes where dish_id in (
            '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000d3')),
  array['00000000-0000-0000-0000-0000000000e1']::uuid[],
  'anon solo ve los tamaños de los platos visibles');
select throws_ok($$ insert into public.categories (name) values ('Intrusa') $$, '42501', null,
  'anon no puede crear categorías');
select throws_ok($$ update public.dishes set name = 'Hackeado' $$, '42501', null,
  'anon no puede editar platos');
select throws_ok($$ update public.venue_settings set name = 'Hackeado' $$, '42501', null,
  'anon no puede cambiar los datos del local');
select throws_ok($$ insert into public.dish_sizes (dish_id, price_cents) values ('00000000-0000-0000-0000-0000000000d1', 1) $$,
  '42501', null, 'anon no puede añadir tamaños');
select throws_ok($$ select public.move_dish('00000000-0000-0000-0000-0000000000d1', 1) $$, '42501', null,
  'anon no puede reordenar');
select throws_ok($$ select public.save_dish('{}'::jsonb, '[]'::jsonb) $$, '42501', null,
  'anon no puede llamar a save_dish');

-- Autenticado que no es dueño --------------------------------------------------
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a003","role":"authenticated"}', true);
set local role authenticated;

select throws_ok($$ insert into public.categories (name) values ('Intrusa') $$, '42501', null,
  'un autenticado no dueño no puede crear categorías');
select throws_ok($$ insert into public.dish_sizes (dish_id, price_cents) values ('00000000-0000-0000-0000-0000000000d1', 1) $$,
  '42501', null, 'un autenticado no dueño no puede añadir tamaños');
update public.dishes set name = 'Hackeado' where id = '00000000-0000-0000-0000-0000000000d1';
update public.venue_settings set name = 'Hackeado';
update public.dish_sizes set price_cents = 1;
select is((select count(*)::int from public.dishes where id = '00000000-0000-0000-0000-0000000000d2'), 0,
  'un autenticado no dueño no ve lo archivado');

reset role;
select is((select name from public.dishes where id = '00000000-0000-0000-0000-0000000000d1'), 'Visible',
  'el plato no cambia tras un intento de un no dueño');
select is((select name from public.venue_settings), 'Local de pruebas',
  'los datos del local no cambian tras un intento de un no dueño');
select is((select price_cents from public.dish_sizes where id = '00000000-0000-0000-0000-0000000000e1'), 250,
  'los precios no cambian tras un intento de un no dueño');

-- Dueño 1 --------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated"}', true);
set local role authenticated;

select throws_ok($$ delete from public.dishes where id = '00000000-0000-0000-0000-0000000000d2' $$, '42501', null,
  'ni siquiera el dueño puede borrar platos');
select throws_ok($$ delete from public.categories where id = '00000000-0000-0000-0000-0000000000c2' $$, '42501', null,
  'ni siquiera el dueño puede borrar categorías');
select results_eq(
  $$ select name, description, allergens::text[], archived_at is not null
       from public.dishes where id = '00000000-0000-0000-0000-0000000000d2' $$,
  $$ values ('Croquetas'::text, 'De jamón'::text, array['gluten','milk']::text[], true) $$,
  'un plato archivado sigue existiendo para el dueño con todos sus datos');
select is((select price_cents from public.dish_sizes where id = '00000000-0000-0000-0000-0000000000e2'), 700,
  'el dueño ve los tamaños del plato archivado');
select is((select count(*)::int from public.categories where id = '00000000-0000-0000-0000-0000000000c2'), 1,
  'el dueño ve las categorías archivadas');

update public.dish_sizes set price_cents = 200 where id = '00000000-0000-0000-0000-0000000000e1';
update public.venue_settings set name = 'Bar Manolo';

-- Dueño 2 ve y edita lo mismo: [backoffice-access] «Dos dueños gestionan la misma carta» ---
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a002","role":"authenticated"}', true);
set local role authenticated;

select is((select price_cents from public.dish_sizes where id = '00000000-0000-0000-0000-0000000000e1'), 200,
  'el segundo dueño ve el precio cambiado por el primero');
select is((select name from public.venue_settings), 'Bar Manolo',
  'el segundo dueño ve los datos del local cambiados por el primero');
select lives_ok($$ update public.dishes set name = 'Visible 2' where id = '00000000-0000-0000-0000-0000000000d1' $$,
  'el segundo dueño puede editar el mismo catálogo');
select is((select name from public.dishes where id = '00000000-0000-0000-0000-0000000000d1'), 'Visible 2',
  'la edición del segundo dueño se guarda');
select lives_ok($$ insert into public.categories (name) values ('Pruebas Nueva') $$,
  'el segundo dueño puede crear categorías');

reset role;
select * from finish();
rollback;
