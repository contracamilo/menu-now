-- Categorías y la categoría del sistema «Incluidos» (design D2).
begin;
select plan(13);

select is((select count(*)::int from public.categories where is_included), 1,
  'existe exactamente una categoría «Incluidos» tras la migración');

select throws_ok($$ update public.categories set archived_at = now() where is_included $$,
  '23514', null, '«Incluidos» no se puede archivar');

select throws_ok($$ update public.categories set name = 'Extras' where is_included $$,
  '23514', null, '«Incluidos» no se puede renombrar');

select throws_ok($$ insert into public.categories (is_included) values (true) $$,
  '23505', null, 'no se puede crear otra «Incluidos»');

select throws_ok($$ update public.categories set is_included = false where is_included $$,
  '23514', null, 'no se puede quitar is_included a «Incluidos»');

insert into public.categories (id, name) values ('00000000-0000-0000-0000-0000000000c1', 'Pruebas Bebidas');

select throws_ok($$ update public.categories set is_included = true, name = null
                     where id = '00000000-0000-0000-0000-0000000000c1' $$,
  '23514', null, 'no se puede convertir una categoría en «Incluidos»');

select throws_ok($$ insert into public.categories (name) values ('') $$,
  '23514', null, 'nombre vacío → rechazado');

select throws_ok($$ insert into public.categories (name) values (null) $$,
  '23514', null, 'nombre nulo en una categoría normal → rechazado');

select throws_ok($$ insert into public.categories (name) values (' Incluidos ') $$,
  '23514', null, '«Incluidos» como nombre → rechazado');

select throws_ok($$ insert into public.categories (name) values ('INCLUDED') $$,
  '23514', null, '«Included» como nombre (sin distinguir mayúsculas) → rechazado');

select throws_ok($$ insert into public.categories (name) values ('pruebas bebidas') $$,
  '23505', null, 'nombre igual a otra categoría activa (sin distinguir mayúsculas) → rechazado');

update public.categories set archived_at = now() where id = '00000000-0000-0000-0000-0000000000c1';

select lives_ok($$ insert into public.categories (name) values ('Pruebas Bebidas') $$,
  'se puede repetir el nombre de una categoría archivada');

select throws_ok($$ update public.categories set archived_at = null
                     where id = '00000000-0000-0000-0000-0000000000c1' $$,
  '23505', null, 'no se puede reactivar una categoría si ya hay otra activa con su nombre');

select * from finish();
rollback;
