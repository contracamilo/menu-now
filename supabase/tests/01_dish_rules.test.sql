-- Reglas de un plato en la base de datos (design D2).
-- La regla de precios es un constraint trigger diferido: cada caso se ejecuta en un
-- bloque que termina con `set constraints all immediate` para forzar la comprobación.
begin;
select plan(17);

insert into public.categories (id, name) values ('00000000-0000-0000-0000-0000000000c1', 'Pruebas Tapas');

create function pg_temp.included_id() returns uuid language sql as
  $$ select id from public.categories where is_included $$;

-- Declaración de alérgenos -------------------------------------------------

select throws_ok($$
  do $do$ begin
    set constraints all deferred;
    insert into public.dishes (id, category_id, name) values
      ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', 'Ensaladilla');
    insert into public.dish_sizes (dish_id, price_cents) values ('00000000-0000-0000-0000-0000000000d1', 350);
    set constraints all immediate;
  end $do$ $$,
  '23514', null, 'plato sin declaración de alérgenos → rechazado');

select throws_ok($$
  insert into public.dishes (category_id, name, allergens, no_allergens) values
    ('00000000-0000-0000-0000-0000000000c1', 'Tostada', '{gluten}', true) $$,
  '23514', null, 'plato con alérgenos y «no contiene alérgenos» a la vez → rechazado');

select lives_ok($$
  do $do$ begin
    set constraints all deferred;
    insert into public.dishes (id, category_id, name, no_allergens) values
      ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000c1', 'Agua mineral', true);
    insert into public.dish_sizes (dish_id, price_cents) values ('00000000-0000-0000-0000-0000000000d2', 150);
    set constraints all immediate;
  end $do$ $$,
  'plato declarado «no contiene alérgenos» → aceptado');

-- Datos obligatorios -------------------------------------------------------

select throws_ok($$
  insert into public.dishes (category_id, name, no_allergens) values
    ('00000000-0000-0000-0000-0000000000c1', null, true) $$,
  '23502', null, 'plato sin nombre → rechazado');

select throws_ok($$
  insert into public.dishes (category_id, name, no_allergens) values
    ('00000000-0000-0000-0000-0000000000c1', '   ', true) $$,
  '23514', null, 'plato con nombre en blanco → rechazado');

select throws_ok($$
  insert into public.dishes (category_id, name, no_allergens) values (null, 'Sin categoría', true) $$,
  '23502', null, 'plato sin categoría → rechazado');

select lives_ok($$
  do $do$ begin
    set constraints all deferred;
    insert into public.dishes (id, category_id, name, description, photo_path, no_allergens) values
      ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000c1', 'Café solo', null, null, true);
    insert into public.dish_sizes (dish_id, price_cents) values ('00000000-0000-0000-0000-0000000000d3', 120);
    set constraints all immediate;
  end $do$ $$,
  'plato sin descripción ni foto → aceptado');

-- Tamaños y precios fuera de «Incluidos» ------------------------------------

select throws_ok($$
  do $do$ begin
    set constraints all deferred;
    insert into public.dishes (category_id, name, no_allergens) values
      ('00000000-0000-0000-0000-0000000000c1', 'Sin precio', true);
    set constraints all immediate;
  end $do$ $$,
  '23514', null, 'plato fuera de «Incluidos» sin tamaños → rechazado');

select throws_ok($$
  do $do$ begin
    set constraints all deferred;
    insert into public.dishes (id, category_id, name, no_allergens) values
      ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000c1', 'Gratis', true);
    insert into public.dish_sizes (dish_id, price_cents) values ('00000000-0000-0000-0000-0000000000d4', 0);
    set constraints all immediate;
  end $do$ $$,
  '23514', null, 'plato con precio 0 fuera de «Incluidos» → rechazado');

select throws_ok($$
  do $do$ begin
    set constraints all deferred;
    insert into public.dishes (id, category_id, name, no_allergens) values
      ('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000c1', 'Croquetas', true);
    insert into public.dish_sizes (dish_id, label, price_cents, position) values
      ('00000000-0000-0000-0000-0000000000d5', 'Una', 150, 1),
      ('00000000-0000-0000-0000-0000000000d5', null, 700, 2);
    set constraints all immediate;
  end $do$ $$,
  '23514', null, 'varios tamaños y alguno sin nombre → rechazado');

select throws_ok($$
  do $do$ begin
    set constraints all deferred;
    insert into public.dishes (id, category_id, name, no_allergens) values
      ('00000000-0000-0000-0000-0000000000d6', '00000000-0000-0000-0000-0000000000c1', 'Patatas', true);
    insert into public.dish_sizes (dish_id, label, price_cents, position) values
      ('00000000-0000-0000-0000-0000000000d6', 'Ración', 500, 1),
      ('00000000-0000-0000-0000-0000000000d6', ' ración ', 600, 2);
    set constraints all immediate;
  end $do$ $$,
  '23505', null, 'nombres de tamaño repetidos en un plato → rechazado');

select lives_ok($$
  do $do$ begin
    set constraints all deferred;
    insert into public.dishes (id, category_id, name, no_allergens) values
      ('00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-0000000000c1', 'Calamares', true);
    insert into public.dish_sizes (dish_id, label, price_cents, position) values
      ('00000000-0000-0000-0000-0000000000d7', 'Media', 600, 1),
      ('00000000-0000-0000-0000-0000000000d7', 'Ración', 1000, 2);
    set constraints all immediate;
  end $do$ $$,
  'varios tamaños con nombres distintos → aceptado');

-- «Incluidos» ------------------------------------------------------------------

select throws_ok($$
  do $do$ begin
    set constraints all deferred;
    insert into public.dishes (id, category_id, name, included_with, no_allergens) values
      ('00000000-0000-0000-0000-0000000000d8', pg_temp.included_id(), 'Tapa con precio', 'Con cada bebida', true);
    insert into public.dish_sizes (dish_id, price_cents) values ('00000000-0000-0000-0000-0000000000d8', 200);
    set constraints all immediate;
  end $do$ $$,
  '23514', null, 'plato en «Incluidos» con tamaños → rechazado');

select throws_ok($$
  do $do$ begin
    set constraints all deferred;
    insert into public.dishes (category_id, name, no_allergens) values
      (pg_temp.included_id(), 'Tapa del día', true);
    set constraints all immediate;
  end $do$ $$,
  '23514', null, 'plato en «Incluidos» sin included_with → rechazado');

select lives_ok($$
  do $do$ begin
    set constraints all deferred;
    insert into public.dishes (category_id, name, included_with, allergens) values
      (pg_temp.included_id(), 'Tapa del día', 'Con cada bebida', '{gluten}');
    set constraints all immediate;
  end $do$ $$,
  'plato en «Incluidos» con included_with y sin tamaños → aceptado');

select throws_ok($$
  do $do$ begin
    set constraints all deferred;
    update public.dishes set category_id = pg_temp.included_id(), included_with = 'Con cada bebida'
     where id = '00000000-0000-0000-0000-0000000000d2';
    set constraints all immediate;
  end $do$ $$,
  '23514', null, 'mover un plato a «Incluidos» sin quitarle los tamaños → rechazado');

select throws_ok($$
  do $do$ begin
    set constraints all deferred;
    update public.dishes set included_with = 'Con cada bebida'
     where id = '00000000-0000-0000-0000-0000000000d2';
    set constraints all immediate;
  end $do$ $$,
  '23514', null, 'plato con precio e included_with fuera de «Incluidos» → rechazado');

select * from finish();
rollback;
