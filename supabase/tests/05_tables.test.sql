-- Mesas: reglas y RLS (design D2 y D5).
-- Cubre (capa servidor): [table-management] «El dueño crea una mesa», «El dueño intenta guardar una
-- mesa sin nombre», «El dueño intenta repetir el nombre de una mesa activa», «Dos mesas tienen QR
-- distintos», «Renombrar una mesa no invalida su QR impreso», «El dueño no puede reactivar una mesa
-- con el nombre de otra activa», «Intento de crear una mesa sin sesión».
begin;
select plan(20);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000a001', 'owner1@pruebas.test'),
  ('00000000-0000-0000-0000-00000000a003', 'extrano@pruebas.test');
insert into public.backoffice_users (user_id, role) values ('00000000-0000-0000-0000-00000000a001', 'owner');

-- Dueño --------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated"}', true);
set local role authenticated;

select lives_ok($$ insert into public.tables (name) values ('Pruebas Mesa 1'), ('Pruebas Mesa 2') $$,
  'el dueño crea mesas');
select is((select count(*)::int from public.tables where name in ('Pruebas Mesa 1', 'Pruebas Mesa 2') and archived_at is null), 2,
  'las mesas nuevas quedan activas');
select is((select count(distinct token)::int from public.tables where name in ('Pruebas Mesa 1', 'Pruebas Mesa 2')), 2,
  'cada mesa tiene un token distinto');
select throws_ok($$ insert into public.tables (name) values ('   ') $$, '23514', null,
  'nombre vacío rechazado');
select throws_ok($$ insert into public.tables (name) values ('Una mesa con un nombre larguísimo') $$, '23514', null,
  'nombre de más de 20 caracteres rechazado');
select throws_ok($$ insert into public.tables (name) values ('pruebas mesa 1') $$, '23505', null,
  'nombre de mesa activa repetido (sin distinguir mayúsculas) rechazado');
select throws_ok($$ insert into public.tables (name, token) values ('Pruebas Mesa 3', gen_random_uuid()) $$, '42501', null,
  'el dueño no puede elegir el token');

-- Renombrar no cambia el token, y el token no se puede cambiar
reset role;
create temporary table qr_before as select token from public.tables where name = 'Pruebas Mesa 1';
grant select on qr_before to authenticated;
set local role authenticated;
update public.tables set name = 'Pruebas Ventana 1' where name = 'Pruebas Mesa 1';
select is((select token from public.tables where name = 'Pruebas Ventana 1'), (select token from qr_before),
  'renombrar una mesa conserva su token');
select throws_ok($$ update public.tables set token = gen_random_uuid() where name = 'Pruebas Ventana 1' $$, '42501', null,
  'el token no se puede cambiar');

-- Archivar y reactivar
update public.tables set archived_at = now() where name = 'Pruebas Mesa 2';
select isnt((select archived_at from public.tables where name = 'Pruebas Mesa 2'), null, 'el dueño archiva una mesa');
select lives_ok($$ insert into public.tables (name) values ('Pruebas Mesa 2') $$,
  'se puede reutilizar el nombre de una mesa archivada');
select throws_ok($$ update public.tables set archived_at = null where name = 'Pruebas Mesa 2' and archived_at is not null $$,
  '23505', null, 'no se reactiva una mesa con el nombre de otra activa');
select throws_ok($$ delete from public.tables $$, '42501', null, 'el dueño no puede borrar mesas');

-- Comensal (anon) ------------------------------------------------------------------
reset role;
set local role anon;
select throws_ok($$ select count(*) from public.tables $$, '42501', null, 'anon no puede listar mesas');
select throws_ok($$ insert into public.tables (name) values ('Intrusa') $$, '42501', null, 'anon no puede crear mesas');
select throws_ok($$ update public.tables set name = 'Hackeada' $$, '42501', null, 'anon no puede renombrar mesas');

-- Autenticado que no es dueño ------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a003","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ insert into public.tables (name) values ('Intrusa') $$, '42501', null,
  'un autenticado no dueño no puede crear mesas');
select is((select count(*)::int from public.tables), 0, 'un autenticado no dueño no ve mesas');
update public.tables set name = 'Hackeada', archived_at = now();

reset role;
select is((select count(*)::int from public.tables where name = 'Hackeada'), 0,
  'un no dueño no renombra mesas');
select is((select count(*)::int from public.tables where name = 'Pruebas Ventana 1' and archived_at is null), 1,
  'un no dueño no archiva mesas');

select * from finish();
rollback;
