-- El conductor marca sus paradas (Completada / Entrega fallida) y finaliza su ruta.
-- Requiere haber corrido antes 20261020000000_routes_edit_and_assigned_state.sql.
--
-- Parada "Entrega fallida": queda como historial en la ruta, pero ya no cuenta como
-- parada viva del pedido. El pedido vuelve a "Pendiente" (sin ruta) para que el admin
-- lo reprograme o lo meta en otra ruta. Por eso, todas las funciones que deciden si un
-- pedido "está en una ruta" ahora ignoran las paradas canceladas y las fallidas.

-- ---------------------------------------------------------------------------
-- Estado nuevo de paradas
-- ---------------------------------------------------------------------------
alter table public.stops drop constraint if exists stops_state_check;
alter table public.stops
  add constraint stops_state_check
  check (state = any (array['Pendiente', 'Completada', 'Entrega fallida', 'Cancelada']));

-- Un pedido solo puede tener una parada viva (las fallidas ya no cuentan)
drop index if exists public.stops_one_live_per_order_uq;
create unique index stops_one_live_per_order_uq
  on public.stops (order_id)
  where state not in ('Cancelada', 'Entrega fallida');

-- ---------------------------------------------------------------------------
-- Funciones del conductor
-- ---------------------------------------------------------------------------
-- Marca una parada y sincroniza el pedido:
--   Completada      -> pedido Completada
--   Pendiente       -> pedido Asignada (sigue en la ruta)
--   Entrega fallida -> pedido Pendiente (sale de la ruta)
-- La primera parada marcada pasa la ruta a "En curso".
create or replace function public.set_stop_state(p_stop_id uuid, p_state text)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  s stops%rowtype;
  r routes%rowtype;
  o orders%rowtype;
begin
  if p_state is null or p_state not in ('Pendiente', 'Completada', 'Entrega fallida') then
    raise exception 'Estado de parada inválido';
  end if;

  select * into s from stops where id = p_stop_id for update;
  if not found then
    raise exception 'La parada no existe';
  end if;

  select * into r from routes where id = s.route_id for update;
  if not (is_driver() and auth.uid() in (r.driver_id, r.co_driver_id)) then
    raise exception 'No tenés permisos para actualizar esta parada';
  end if;
  if r.state not in ('Pendiente', 'En curso') then
    raise exception 'La ruta #% ya está %', r.route_number, lower(r.state);
  end if;
  if s.state = 'Cancelada' then
    raise exception 'Esta parada fue quitada de la ruta';
  end if;
  if s.state = p_state then
    return p_state;
  end if;

  select * into o from orders where id = s.order_id for update;
  if o.state = 'Cancelada' then
    raise exception 'El pedido fue cancelado';
  end if;

  -- Reactivar una entrega fallida: el pedido no puede haber pasado a otra ruta u otro día
  if s.state = 'Entrega fallida' then
    if exists (
      select 1 from stops
      where order_id = o.id and id <> s.id and state not in ('Cancelada', 'Entrega fallida')
    ) then
      raise exception 'El pedido ya fue asignado a otra ruta';
    end if;
    if (o.arrival_date at time zone 'UTC')::date <> (r.route_date at time zone 'UTC')::date then
      raise exception 'El pedido fue reprogramado para otro día';
    end if;
  end if;

  update stops set state = p_state where id = s.id;

  update orders
  set state = case p_state
    when 'Completada' then 'Completada'
    when 'Pendiente' then 'Asignada'
    else 'Pendiente'
  end
  where id = o.id;

  if r.state = 'Pendiente' then
    update routes set state = 'En curso' where id = r.id;
  end if;

  return p_state;
end;
$function$;

-- Finaliza la ruta cuando no le quedan paradas pendientes
create or replace function public.complete_route_by_driver(p_route_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r routes%rowtype;
begin
  select * into r from routes where id = p_route_id for update;
  if not found then
    raise exception 'La ruta no existe';
  end if;
  if not (is_driver() and auth.uid() in (r.driver_id, r.co_driver_id)) then
    raise exception 'No tenés permisos para finalizar esta ruta';
  end if;
  if r.state not in ('Pendiente', 'En curso') then
    raise exception 'La ruta #% ya está %', r.route_number, lower(r.state);
  end if;
  if exists (select 1 from stops where route_id = r.id and state = 'Pendiente') then
    raise exception 'Todavía hay paradas pendientes';
  end if;

  update routes set state = 'Completada' where id = r.id;
end;
$function$;

revoke execute on function public.set_stop_state(uuid, text) from anon;
revoke execute on function public.complete_route_by_driver(uuid) from anon;

-- ---------------------------------------------------------------------------
-- Funciones de rutas y pedidos: las paradas fallidas ya no cuentan como vivas
-- ---------------------------------------------------------------------------
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
      and s.state not in ('Cancelada', 'Entrega fallida')
      and (p_route_id is null or s.route_id <> p_route_id)
  ) then
    raise exception 'Algún pedido ya está en otra ruta';
  end if;
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
  where order_id = p_order_id and state not in ('Cancelada', 'Entrega fallida')
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

  select count(*) into v_remaining from stops where route_id = r.id and state not in ('Cancelada', 'Entrega fallida');

  if v_remaining = 0 then
    -- Una ruta sin pedidos no tiene sentido: se borra
    perform delete_route(r.id);
  else
    update stops s set visit_order = x.n
    from (
      select id, row_number() over (order by visit_order) as n
      from stops where route_id = r.id and state not in ('Cancelada', 'Entrega fallida')
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
    and id in (select order_id from stops where route_id = r.id and state not in ('Cancelada', 'Entrega fallida'));

  -- Se avisa antes de borrar, porque la notificación lee la ruta
  perform notify_route_drivers(
    r.id, 'route_deleted',
    format('La ruta #%s del %s fue eliminada', r.route_number, to_char((r.route_date at time zone 'UTC')::date, 'DD/MM/YYYY'))
  );

  delete from stops where route_id = r.id;
  delete from routes where id = r.id;
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
      where route_id = p_route_id and state not in ('Cancelada', 'Entrega fallida') and not (order_id = any(p_order_ids))
    );

  delete from stops
  where route_id = p_route_id and state not in ('Cancelada', 'Entrega fallida') and not (order_id = any(p_order_ids));

  update stops s set visit_order = t.ord
  from unnest(p_order_ids) with ordinality as t(order_id, ord)
  where s.route_id = p_route_id and s.state not in ('Cancelada', 'Entrega fallida') and s.order_id = t.order_id;

  insert into stops (route_id, order_id, visit_order, state)
  select p_route_id, t.order_id, t.ord, 'Pendiente'
  from unnest(p_order_ids) with ordinality as t(order_id, ord)
  where not exists (
    select 1 from stops s
    where s.route_id = p_route_id and s.state not in ('Cancelada', 'Entrega fallida') and s.order_id = t.order_id
  );

  update orders set state = 'Asignada' where id = any(p_order_ids) and state = 'Pendiente';

  perform notify_route_drivers(
    p_route_id, 'route_updated',
    format('Se modificaron las paradas de la ruta #%s', r.route_number)
  );
end;
$function$;

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
    where id in (select order_id from stops where route_id = p_route_id and state not in ('Cancelada', 'Entrega fallida'))
    order by id for update;

    if exists (
      select 1 from orders o
      join stops s on s.order_id = o.id
      where s.route_id = p_route_id and s.state not in ('Cancelada', 'Entrega fallida') and o.state not in ('Pendiente', 'Asignada')
    ) then
      raise exception 'La ruta tiene pedidos que ya no están pendientes';
    end if;

    update orders
    set arrival_date = (p_new_date::timestamp at time zone 'UTC')
    where id in (select order_id from stops where route_id = p_route_id and state not in ('Cancelada', 'Entrega fallida'));
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

  if exists (select 1 from stops where order_id = o.id and state not in ('Cancelada', 'Entrega fallida')) then
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
       and exists (select 1 from stops where order_id = o.id and state not in ('Cancelada', 'Entrega fallida')) then
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
