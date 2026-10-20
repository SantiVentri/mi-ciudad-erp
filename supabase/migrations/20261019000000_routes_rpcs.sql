-- Versiona las columnas, restricciones, índices, políticas y funciones de rutas/pedidos
-- que ya existían en la base pero no estaban en ninguna migración.
-- Es idempotente: se puede correr sobre la base actual sin cambiar su comportamiento.
-- Cambios reales: se borra el overload viejo de create_route_with_stops y se quita
-- el permiso de ejecución pública de las funciones internas (ver al final).

-- ---------------------------------------------------------------------------
-- Columnas
-- ---------------------------------------------------------------------------
alter table public.routes add column if not exists co_driver_id uuid;
alter table public.routes add column if not exists trip_number smallint not null default 1;
alter table public.routes alter column state set default 'Pendiente';

-- ---------------------------------------------------------------------------
-- Restricciones
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'routes_co_driver_id_fkey') then
    alter table public.routes
      add constraint routes_co_driver_id_fkey foreign key (co_driver_id)
      references public.profiles(id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'routes_co_driver_differs') then
    alter table public.routes
      add constraint routes_co_driver_differs
      check (co_driver_id is null or co_driver_id <> driver_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'routes_trip_number_check') then
    alter table public.routes
      add constraint routes_trip_number_check check (trip_number = any (array[1, 2]));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'routes_state_check') then
    alter table public.routes
      add constraint routes_state_check
      check (state = any (array['Pendiente', 'En curso', 'Completada', 'Cancelada']));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'stops_state_check') then
    alter table public.stops
      add constraint stops_state_check
      check (state = any (array['Pendiente', 'Completada', 'Cancelada']));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'orders_state_check') then
    alter table public.orders
      add constraint orders_state_check
      check (state = any (array['Pendiente', 'Completada', 'Cancelada']));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------------
create index if not exists orders_arrival_state_idx on public.orders (arrival_date, state);
create index if not exists routes_route_date_idx on public.routes (route_date);

-- Un chofer / acompañante / vehículo no puede estar en dos rutas activas del mismo día y vuelta
create unique index if not exists routes_driver_trip_uq
  on public.routes (driver_id, ((route_date at time zone 'UTC')::date), trip_number)
  where state <> 'Cancelada';
create unique index if not exists routes_co_driver_trip_uq
  on public.routes (co_driver_id, ((route_date at time zone 'UTC')::date), trip_number)
  where co_driver_id is not null and state <> 'Cancelada';
create unique index if not exists routes_vehicle_trip_uq
  on public.routes (vehicle_id, ((route_date at time zone 'UTC')::date), trip_number)
  where state <> 'Cancelada';

-- Un pedido solo puede tener una parada viva
create unique index if not exists stops_one_live_per_order_uq
  on public.stops (order_id)
  where state <> 'Cancelada';

-- ---------------------------------------------------------------------------
-- Políticas de choferes (incluyen al acompañante)
-- ---------------------------------------------------------------------------
drop policy if exists "Drivers can view own routes" on public.routes;
create policy "Drivers can view own routes" on public.routes
  for select using (is_driver() and (driver_id = auth.uid() or co_driver_id = auth.uid()));

drop policy if exists "Drivers can update state of own routes" on public.routes;
create policy "Drivers can update state of own routes" on public.routes
  for update
  using (is_driver() and (driver_id = auth.uid() or co_driver_id = auth.uid()))
  with check (is_driver() and (driver_id = auth.uid() or co_driver_id = auth.uid()));

drop policy if exists "Drivers can view own route stops" on public.stops;
create policy "Drivers can view own route stops" on public.stops
  for select using (is_driver() and exists (
    select 1 from routes r
    where r.id = stops.route_id and (r.driver_id = auth.uid() or r.co_driver_id = auth.uid())
  ));

drop policy if exists "Drivers can update state of own route stops" on public.stops;
create policy "Drivers can update state of own route stops" on public.stops
  for update
  using (is_driver() and exists (
    select 1 from routes r
    where r.id = stops.route_id and (r.driver_id = auth.uid() or r.co_driver_id = auth.uid())
  ))
  with check (is_driver() and exists (
    select 1 from routes r
    where r.id = stops.route_id and (r.driver_id = auth.uid() or r.co_driver_id = auth.uid())
  ));

drop policy if exists "Drivers can view own route orders" on public.orders;
create policy "Drivers can view own route orders" on public.orders
  for select using (is_driver() and exists (
    select 1 from stops s join routes r on r.id = s.route_id
    where s.order_id = orders.id and (r.driver_id = auth.uid() or r.co_driver_id = auth.uid())
  ));

drop policy if exists "Drivers can view own route order_details" on public.order_details;
create policy "Drivers can view own route order_details" on public.order_details
  for select using (is_driver() and exists (
    select 1 from stops s join routes r on r.id = s.route_id
    where s.order_id = order_details.order_id and (r.driver_id = auth.uid() or r.co_driver_id = auth.uid())
  ));

drop policy if exists "Drivers can view clients on their routes" on public.clients;
create policy "Drivers can view clients on their routes" on public.clients
  for select using (is_driver() and exists (
    select 1 from orders o
      join stops s on s.order_id = o.id
      join routes r on r.id = s.route_id
    where o.client_id = clients.id and (r.driver_id = auth.uid() or r.co_driver_id = auth.uid())
  ));

-- ---------------------------------------------------------------------------
-- Funciones auxiliares
-- ---------------------------------------------------------------------------
create or replace function public.app_today()
 returns date
 language sql
 stable
as $function$
  select (now() at time zone 'America/Argentina/Buenos_Aires')::date;
$function$;

create or replace function public.is_active_driver(p_user_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1
    from auth.users u
    join public.profiles p on p.id = u.id
    where u.id = p_user_id
      and u.raw_app_meta_data ->> 'role' = 'driver'
      and p.is_active is true
  );
$function$;

create or replace function public.get_drivers()
 returns table(id uuid, first_name text, last_name text, email text, phone text, avatar text, is_active boolean)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not is_admin() then
    raise exception 'No autorizado';
  end if;

  return query
  select
    p.id,
    p.first_name,
    p.last_name,
    p.email,
    p.phone,
    p.avatar,
    p.is_active
  from profiles p
  join auth.users u on u.id = p.id
  where u.raw_app_meta_data ->> 'role' = 'driver';
end;
$function$;

create or replace function public.notify_user(p_user_id uuid, p_type text, p_message text, p_metadata jsonb default null::jsonb, p_href text default null::text)
 returns void
 language sql
 security definer
 set search_path to 'public'
as $function$
  insert into public.notifications (id, user_id, type, message, created_at, seen, metadata, href)
  values (gen_random_uuid(), p_user_id, p_type, p_message, now(), false, p_metadata, p_href);
$function$;

create or replace function public.notify_route_drivers(p_route_id uuid, p_type text, p_message text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r routes%rowtype;
  v_meta jsonb;
begin
  select * into r from routes where id = p_route_id;
  if not found then return; end if;

  v_meta := jsonb_build_object(
    'route_id', r.id,
    'route_number', r.route_number,
    'route_date', (r.route_date at time zone 'UTC')::date
  );

  if r.driver_id is not null then
    perform notify_user(r.driver_id, p_type, p_message, v_meta, null);
  end if;
  if r.co_driver_id is not null then
    perform notify_user(r.co_driver_id, p_type, p_message, v_meta, null);
  end if;
end;
$function$;

create or replace function public.assert_orders_assignable(p_order_ids uuid[], p_date date, p_route_id uuid default null::uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  -- Bloquea los pedidos para que dos admins no puedan tomarlos a la vez
  perform 1 from orders where id = any(p_order_ids) order by id for update;

  if (select count(*) from orders where id = any(p_order_ids)) <> cardinality(p_order_ids) then
    raise exception 'Algún pedido no existe';
  end if;

  if exists (
    select 1 from orders o
    where o.id = any(p_order_ids)
      and (o.state <> 'Pendiente'
           or (o.arrival_date at time zone 'UTC')::date <> p_date)
  ) then
    raise exception 'Todos los pedidos deben estar pendientes y ser del día de la ruta';
  end if;

  if exists (
    select 1 from stops s
    where s.order_id = any(p_order_ids)
      and s.state <> 'Cancelada'
      and (p_route_id is null or s.route_id <> p_route_id)
  ) then
    raise exception 'Algún pedido ya está en otra ruta';
  end if;
end;
$function$;

create or replace function public.assert_route_slot_free(p_date date, p_trip smallint, p_driver_id uuid, p_co_driver_id uuid, p_vehicle_id uuid, p_exclude_route_id uuid default null::uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if exists (
    select 1 from routes r
    where r.state <> 'Cancelada'
      and (r.route_date at time zone 'UTC')::date = p_date
      and r.trip_number = p_trip
      and (p_exclude_route_id is null or r.id <> p_exclude_route_id)
      and (r.driver_id in (p_driver_id, p_co_driver_id)
           or r.co_driver_id in (p_driver_id, p_co_driver_id))
  ) then
    raise exception 'Alguno de los choferes ya tiene una ruta en esa vuelta y día';
  end if;

  if exists (
    select 1 from routes r
    where r.state <> 'Cancelada'
      and (r.route_date at time zone 'UTC')::date = p_date
      and r.trip_number = p_trip
      and (p_exclude_route_id is null or r.id <> p_exclude_route_id)
      and r.vehicle_id = p_vehicle_id
  ) then
    raise exception 'El vehículo ya tiene una ruta en esa vuelta y día';
  end if;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Rutas
-- ---------------------------------------------------------------------------
-- Overload viejo sin validaciones (fecha, choferes activos, pedidos libres). Se reemplaza por el de abajo.
drop function if exists public.create_route_with_stops(uuid, uuid, timestamp with time zone, uuid[]);

create or replace function public.create_route_with_stops(p_driver_id uuid, p_co_driver_id uuid, p_vehicle_id uuid, p_route_date date, p_trip_number smallint, p_order_ids uuid[])
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_route_id uuid;
  v_route_number int;
begin
  if not is_admin() then
    raise exception 'No autorizado';
  end if;
  if p_route_date is null or p_route_date < app_today() then
    raise exception 'La fecha de la ruta no puede ser pasada';
  end if;
  if p_trip_number is null or p_trip_number not in (1, 2) then
    raise exception 'La vuelta debe ser 1 o 2';
  end if;
  if p_order_ids is null or coalesce(cardinality(p_order_ids), 0) = 0 then
    raise exception 'La ruta necesita al menos un pedido';
  end if;
  if (select count(distinct x) from unnest(p_order_ids) as x) <> cardinality(p_order_ids) then
    raise exception 'Hay pedidos repetidos';
  end if;
  if p_driver_id is null or p_co_driver_id is null then
    raise exception 'La ruta necesita dos choferes';
  end if;
  if p_driver_id = p_co_driver_id then
    raise exception 'Los dos choferes deben ser distintos';
  end if;
  if not is_active_driver(p_driver_id) or not is_active_driver(p_co_driver_id) then
    raise exception 'Los dos choferes deben ser conductores activos';
  end if;
  if not exists (select 1 from vehicles v where v.id = p_vehicle_id and v.is_active is true) then
    raise exception 'El vehículo no existe o está deshabilitado';
  end if;

  -- Un solo admin a la vez puede armar rutas de un mismo día
  perform pg_advisory_xact_lock(hashtext('routes:' || p_route_date::text));

  perform assert_route_slot_free(p_route_date, p_trip_number, p_driver_id, p_co_driver_id, p_vehicle_id, null);
  perform assert_orders_assignable(p_order_ids, p_route_date, null);

  insert into routes (driver_id, co_driver_id, vehicle_id, route_date, state, trip_number)
  values (p_driver_id, p_co_driver_id, p_vehicle_id, (p_route_date::timestamp at time zone 'UTC'), 'Pendiente', p_trip_number)
  returning id, route_number into v_route_id, v_route_number;

  insert into stops (route_id, order_id, visit_order, state)
  select v_route_id, t.order_id, t.ord, 'Pendiente'
  from unnest(p_order_ids) with ordinality as t(order_id, ord);

  perform notify_route_drivers(
    v_route_id, 'route_assigned',
    format('Se te asignó la ruta #%s del %s (vuelta %s)', v_route_number, to_char(p_route_date, 'DD/MM/YYYY'), p_trip_number)
  );

  return v_route_id;
end;
$function$;

create or replace function public.create_routes_batch(p_route_date date, p_routes jsonb)
 returns uuid[]
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_item jsonb;
  v_orders uuid[];
  v_ids uuid[] := '{}';
  v_id uuid;
begin
  if not is_admin() then
    raise exception 'No autorizado';
  end if;
  if p_routes is null or jsonb_typeof(p_routes) <> 'array' or jsonb_array_length(p_routes) = 0 then
    raise exception 'No hay rutas para crear';
  end if;

  for v_item in select value from jsonb_array_elements(p_routes) loop
    select array_agg(x.value::uuid order by x.ord)
      into v_orders
    from jsonb_array_elements_text(v_item -> 'order_ids') with ordinality as x(value, ord);

    v_id := create_route_with_stops(
      (v_item ->> 'driver_id')::uuid,
      (v_item ->> 'co_driver_id')::uuid,
      (v_item ->> 'vehicle_id')::uuid,
      p_route_date,
      (v_item ->> 'trip_number')::smallint,
      v_orders
    );
    v_ids := v_ids || v_id;
  end loop;

  return v_ids;
end;
$function$;

create or replace function public.release_order_from_route(p_order_id uuid)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_stop stops%rowtype;
  r routes%rowtype;
  v_remaining int;
begin
  if not is_admin() then
    raise exception 'No autorizado';
  end if;

  select * into v_stop from stops
  where order_id = p_order_id and state <> 'Cancelada'
  limit 1;
  if not found then
    return null;
  end if;

  select * into r from routes where id = v_stop.route_id for update;
  if r.state <> 'Pendiente' then
    raise exception 'El pedido está en la ruta #%, que está %', r.route_number, lower(r.state);
  end if;

  delete from stops where id = v_stop.id;

  select count(*) into v_remaining from stops where route_id = r.id and state <> 'Cancelada';

  if v_remaining = 0 then
    update routes set state = 'Cancelada' where id = r.id;
    perform notify_route_drivers(
      r.id, 'route_cancelled',
      format('La ruta #%s fue cancelada porque se quedó sin pedidos', r.route_number)
    );
  else
    update stops s set visit_order = x.n
    from (
      select id, row_number() over (order by visit_order) as n
      from stops where route_id = r.id and state <> 'Cancelada'
    ) x
    where s.id = x.id;

    perform notify_route_drivers(
      r.id, 'route_updated',
      format('Se quitó un pedido de la ruta #%s', r.route_number)
    );
  end if;

  return r.id;
end;
$function$;

create or replace function public.cancel_route(p_route_id uuid)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r routes%rowtype;
  v_done int;
  v_new text;
begin
  if not is_admin() then
    raise exception 'No autorizado';
  end if;

  select * into r from routes where id = p_route_id for update;
  if not found then
    raise exception 'La ruta no existe';
  end if;
  if r.state in ('Cancelada', 'Completada') then
    raise exception 'La ruta ya está finalizada';
  end if;

  select count(*) into v_done from stops where route_id = r.id and state = 'Completada';

  -- Las paradas no entregadas se cancelan; los pedidos siguen "Pendiente" y quedan sin ruta
  update stops set state = 'Cancelada' where route_id = r.id and state = 'Pendiente';

  v_new := case when v_done > 0 then 'Completada' else 'Cancelada' end;
  update routes set state = v_new where id = r.id;

  perform notify_route_drivers(
    r.id, 'route_cancelled',
    case when v_done > 0
      then format('La ruta #%s fue cerrada antes de terminar', r.route_number)
      else format('La ruta #%s fue cancelada', r.route_number)
    end
  );

  return v_new;
end;
$function$;

create or replace function public.set_route_stops(p_route_id uuid, p_order_ids uuid[])
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r routes%rowtype;
  v_day date;
begin
  if not is_admin() then
    raise exception 'No autorizado';
  end if;

  select * into r from routes where id = p_route_id for update;
  if not found then
    raise exception 'La ruta no existe';
  end if;
  if r.state <> 'Pendiente' then
    raise exception 'Solo se pueden editar rutas pendientes';
  end if;

  -- Sin pedidos, la ruta se cancela
  if p_order_ids is null or coalesce(cardinality(p_order_ids), 0) = 0 then
    perform cancel_route(p_route_id);
    return;
  end if;

  if (select count(distinct x) from unnest(p_order_ids) as x) <> cardinality(p_order_ids) then
    raise exception 'Hay pedidos repetidos';
  end if;

  v_day := (r.route_date at time zone 'UTC')::date;
  perform pg_advisory_xact_lock(hashtext('routes:' || v_day::text));
  perform assert_orders_assignable(p_order_ids, v_day, p_route_id);

  delete from stops
  where route_id = p_route_id and state <> 'Cancelada' and not (order_id = any(p_order_ids));

  update stops s set visit_order = t.ord
  from unnest(p_order_ids) with ordinality as t(order_id, ord)
  where s.route_id = p_route_id and s.state <> 'Cancelada' and s.order_id = t.order_id;

  insert into stops (route_id, order_id, visit_order, state)
  select p_route_id, t.order_id, t.ord, 'Pendiente'
  from unnest(p_order_ids) with ordinality as t(order_id, ord)
  where not exists (
    select 1 from stops s
    where s.route_id = p_route_id and s.state <> 'Cancelada' and s.order_id = t.order_id
  );

  perform notify_route_drivers(
    p_route_id, 'route_updated',
    format('Se modificaron las paradas de la ruta #%s', r.route_number)
  );
end;
$function$;

create or replace function public.update_route_assignment(p_route_id uuid, p_driver_id uuid, p_co_driver_id uuid, p_vehicle_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r routes%rowtype;
  v_day date;
  v_old uuid[];
  v_new uuid[];
  v_uid uuid;
begin
  if not is_admin() then
    raise exception 'No autorizado';
  end if;

  select * into r from routes where id = p_route_id for update;
  if not found then
    raise exception 'La ruta no existe';
  end if;
  if r.state <> 'Pendiente' then
    raise exception 'Solo se pueden editar rutas pendientes';
  end if;

  if p_driver_id is null or p_co_driver_id is null then
    raise exception 'La ruta necesita dos choferes';
  end if;
  if p_driver_id = p_co_driver_id then
    raise exception 'Los dos choferes deben ser distintos';
  end if;
  if not is_active_driver(p_driver_id) or not is_active_driver(p_co_driver_id) then
    raise exception 'Los dos choferes deben ser conductores activos';
  end if;
  if not exists (select 1 from vehicles v where v.id = p_vehicle_id and v.is_active is true) then
    raise exception 'El vehículo no existe o está deshabilitado';
  end if;

  v_day := (r.route_date at time zone 'UTC')::date;
  perform pg_advisory_xact_lock(hashtext('routes:' || v_day::text));
  perform assert_route_slot_free(v_day, r.trip_number, p_driver_id, p_co_driver_id, p_vehicle_id, p_route_id);

  v_old := array_remove(array[r.driver_id, r.co_driver_id], null);
  v_new := array[p_driver_id, p_co_driver_id];

  update routes
  set driver_id = p_driver_id, co_driver_id = p_co_driver_id, vehicle_id = p_vehicle_id
  where id = p_route_id;

  foreach v_uid in array v_old loop
    if not (v_uid = any(v_new)) then
      perform notify_user(v_uid, 'route_unassigned',
        format('Ya no estás asignado a la ruta #%s', r.route_number),
        jsonb_build_object('route_id', r.id, 'route_number', r.route_number, 'route_date', v_day), null);
    elsif p_vehicle_id is distinct from r.vehicle_id then
      perform notify_user(v_uid, 'route_updated',
        format('Cambió el vehículo de la ruta #%s', r.route_number),
        jsonb_build_object('route_id', r.id, 'route_number', r.route_number, 'route_date', v_day), null);
    end if;
  end loop;

  foreach v_uid in array v_new loop
    if not (v_uid = any(v_old)) then
      perform notify_user(v_uid, 'route_assigned',
        format('Se te asignó la ruta #%s del %s (vuelta %s)', r.route_number, to_char(v_day, 'DD/MM/YYYY'), r.trip_number),
        jsonb_build_object('route_id', r.id, 'route_number', r.route_number, 'route_date', v_day), null);
    end if;
  end loop;
end;
$function$;

create or replace function public.move_route_date(p_route_id uuid, p_new_date date)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r routes%rowtype;
  v_old date;
begin
  if not is_admin() then
    raise exception 'No autorizado';
  end if;
  if p_new_date is null or p_new_date < app_today() then
    raise exception 'La nueva fecha no puede ser pasada';
  end if;

  select * into r from routes where id = p_route_id for update;
  if not found then
    raise exception 'La ruta no existe';
  end if;
  if r.state <> 'Pendiente' then
    raise exception 'Solo se puede cambiar la fecha de rutas pendientes';
  end if;

  v_old := (r.route_date at time zone 'UTC')::date;
  if v_old = p_new_date then
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext('routes:' || p_new_date::text));
  perform assert_route_slot_free(p_new_date, r.trip_number, r.driver_id, r.co_driver_id, r.vehicle_id, p_route_id);

  perform 1 from orders
  where id in (select order_id from stops where route_id = p_route_id and state <> 'Cancelada')
  order by id for update;

  if exists (
    select 1 from orders o
    join stops s on s.order_id = o.id
    where s.route_id = p_route_id and s.state <> 'Cancelada' and o.state <> 'Pendiente'
  ) then
    raise exception 'La ruta tiene pedidos que ya no están pendientes';
  end if;

  update orders
  set arrival_date = (p_new_date::timestamp at time zone 'UTC')
  where id in (select order_id from stops where route_id = p_route_id and state <> 'Cancelada');

  update routes set route_date = (p_new_date::timestamp at time zone 'UTC') where id = p_route_id;

  perform notify_route_drivers(
    p_route_id, 'route_updated',
    format('La ruta #%s se movió al %s', r.route_number, to_char(p_new_date, 'DD/MM/YYYY'))
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- Pedidos
-- ---------------------------------------------------------------------------
create or replace function public.cancel_order(p_order_id uuid, p_release boolean default false)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  o orders%rowtype;
begin
  if not is_admin() then
    raise exception 'No autorizado';
  end if;

  select * into o from orders where id = p_order_id for update;
  if not found then
    raise exception 'El pedido no existe';
  end if;
  if o.state = 'Cancelada' then
    return;
  end if;
  if o.state = 'Completada' then
    raise exception 'No se puede cancelar un pedido completado';
  end if;

  if exists (select 1 from stops where order_id = o.id and state <> 'Cancelada') then
    if not p_release then
      raise exception 'PEDIDO_EN_RUTA: el pedido está asignado a una ruta';
    end if;
    perform release_order_from_route(o.id);
  end if;

  update orders set state = 'Cancelada' where id = o.id;
end;
$function$;

create or replace function public.change_orders_date(p_order_ids uuid[], p_new_date date, p_release boolean default false, p_reactivate boolean default false)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_ids uuid[];
  o orders%rowtype;
begin
  if not is_admin() then
    raise exception 'No autorizado';
  end if;
  if p_new_date is null or p_new_date < app_today() then
    raise exception 'La nueva fecha no puede ser pasada';
  end if;

  select array_agg(distinct x) into v_ids from unnest(p_order_ids) as x;
  if v_ids is null then
    raise exception 'Seleccioná al menos un pedido';
  end if;
  if (select count(*) from orders where id = any(v_ids)) <> cardinality(v_ids) then
    raise exception 'Algún pedido no existe';
  end if;

  for o in select * from orders where id = any(v_ids) order by id for update loop
    if o.state = 'Completada' then
      raise exception 'Un pedido completado no se puede reprogramar';
    end if;

    if (o.arrival_date at time zone 'UTC')::date is distinct from p_new_date
       and exists (select 1 from stops where order_id = o.id and state <> 'Cancelada') then
      if not p_release then
        raise exception 'PEDIDO_EN_RUTA: el pedido está asignado a una ruta';
      end if;
      perform release_order_from_route(o.id);
    end if;

    update orders
    set arrival_date = (p_new_date::timestamp at time zone 'UTC'),
        state = case when p_reactivate and o.state = 'Cancelada' then 'Pendiente' else o.state end
    where id = o.id;
  end loop;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------
-- Estas funciones son internas: las llaman otras funciones SECURITY DEFINER (que corren como
-- su dueño), nunca la app. Como son SECURITY DEFINER y no validan rol, cualquiera con la
-- anon key podía, por ejemplo, crear notificaciones para cualquier usuario con notify_user
-- o bloquear pedidos con assert_orders_assignable. Se les saca el permiso de ejecución pública.
revoke execute on function public.notify_user(uuid, text, text, jsonb, text) from public, anon, authenticated;
revoke execute on function public.notify_route_drivers(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.assert_orders_assignable(uuid[], date, uuid) from public, anon, authenticated;
revoke execute on function public.assert_route_slot_free(date, smallint, uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.is_active_driver(uuid) from public, anon, authenticated;
