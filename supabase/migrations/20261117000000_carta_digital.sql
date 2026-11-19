-- add-carta-digital: carta pública, catálogo del dueño, datos del local y acceso a la administración.
-- Ver openspec/changes/add-carta-digital/design.md (D2–D5).

------------------------------------------------------------------------------
-- D2. Modelo de datos
------------------------------------------------------------------------------

-- Alérgenos del Reglamento (UE) 1169/2011, Anexo II
create type public.allergen as enum (
  'gluten','crustaceans','eggs','fish','peanuts','soy','milk',
  'tree_nuts','celery','mustard','sesame','sulphites','lupin','molluscs'
);

-- Usuarios de la zona privada (hoy solo dueños, uno o varios; el personal llegará después)
create table public.backoffice_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null check (role in ('owner')),
  created_at timestamptz not null default now()
);

-- Datos del local: una sola fila
create table public.venue_settings (
  id         boolean primary key default true check (id),
  name       text check (name is null or char_length(btrim(name)) between 1 and 60),
  logo_path  text,
  updated_at timestamptz not null default now()
);
insert into public.venue_settings (id) values (true);

create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  is_included boolean not null default false,   -- la categoría del sistema «Incluidos»
  name        text,                              -- null solo en «Incluidos» (nombre traducido por la UI)
  position    integer not null,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  constraint categories_name_rule check (
    (is_included and name is null)
    or (not is_included
        and name is not null
        and char_length(btrim(name)) between 1 and 40
        and lower(btrim(name)) not in ('incluidos', 'included'))),
  constraint categories_included_never_archived check (not (is_included and archived_at is not null))
);
create unique index categories_single_included on public.categories (is_included) where is_included;
create unique index categories_active_name_unique on public.categories (lower(btrim(name)))
  where archived_at is null and not is_included;
create index categories_position_idx on public.categories (position);

create table public.dishes (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid not null references public.categories(id) on delete restrict,
  name          text not null check (char_length(btrim(name)) between 1 and 80),
  description   text check (description is null or char_length(btrim(description)) between 1 and 160),
  included_with text check (included_with is null or char_length(btrim(included_with)) between 1 and 60),
  photo_path    text,
  allergens     public.allergen[] not null default '{}',
  no_allergens  boolean not null default false,
  position      integer not null,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  -- Exactamente una declaración: lista no vacía XOR «no contiene alérgenos»
  constraint dishes_allergen_declaration check (
    (no_allergens and cardinality(allergens) = 0)
    or (not no_allergens and cardinality(allergens) > 0))
);
create index dishes_category_position_idx on public.dishes (category_id, position);

create table public.dish_sizes (
  id          uuid primary key default gen_random_uuid(),
  dish_id     uuid not null references public.dishes(id) on delete cascade,
  label       text check (label is null or char_length(btrim(label)) between 1 and 20),
  price_cents integer not null check (price_cents > 0),
  position    integer not null,
  constraint dish_sizes_position_unique unique (dish_id, position) deferrable initially deferred
);
create unique index dish_sizes_label_unique on public.dish_sizes (dish_id, lower(btrim(label)))
  where label is not null;

-- Posición: si llega nula, va al final de su ámbito
create function public.set_default_position() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.position is null then
    if tg_table_name = 'categories' then
      select coalesce(max(position), 0) + 1 into new.position from public.categories;
    elsif tg_table_name = 'dishes' then
      select coalesce(max(position), 0) + 1 into new.position
        from public.dishes where category_id = new.category_id;
    else
      select coalesce(max(position), 0) + 1 into new.position
        from public.dish_sizes where dish_id = new.dish_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger categories_default_position before insert on public.categories
  for each row execute function public.set_default_position();
create trigger dishes_default_position before insert on public.dishes
  for each row execute function public.set_default_position();
create trigger dish_sizes_default_position before insert on public.dish_sizes
  for each row execute function public.set_default_position();

-- La categoría «Incluidos» la crea la migración (después del trigger de posición)
insert into public.categories (is_included, position) values (true, 1);

-- Un plato movido a otra categoría queda al final de la nueva
create function public.dish_moved_to_end() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.category_id is distinct from old.category_id then
    select coalesce(max(position), 0) + 1 into new.position
      from public.dishes where category_id = new.category_id;
  end if;
  return new;
end;
$$;

create trigger dishes_moved_to_end before update of category_id on public.dishes
  for each row execute function public.dish_moved_to_end();

-- `is_included` no puede cambiar después de crearse la categoría
create function public.categories_is_included_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.is_included is distinct from old.is_included then
    raise exception 'is_included cannot change' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger categories_is_included_immutable before update on public.categories
  for each row execute function public.categories_is_included_immutable();

-- La fecha de actualización de los datos del local se mantiene sola
create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger venue_settings_touch before update on public.venue_settings
  for each row execute function public.touch_updated_at();

------------------------------------------------------------------------------
-- D2. Regla de precios (cruza tablas): constraint trigger diferido
--   «Incluidos»  → included_with no nulo y cero tamaños
--   resto        → included_with nulo, al menos un tamaño y, con varios, todos con nombre
------------------------------------------------------------------------------

create function public.check_dish_price_rule(p_dish_id uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  v_included boolean;
  v_included_with text;
  v_sizes integer;
  v_unlabeled integer;
begin
  select c.is_included, d.included_with
    into v_included, v_included_with
    from public.dishes d join public.categories c on c.id = d.category_id
   where d.id = p_dish_id;
  if not found then
    return;  -- plato borrado en la misma transacción (cascada de tamaños)
  end if;

  select count(*), count(*) filter (where label is null)
    into v_sizes, v_unlabeled
    from public.dish_sizes where dish_id = p_dish_id;

  if v_included then
    if v_included_with is null or v_sizes > 0 then
      raise exception 'included dish needs included_with and no sizes'
        using errcode = '23514', constraint = 'dish_price_rule';
    end if;
  else
    if v_included_with is not null or v_sizes = 0 or (v_sizes > 1 and v_unlabeled > 0) then
      raise exception 'priced dish needs at least one size, labeled when several'
        using errcode = '23514', constraint = 'dish_price_rule';
    end if;
  end if;
end;
$$;

create function public.trg_check_dish_price_rule() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'dishes' then
    perform public.check_dish_price_rule(new.id);
  elsif tg_op = 'DELETE' then
    perform public.check_dish_price_rule(old.dish_id);
  else
    perform public.check_dish_price_rule(new.dish_id);
    if tg_op = 'UPDATE' and old.dish_id is distinct from new.dish_id then
      perform public.check_dish_price_rule(old.dish_id);
    end if;
  end if;
  return null;
end;
$$;

create constraint trigger dishes_price_rule
  after insert or update on public.dishes
  deferrable initially deferred
  for each row execute function public.trg_check_dish_price_rule();

create constraint trigger dish_sizes_price_rule
  after insert or update or delete on public.dish_sizes
  deferrable initially deferred
  for each row execute function public.trg_check_dish_price_rule();

------------------------------------------------------------------------------
-- D3. RLS y permisos
------------------------------------------------------------------------------

create function public.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.backoffice_users
                 where user_id = auth.uid() and role = 'owner');
$$;

alter table public.backoffice_users enable row level security;
alter table public.venue_settings   enable row level security;
alter table public.categories       enable row level security;
alter table public.dishes           enable row level security;
alter table public.dish_sizes       enable row level security;

-- Cada usuario autenticado puede leer solo su propia fila (para saber si es dueño)
create policy "self read" on public.backoffice_users
  for select to authenticated using (user_id = auth.uid());

-- Datos del local: lectura pública, actualización solo del dueño (sin insert/delete)
create policy "public read venue" on public.venue_settings
  for select to anon, authenticated using (true);
create policy "owner update venue" on public.venue_settings
  for update to authenticated using (public.is_owner()) with check (public.is_owner());

-- Lectura pública: solo lo visible en la carta
create policy "public read active categories" on public.categories
  for select to anon, authenticated using (archived_at is null);
create policy "public read active dishes" on public.dishes
  for select to anon, authenticated using (
    archived_at is null and exists (
      select 1 from public.categories c
      where c.id = category_id and c.archived_at is null));
create policy "public read visible sizes" on public.dish_sizes
  for select to anon, authenticated using (
    exists (select 1 from public.dishes d where d.id = dish_id));  -- hereda la RLS de dishes

-- El dueño lee todo (incluido lo archivado) y escribe
create policy "owner read categories" on public.categories
  for select to authenticated using (public.is_owner());
create policy "owner insert categories" on public.categories
  for insert to authenticated with check (public.is_owner() and not is_included);
create policy "owner update categories" on public.categories
  for update to authenticated using (public.is_owner()) with check (public.is_owner());

create policy "owner read dishes" on public.dishes
  for select to authenticated using (public.is_owner());
create policy "owner insert dishes" on public.dishes
  for insert to authenticated with check (public.is_owner());
create policy "owner update dishes" on public.dishes
  for update to authenticated using (public.is_owner()) with check (public.is_owner());

-- Tamaños: el dueño los sustituye al editar, así que también puede borrarlos
create policy "owner read sizes" on public.dish_sizes
  for select to authenticated using (public.is_owner());
create policy "owner insert sizes" on public.dish_sizes
  for insert to authenticated with check (public.is_owner());
create policy "owner update sizes" on public.dish_sizes
  for update to authenticated using (public.is_owner()) with check (public.is_owner());
create policy "owner delete sizes" on public.dish_sizes
  for delete to authenticated using (public.is_owner());

-- Sin políticas DELETE en categorías ni platos: nadie puede borrarlos.
-- (TRUNCATE no pasa por RLS: se retira también.)
revoke delete, truncate on public.categories, public.dishes, public.venue_settings from anon, authenticated;
revoke insert, update, delete, truncate on public.categories, public.dishes, public.dish_sizes,
  public.venue_settings from anon;
revoke truncate on public.dish_sizes from authenticated;
-- El alta y baja de dueños se hace con el rol de servicio (Migration Plan)
revoke insert, update, delete, truncate on public.backoffice_users from anon, authenticated;

------------------------------------------------------------------------------
-- D4. Guardado del plato y reordenación con RPC atómicas
------------------------------------------------------------------------------

-- Crea o actualiza el plato y sustituye sus tamaños en una sola transacción.
-- p_dish: {id?, category_id, name, description?, included_with?, photo_path?, allergens[], no_allergens}
--   Si `id` viene y existe, se actualiza; si viene y no existe, se crea con ese id (así el
--   cliente puede subir la foto a `dishes/<id>/…` antes de guardar); si no viene, se genera.
-- p_sizes: [{id?, label?, price_cents}] en el orden en que deben mostrarse
create function public.save_dish(p_dish jsonb, p_sizes jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid := coalesce(nullif(p_dish->>'id', '')::uuid, gen_random_uuid());
  v_allergens public.allergen[] :=
    coalesce(array(select jsonb_array_elements_text(coalesce(p_dish->'allergens', '[]'::jsonb)))::public.allergen[], '{}');
  v_size record;
begin
  update public.dishes set
    category_id   = (p_dish->>'category_id')::uuid,
    name          = btrim(p_dish->>'name'),
    description   = nullif(btrim(p_dish->>'description'), ''),
    included_with = nullif(btrim(p_dish->>'included_with'), ''),
    photo_path    = nullif(p_dish->>'photo_path', ''),
    allergens     = v_allergens,
    no_allergens  = coalesce((p_dish->>'no_allergens')::boolean, false)
  where id = v_id;

  if not found then
    insert into public.dishes (id, category_id, name, description, included_with, photo_path, allergens, no_allergens)
    values (
      v_id,
      (p_dish->>'category_id')::uuid,
      btrim(p_dish->>'name'),
      nullif(btrim(p_dish->>'description'), ''),
      nullif(btrim(p_dish->>'included_with'), ''),
      nullif(p_dish->>'photo_path', ''),
      v_allergens,
      coalesce((p_dish->>'no_allergens')::boolean, false));
  end if;

  -- Los tamaños que ya no vienen se borran
  delete from public.dish_sizes
   where dish_id = v_id
     and id <> all (array(
       select (s->>'id')::uuid from jsonb_array_elements(coalesce(p_sizes, '[]'::jsonb)) s
        where nullif(s->>'id', '') is not null));

  -- El resto se actualiza o inserta con su posición
  for v_size in
    select nullif(s->>'id', '')::uuid as id,
           nullif(btrim(s->>'label'), '') as label,
           (s->>'price_cents')::integer as price_cents,
           ord::integer as position
      from jsonb_array_elements(coalesce(p_sizes, '[]'::jsonb)) with ordinality as t(s, ord)
  loop
    update public.dish_sizes
       set label = v_size.label, price_cents = v_size.price_cents, position = v_size.position
     where id = v_size.id and dish_id = v_id;
    if v_size.id is null or not found then
      insert into public.dish_sizes (dish_id, label, price_cents, position)
      values (v_id, v_size.label, v_size.price_cents, v_size.position);
    end if;
  end loop;

  return v_id;
end;
$$;

-- Intercambia la posición con el vecino activo más cercano (-1 sube, +1 baja).
create function public.move_dish(p_id uuid, p_direction integer) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_me record;
  v_other record;
begin
  if p_direction not in (-1, 1) then
    raise exception 'direction must be -1 or 1' using errcode = '22023';
  end if;

  select id, category_id, position, created_at into v_me
    from public.dishes where id = p_id and archived_at is null;
  if not found then
    return;
  end if;

  if p_direction < 0 then
    select id, position into v_other from public.dishes
     where category_id = v_me.category_id and archived_at is null
       and (position, created_at, id) < (v_me.position, v_me.created_at, v_me.id)
     order by position desc, created_at desc, id desc limit 1;
  else
    select id, position into v_other from public.dishes
     where category_id = v_me.category_id and archived_at is null
       and (position, created_at, id) > (v_me.position, v_me.created_at, v_me.id)
     order by position, created_at, id limit 1;
  end if;
  if not found then
    return;
  end if;

  update public.dishes set position = v_me.position where id = v_other.id;
  update public.dishes
     set position = case when v_other.position = v_me.position
                         then v_other.position + p_direction else v_other.position end
   where id = v_me.id;
end;
$$;

create function public.move_category(p_id uuid, p_direction integer) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_me record;
  v_other record;
begin
  if p_direction not in (-1, 1) then
    raise exception 'direction must be -1 or 1' using errcode = '22023';
  end if;

  select id, position, created_at into v_me
    from public.categories where id = p_id and archived_at is null;
  if not found then
    return;
  end if;

  if p_direction < 0 then
    select id, position into v_other from public.categories
     where archived_at is null
       and (position, created_at, id) < (v_me.position, v_me.created_at, v_me.id)
     order by position desc, created_at desc, id desc limit 1;
  else
    select id, position into v_other from public.categories
     where archived_at is null
       and (position, created_at, id) > (v_me.position, v_me.created_at, v_me.id)
     order by position, created_at, id limit 1;
  end if;
  if not found then
    return;
  end if;

  update public.categories set position = v_me.position where id = v_other.id;
  update public.categories
     set position = case when v_other.position = v_me.position
                         then v_other.position + p_direction else v_other.position end
   where id = v_me.id;
end;
$$;

-- Solo usuarios autenticados pueden llamar a las RPC de escritura (RLS decide si son dueños)
revoke execute on function public.save_dish(jsonb, jsonb) from public, anon;
revoke execute on function public.move_dish(uuid, integer) from public, anon;
revoke execute on function public.move_category(uuid, integer) from public, anon;
grant execute on function public.save_dish(jsonb, jsonb) to authenticated;
grant execute on function public.move_dish(uuid, integer) to authenticated;
grant execute on function public.move_category(uuid, integer) to authenticated;

------------------------------------------------------------------------------
-- D5. Imágenes: bucket público `images` (5 MB, JPEG y PNG)
------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', true, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "public read images" on storage.objects
  for select to anon, authenticated using (bucket_id = 'images');
create policy "owner insert images" on storage.objects
  for insert to authenticated with check (bucket_id = 'images' and public.is_owner());
create policy "owner update images" on storage.objects
  for update to authenticated
  using (bucket_id = 'images' and public.is_owner())
  with check (bucket_id = 'images' and public.is_owner());
create policy "owner delete images" on storage.objects
  for delete to authenticated using (bucket_id = 'images' and public.is_owner());
