-- Estado "Asignada" para pedidos y funciones para editar y borrar rutas.
-- Requiere haber corrido antes 20261019000000_routes_rpcs.sql.
--
-- Estados de un pedido:
--   Pendiente  -> sin ruta
--   Asignada   -> tiene una parada viva en una ruta que no está cancelada
--   Completada / Cancelada
--
-- Toda función que mete o saca pedidos de una ruta mantiene ese estado.

-- ---------------------------------------------------------------------------
-- Estado nuevo
-- ---------------------------------------------------------------------------
alter table public.orders drop constraint if exists orders_state_check;
alter table public.orders
  add constraint orders_state_check
  check (state = any (array['Pendiente', 'Asignada', 'Completada', 'Cancelada']));

-- Los pedidos pendientes que ya están en una ruta pasan a "Asignada"
update public.orders o
set state = 'Asignada'
where o.state = 'Pendiente'
  and exists (
    select 1 from public.stops s
    join public.routes r on r.id = s.route_id
    where s.order_id = o.id and s.state <> 'Cancelada' and r.state <> 'Cancelada'
  );

-- ---------------------------------------------------------------------------
-- Funciones auxiliares
-- ---------------------------------------------------------------------------
create or replace function public.is_route_slot_free(p_date date, p_trip smallint, p_driver_id uuid, p_co_driver_id uuid, p_vehicle_id uuid, p_exclude_route_id uuid default null::uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select not exists (
    select 1 from routes r
    where r.state <> 'Cancelada'
      and (r.route_date at time zone 'UTC')::date = p_date
      and r.trip_number = p_trip
      and (p_exclude_route_id is null or r.id <> p_exclude_route_id)
      and (r.driver_id in (p_driver_id, p_co_driver_id)
           or r.co_driver_id in (p_driver_id, p_co_driver_id)
           or r.vehicle_id = p_vehicle_id)
  );
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

  -- "Asignada" se acepta: si está en otra ruta lo frena el chequeo de abajo
  if exists (
    select 1 from orders o
    where o.id = any(p_order_ids)
      and (o.state not in ('Pendiente', 'Asignada')
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

-- ---------------------------------------------------------------------------
-- Crear rutas
-- ---------------------------------------------------------------------------
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

  update orders set state = 'Asignada' where id = any(p_order_ids);

  perform notify_route_drivers(
    v_route_id, 'route_assigned',
    format('Se te asignó la ruta #%s del %s (vuelta %s)', v_route_number, to_char(p_route_date, 'DD/MM/YYYY'), p_trip_number)
  );

  return v_route_id;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Borrar rutas
-- ---------------------------------------------------------------------------
-- Borra una ruta que todavía no salió: sus pedidos vuelven a "Pendiente".
create or replace function public.delete_route(p_route_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r routes%rowtype;
begin
  if not is_admin() then
    raise exception 'No autorizado';
  end if;

  select * into r from routes where id = p_route_id for update;
  if not found then
    raise exception 'La ruta no existe';
  end if;
  if r.state <> 'Pendiente' then
    raise exception 'Solo se pueden borrar rutas pendientes (la ruta #% está %)', r.route_number, lower(r.state);
  end if;
  if exists (select 1 from stops where route_id = r.id and state = 'Completada') then
    raise exception 'La ruta #% ya tiene entregas hechas', r.route_number;
  end if;

  update orders set state = 'Pendiente'
  where state = 'Asignada'
    and id in (select order_id from stops where route_id = r.id and state <> 'Cancelada');

  -- Se avisa antes de borrar, porque la notificación lee la ruta
  perform notify_route_drivers(
    r.id, 'route_deleted',
    format('La ruta #%s del %s fue eliminada', r.route_number, to_char((r.route_date at time zone 'UTC')::date, 'DD/MM/YYYY'))
  );

  delete from stops where route_id = r.id;
  delete from routes where id = r.id;
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
  update orders set state = 'Pendiente' where id = p_order_id and state = 'Asignada';

  select count(*) into v_remaining from stops where route_id = r.id and state <> 'Cancelada';

  if v_remaining = 0 then
    -- Una ruta sin pedidos no tiene sentido: se borra
    perform delete_route(r.id);
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

  -- Las paradas no entregadas se cancelan y sus pedidos vuelven a "Pendiente" (sin ruta)
  update orders set state = 'Pendiente'
  where state = 'Asignada'
    and id in (select order_id from stops where route_id = r.id and state = 'Pendiente');
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

-- ---------------------------------------------------------------------------
-- Editar rutas
-- ---------------------------------------------------------------------------
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

  -- Sin pedidos, la ruta se borra
  if p_order_ids is null or coalesce(cardinality(p_order_ids), 0) = 0 then
    perform delete_route(p_route_id);
    return;
  end if;

  if (select count(distinct x) from unnest(p_order_ids) as x) <> cardinality(p_order_ids) then
    raise exception 'Hay pedidos repetidos';
  end if;

  v_day := (r.route_date at time zone 'UTC')::date;
  perform pg_advisory_xact_lock(hashtext('routes:' || v_day::text));
  perform assert_orders_assignable(p_order_ids, v_day, p_route_id);

  -- Los pedidos que salen de la ruta vuelven a "Pendiente"
  update orders set state = 'Pendiente'
  where state = 'Asignada'
    and id in (
      select order_id from stops
      where route_id = p_route_id and state <> 'Cancelada' and not (order_id = any(p_order_ids))
    );

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

  update orders set state = 'Asignada' where id = any(p_order_ids) and state = 'Pendiente';

  perform notify_route_drivers(
    p_route_id, 'route_updated',
    format('Se modificaron las paradas de la ruta #%s', r.route_number)
  );
end;
$function$;

-- Cambia fecha, choferes y vehículo de una ruta pendiente en una sola operación.
-- Si cambia la fecha, todos sus pedidos se mueven a la fecha nueva.
-- Si la vuelta actual está ocupada en la fecha nueva, usa la otra vuelta.
create or replace function public.edit_route(p_route_id uuid, p_new_date date, p_driver_id uuid, p_co_driver_id uuid, p_vehicle_id uuid)
 returns smallint
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r routes%rowtype;
  v_old_date date;
  v_trip smallint;
  v_date_changed boolean;
  v_vehicle_changed boolean;
  v_old uuid[];
  v_new uuid[];
  v_uid uuid;
  v_meta jsonb;
  v_changes text;
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

  if p_new_date is null or p_new_date < app_today() then
    raise exception 'La fecha de la ruta no puede ser pasada';
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

  v_old_date := (r.route_date at time zone 'UTC')::date;
  v_date_changed := v_old_date <> p_new_date;
  v_vehicle_changed := r.vehicle_id is distinct from p_vehicle_id;

  perform pg_advisory_xact_lock(hashtext('routes:' || p_new_date::text));

  -- Primero la vuelta actual; si está ocupada, la otra
  if is_route_slot_free(p_new_date, r.trip_number, p_driver_id, p_co_driver_id, p_vehicle_id, p_route_id) then
    v_trip := r.trip_number;
  elsif is_route_slot_free(p_new_date, (3 - r.trip_number)::smallint, p_driver_id, p_co_driver_id, p_vehicle_id, p_route_id) then
    v_trip := 3 - r.trip_number;
  else
    raise exception 'Los choferes o el vehículo ya tienen las dos vueltas ocupadas el %', to_char(p_new_date, 'DD/MM/YYYY');
  end if;

  if v_date_changed then
    perform 1 from orders
    where id in (select order_id from stops where route_id = p_route_id and state <> 'Cancelada')
    order by id for update;

    if exists (
      select 1 from orders o
      join stops s on s.order_id = o.id
      where s.route_id = p_route_id and s.state <> 'Cancelada' and o.state not in ('Pendiente', 'Asignada')
    ) then
      raise exception 'La ruta tiene pedidos que ya no están pendientes';
    end if;

    update orders
    set arrival_date = (p_new_date::timestamp at time zone 'UTC')
    where id in (select order_id from stops where route_id = p_route_id and state <> 'Cancelada');
  end if;

  update routes
  set route_date = (p_new_date::timestamp at time zone 'UTC'),
      trip_number = v_trip,
      driver_id = p_driver_id,
      co_driver_id = p_co_driver_id,
      vehicle_id = p_vehicle_id
  where id = p_route_id;

  -- Notificaciones
  v_meta := jsonb_build_object('route_id', r.id, 'route_number', r.route_number, 'route_date', p_new_date);
  v_old := array_remove(array[r.driver_id, r.co_driver_id], null);
  v_new := array[p_driver_id, p_co_driver_id];

  v_changes := concat_ws(', ',
    case when v_date_changed then format('pasó al %s', to_char(p_new_date, 'DD/MM/YYYY')) end,
    case when v_trip <> r.trip_number then format('ahora es la vuelta %s', v_trip) end,
    case when v_vehicle_changed then 'cambió el vehículo' end
  );

  foreach v_uid in array v_old loop
    if not (v_uid = any(v_new)) then
      perform notify_user(v_uid, 'route_unassigned',
        format('Ya no estás asignado a la ruta #%s', r.route_number), v_meta, null);
    elsif v_changes <> '' then
      perform notify_user(v_uid, 'route_updated',
        format('La ruta #%s %s', r.route_number, v_changes), v_meta, null);
    end if;
  end loop;

  foreach v_uid in array v_new loop
    if not (v_uid = any(v_old)) then
      perform notify_user(v_uid, 'route_assigned',
        format('Se te asignó la ruta #%s del %s (vuelta %s)', r.route_number, to_char(p_new_date, 'DD/MM/YYYY'), v_trip),
        v_meta, null);
    end if;
  end loop;

  return v_trip;
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
begin
  if not is_admin() then
    raise exception 'No autorizado';
  end if;

  select * into r from routes where id = p_route_id;
  if not found then
    raise exception 'La ruta no existe';
  end if;

  perform edit_route(p_route_id, p_new_date, r.driver_id, r.co_driver_id, r.vehicle_id);
end;
$function$;

-- ---------------------------------------------------------------------------
-- Pedidos
-- ---------------------------------------------------------------------------
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

    -- Se usa el estado actual de la fila (release_order_from_route ya lo pudo cambiar)
    update orders
    set arrival_date = (p_new_date::timestamp at time zone 'UTC'),
        state = case when p_reactivate and state = 'Cancelada' then 'Pendiente' else state end
    where id = o.id;
  end loop;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------
revoke execute on function public.is_route_slot_free(date, smallint, uuid, uuid, uuid, uuid) from public, anon, authenticated;
