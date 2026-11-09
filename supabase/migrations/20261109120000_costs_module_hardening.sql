-- =====================================================================
-- Migración: ajustes al módulo de costos (20261109000000_add_costs_module)
--   1. Los conductores no pueden escribir tiempos reales ni estimaciones
--      de su ruta por la API (la política de UPDATE de routes les deja
--      cambiar cualquier columna).
--   2. anon no tiene acceso a las tablas, la vista ni las funciones nuevas
--      (los ALTER DEFAULT PRIVILEGES del esquema inicial se lo daban).
--   3. estimate_route_cost devuelve errores que el admin entiende: nombra
--      el vehículo o el empleado y dice qué cargar. El HINT identifica el
--      dato faltante para que la app lo traduzca.
--   4. start_route_by_driver: el conductor marca la salida del depósito
--      (started_at), así la duración real incluye el primer tramo.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Columnas protegidas de routes
--    Solo el admin (o una función SECURITY DEFINER, donde current_user es
--    el dueño de la función) puede cambiarlas. El trigger corre antes que
--    trg_set_route_timestamps (orden alfabético), así que no bloquea los
--    tiempos que completa ese trigger.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_route_cost_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon')
     AND NOT coalesce(public.is_admin(), false)
     AND (
       NEW.estimated_distance_km  IS DISTINCT FROM OLD.estimated_distance_km
       OR NEW.estimated_duration_min IS DISTINCT FROM OLD.estimated_duration_min
       OR NEW.started_at          IS DISTINCT FROM OLD.started_at
       OR NEW.finished_at         IS DISTINCT FROM OLD.finished_at
     ) THEN
    RAISE EXCEPTION 'No tenés permisos para modificar los tiempos ni la estimación de la ruta'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_route_cost_columns
BEFORE UPDATE ON public.routes
FOR EACH ROW
EXECUTE FUNCTION public.protect_route_cost_columns();

-- Función de trigger: no se invoca por la API
REVOKE ALL ON FUNCTION public.protect_route_cost_columns() FROM PUBLIC, anon;

-- ---------------------------------------------------------------------
-- 2. Sin acceso para anon
-- ---------------------------------------------------------------------
REVOKE ALL ON public.fuel_prices, public.salaries, public.route_costs, public.route_expenses
  FROM anon;
REVOKE ALL ON public.route_cost_summary FROM anon;

REVOKE EXECUTE ON FUNCTION public.cost_is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cost_is_route_participant(uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.estimate_route_cost(uuid, uuid, uuid, numeric, integer, date)
  FROM PUBLIC, anon;

-- ---------------------------------------------------------------------
-- 3. estimate_route_cost con mensajes claros
--    Misma firma: CREATE OR REPLACE conserva los permisos.
--    HINT: missing_km_per_liter | missing_fuel_price | missing_salary |
--          invalid_input | not_found
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.estimate_route_cost(
  p_vehicle_id      uuid,
  p_driver_id       uuid,
  p_co_driver_id    uuid,
  p_distance_km     numeric,
  p_duration_min    integer,
  p_on_date         date DEFAULT current_date
)
RETURNS TABLE (fuel_cost numeric, labor_cost numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patent        text;
  v_km_per_liter  numeric;
  v_fuel_price    numeric;
  v_driver_hourly numeric;
  v_co_hourly     numeric := 0;
  v_name          text;
  v_date_label    text := to_char(p_on_date, 'DD/MM/YYYY');
BEGIN
  -- Usuarios autenticados no-admin no pueden calcular (expone sueldos).
  -- service_role y conexiones directas a la base pasan.
  IF coalesce(auth.jwt() ->> 'role', '') = 'authenticated'
     AND NOT public.cost_is_admin() THEN
    RAISE EXCEPTION 'No tenés permisos para calcular costos' USING ERRCODE = '42501';
  END IF;

  IF p_distance_km IS NULL OR p_distance_km < 0
     OR p_duration_min IS NULL OR p_duration_min < 0 THEN
    RAISE EXCEPTION 'La distancia y la duración de la ruta tienen que ser números positivos'
      USING HINT = 'invalid_input';
  END IF;

  SELECT patent, km_per_liter INTO v_patent, v_km_per_liter
    FROM public.vehicles WHERE id = p_vehicle_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El vehículo de la ruta no existe' USING HINT = 'not_found';
  END IF;
  IF v_km_per_liter IS NULL THEN
    RAISE EXCEPTION 'El vehículo % no tiene cargado el rendimiento (km por litro). Cargalo en Transportes', v_patent
      USING HINT = 'missing_km_per_liter';
  END IF;

  SELECT price_per_liter INTO v_fuel_price
    FROM public.fuel_prices
   WHERE valid_from <= p_on_date
     AND (valid_to IS NULL OR valid_to >= p_on_date)
   ORDER BY valid_from DESC
   LIMIT 1;
  IF v_fuel_price IS NULL THEN
    RAISE EXCEPTION 'No hay precio de combustible vigente para el %. Cargalo en Costos › Combustible', v_date_label
      USING HINT = 'missing_fuel_price';
  END IF;

  SELECT monthly_salary * (1 + social_charges_pct / 100) / monthly_hours
    INTO v_driver_hourly
    FROM public.salaries
   WHERE profile_id = p_driver_id
     AND valid_from <= p_on_date
     AND (valid_to IS NULL OR valid_to >= p_on_date)
   ORDER BY valid_from DESC
   LIMIT 1;
  IF v_driver_hourly IS NULL THEN
    SELECT trim(first_name || ' ' || last_name) INTO v_name
      FROM public.profiles WHERE id = p_driver_id;
    RAISE EXCEPTION 'El conductor % no tiene sueldo vigente para el %. Cargalo en Costos › Sueldos',
      coalesce(nullif(v_name, ''), 'de la ruta'), v_date_label
      USING HINT = 'missing_salary';
  END IF;

  IF p_co_driver_id IS NOT NULL THEN
    SELECT monthly_salary * (1 + social_charges_pct / 100) / monthly_hours
      INTO v_co_hourly
      FROM public.salaries
     WHERE profile_id = p_co_driver_id
       AND valid_from <= p_on_date
       AND (valid_to IS NULL OR valid_to >= p_on_date)
     ORDER BY valid_from DESC
     LIMIT 1;
    IF v_co_hourly IS NULL THEN
      SELECT trim(first_name || ' ' || last_name) INTO v_name
        FROM public.profiles WHERE id = p_co_driver_id;
      RAISE EXCEPTION 'El acompañante % no tiene sueldo vigente para el %. Cargalo en Costos › Sueldos',
        coalesce(nullif(v_name, ''), 'de la ruta'), v_date_label
        USING HINT = 'missing_salary';
    END IF;
  END IF;

  RETURN QUERY
  SELECT round(p_distance_km / v_km_per_liter * v_fuel_price, 2),
         round((v_driver_hourly + v_co_hourly) * p_duration_min / 60.0, 2);
END;
$$;

-- ---------------------------------------------------------------------
-- 4. El conductor inicia la ruta al salir del depósito
--    Solo el día de la ruta (hora de Argentina) y si no tiene otra ruta
--    en curso. Marcar la primera parada sigue pasando la ruta a "En curso"
--    (set_stop_state) por si el conductor se olvida de iniciarla.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.start_route_by_driver(p_route_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r routes%rowtype;
  v_other smallint;
BEGIN
  SELECT * INTO r FROM routes WHERE id = p_route_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La ruta no existe';
  END IF;
  IF NOT (is_driver() AND auth.uid() IN (r.driver_id, r.co_driver_id)) THEN
    RAISE EXCEPTION 'No tenés permisos para iniciar esta ruta';
  END IF;
  IF r.state = 'En curso' THEN
    RETURN;
  END IF;
  IF r.state <> 'Pendiente' THEN
    RAISE EXCEPTION 'La ruta #% ya está %', r.route_number, lower(r.state);
  END IF;
  IF (r.route_date AT TIME ZONE 'UTC')::date
     <> (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date THEN
    RAISE EXCEPTION 'Solo podés iniciar la ruta el día que está programada';
  END IF;

  SELECT route_number INTO v_other
    FROM routes
   WHERE id <> r.id
     AND state = 'En curso'
     AND (driver_id IN (r.driver_id, r.co_driver_id)
          OR co_driver_id IN (r.driver_id, r.co_driver_id))
   LIMIT 1;
  IF v_other IS NOT NULL THEN
    RAISE EXCEPTION 'Primero finalizá la ruta #%, que sigue en curso', v_other;
  END IF;

  UPDATE routes SET state = 'En curso' WHERE id = r.id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.start_route_by_driver(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_route_by_driver(uuid) TO authenticated, service_role;

COMMIT;
