-- =====================================================================
-- Migración: módulo de costos de rutas
--   - Precio de combustible y sueldos con vigencia (cierre automático)
--   - Estimación congelada por ruta + tiempos reales (estimado vs real)
--   - Gastos cargados por el conductor (peajes, estacionamiento, etc.)
--   - RLS: rol leído de app_metadata.role del JWT (valor 'admin')
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0. Helpers de seguridad
-- ---------------------------------------------------------------------
-- ¿El usuario autenticado tiene role = 'admin' en app_metadata?
CREATE OR REPLACE FUNCTION public.cost_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce((SELECT auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin';
$$;

-- ¿El usuario es conductor/acompañante de la ruta? (opcionalmente: solo si está en curso)
-- SECURITY DEFINER para no depender de las políticas RLS de routes.
CREATE OR REPLACE FUNCTION public.cost_is_route_participant(
  p_route_id uuid,
  p_only_in_progress boolean DEFAULT false
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.routes r
     WHERE r.id = p_route_id
       AND (r.driver_id = (SELECT auth.uid()) OR r.co_driver_id = (SELECT auth.uid()))
       AND (NOT p_only_in_progress OR r.state = 'En curso')
  );
$$;

-- ---------------------------------------------------------------------
-- 1. Rendimiento de cada vehículo (para pasar de $/litro a $/km)
-- ---------------------------------------------------------------------
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS km_per_liter numeric CHECK (km_per_liter > 0);

-- ---------------------------------------------------------------------
-- 2. Precio del combustible (global, con vigencia)
-- ---------------------------------------------------------------------
CREATE TABLE public.fuel_prices (
  id               uuid NOT NULL DEFAULT gen_random_uuid(),
  price_per_liter  numeric NOT NULL CHECK (price_per_liter > 0),
  valid_from       date NOT NULL DEFAULT current_date,
  valid_to         date,                              -- NULL = vigente
  created_at       timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT fuel_prices_pkey PRIMARY KEY (id),
  CONSTRAINT fuel_prices_dates_check CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

-- Una sola fila vigente a la vez
CREATE UNIQUE INDEX uq_fuel_prices_open
  ON public.fuel_prices ((true))
  WHERE valid_to IS NULL;

CREATE INDEX idx_fuel_prices_valid_from ON public.fuel_prices (valid_from);

-- ---------------------------------------------------------------------
-- 3. Sueldos (por empleado, con vigencia)
-- ---------------------------------------------------------------------
CREATE TABLE public.salaries (
  id                  uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id          uuid NOT NULL REFERENCES public.profiles(id),
  monthly_salary      numeric NOT NULL CHECK (monthly_salary >= 0),
  social_charges_pct  numeric NOT NULL DEFAULT 0 CHECK (social_charges_pct >= 0),  -- 30 = 30 %
  monthly_hours       numeric NOT NULL DEFAULT 176 CHECK (monthly_hours > 0),      -- horas pagas por mes
  valid_from          date NOT NULL DEFAULT current_date,
  valid_to            date,                                                        -- NULL = vigente
  created_at          timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT salaries_pkey PRIMARY KEY (id),
  CONSTRAINT salaries_dates_check CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

-- Un solo sueldo vigente por empleado
CREATE UNIQUE INDEX uq_salaries_open_per_profile
  ON public.salaries (profile_id)
  WHERE valid_to IS NULL;

CREATE INDEX idx_salaries_lookup ON public.salaries (profile_id, valid_from);

-- ---------------------------------------------------------------------
-- 4. Triggers: al insertar un valor nuevo, cierran el anterior
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.close_previous_fuel_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.fuel_prices
     SET valid_to = NEW.valid_from - 1          -- día anterior (vigencia inclusiva)
   WHERE valid_to IS NULL
     AND valid_from < NEW.valid_from;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_close_previous_fuel_price
BEFORE INSERT ON public.fuel_prices
FOR EACH ROW
EXECUTE FUNCTION public.close_previous_fuel_price();

CREATE OR REPLACE FUNCTION public.close_previous_salary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.salaries
     SET valid_to = NEW.valid_from - 1
   WHERE profile_id = NEW.profile_id
     AND valid_to IS NULL
     AND valid_from < NEW.valid_from;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_close_previous_salary
BEFORE INSERT ON public.salaries
FOR EACH ROW
EXECUTE FUNCTION public.close_previous_salary();

-- ---------------------------------------------------------------------
-- 5. Rutas: distancia/duración estimadas y tiempos reales
-- ---------------------------------------------------------------------
ALTER TABLE public.routes
  ADD COLUMN estimated_distance_km   numeric CHECK (estimated_distance_km >= 0),
  ADD COLUMN estimated_duration_min  integer CHECK (estimated_duration_min >= 0),
  ADD COLUMN started_at              timestamp with time zone,
  ADD COLUMN finished_at             timestamp with time zone;

-- Completa started_at / finished_at automáticamente al cambiar el estado
CREATE OR REPLACE FUNCTION public.set_route_timestamps()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.state = 'En curso'
     AND OLD.state IS DISTINCT FROM 'En curso'
     AND NEW.started_at IS NULL THEN
    NEW.started_at := now();
  END IF;

  IF NEW.state = 'Completada'
     AND OLD.state IS DISTINCT FROM 'Completada'
     AND NEW.finished_at IS NULL THEN
    NEW.finished_at := now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_route_timestamps
BEFORE UPDATE OF state ON public.routes
FOR EACH ROW
EXECUTE FUNCTION public.set_route_timestamps();

-- ---------------------------------------------------------------------
-- 6. Costos estimados por ruta (tabla aparte y solo admin)
--    Se separa de routes para que los conductores, que sí leen routes,
--    no puedan deducir sueldos a partir del costo laboral.
-- ---------------------------------------------------------------------
CREATE TABLE public.route_costs (
  route_id              uuid NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  estimated_fuel_cost   numeric NOT NULL CHECK (estimated_fuel_cost >= 0),
  estimated_labor_cost  numeric NOT NULL CHECK (estimated_labor_cost >= 0),
  created_at            timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT route_costs_pkey PRIMARY KEY (route_id)
);

-- ---------------------------------------------------------------------
-- 7. Gastos cargados por el conductor (peajes, estacionamiento, etc.)
-- ---------------------------------------------------------------------
CREATE TABLE public.route_expenses (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  route_id    uuid NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN ('toll', 'parking', 'fine', 'other')),
  amount      numeric NOT NULL CHECK (amount >= 0),
  notes       text,
  created_by  uuid NOT NULL REFERENCES public.profiles(id),
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT route_expenses_pkey PRIMARY KEY (id)
);

CREATE INDEX idx_route_expenses_route ON public.route_expenses (route_id);

-- ---------------------------------------------------------------------
-- 8. Función de estimación: usa precios y sueldos vigentes en la fecha
--    Uso: SELECT * FROM estimate_route_cost(vehicle, driver, co_driver, km, min);
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
  v_km_per_liter  numeric;
  v_fuel_price    numeric;
  v_driver_hourly numeric;
  v_co_hourly     numeric := 0;
BEGIN
  -- Usuarios autenticados no-admin no pueden calcular (expone sueldos).
  -- service_role y conexiones directas a la base pasan.
  IF coalesce(auth.jwt() ->> 'role', '') = 'authenticated'
     AND NOT public.cost_is_admin() THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  SELECT km_per_liter INTO v_km_per_liter
    FROM public.vehicles WHERE id = p_vehicle_id;
  IF v_km_per_liter IS NULL THEN
    RAISE EXCEPTION 'El vehículo % no tiene km_per_liter cargado', p_vehicle_id;
  END IF;

  SELECT price_per_liter INTO v_fuel_price
    FROM public.fuel_prices
   WHERE valid_from <= p_on_date
     AND (valid_to IS NULL OR valid_to >= p_on_date)
   ORDER BY valid_from DESC
   LIMIT 1;
  IF v_fuel_price IS NULL THEN
    RAISE EXCEPTION 'No hay precio de combustible vigente para %', p_on_date;
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
    RAISE EXCEPTION 'El conductor % no tiene sueldo vigente para %', p_driver_id, p_on_date;
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
      RAISE EXCEPTION 'El acompañante % no tiene sueldo vigente para %', p_co_driver_id, p_on_date;
    END IF;
  END IF;

  RETURN QUERY
  SELECT round(p_distance_km / v_km_per_liter * v_fuel_price, 2),
         round((v_driver_hourly + v_co_hourly) * p_duration_min / 60.0, 2);
END;
$$;

REVOKE ALL ON FUNCTION public.estimate_route_cost(uuid, uuid, uuid, numeric, integer, date)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.estimate_route_cost(uuid, uuid, uuid, numeric, integer, date)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 9. Vista de resumen: estimado vs real (solo admin)
-- ---------------------------------------------------------------------
CREATE VIEW public.route_cost_summary
WITH (security_invoker = true) AS
SELECT
  r.id                                   AS route_id,
  r.route_number,
  r.route_date,
  r.state,
  r.estimated_distance_km,
  r.estimated_duration_min,
  round(extract(epoch FROM (r.finished_at - r.started_at)) / 60)::integer
                                         AS actual_duration_min,
  round(extract(epoch FROM (r.finished_at - r.started_at)) / 60)::integer
    - r.estimated_duration_min           AS duration_variance_min,
  rc.estimated_fuel_cost,
  rc.estimated_labor_cost,
  coalesce(e.total_expenses, 0)          AS total_expenses,
  coalesce(rc.estimated_fuel_cost, 0)
    + coalesce(rc.estimated_labor_cost, 0)
    + coalesce(e.total_expenses, 0)      AS estimated_cost_plus_expenses
FROM public.routes r
LEFT JOIN public.route_costs rc ON rc.route_id = r.id
LEFT JOIN LATERAL (
  SELECT sum(x.amount) AS total_expenses
    FROM public.route_expenses x
   WHERE x.route_id = r.id
) e ON true
WHERE public.cost_is_admin();

-- ---------------------------------------------------------------------
-- 10. RLS
-- ---------------------------------------------------------------------
ALTER TABLE public.fuel_prices    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salaries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_costs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_expenses ENABLE ROW LEVEL SECURITY;

-- Solo admin: precios, sueldos y costos estimados
CREATE POLICY fuel_prices_admin_all ON public.fuel_prices
  FOR ALL TO authenticated
  USING (public.cost_is_admin())
  WITH CHECK (public.cost_is_admin());

CREATE POLICY salaries_admin_all ON public.salaries
  FOR ALL TO authenticated
  USING (public.cost_is_admin())
  WITH CHECK (public.cost_is_admin());

CREATE POLICY route_costs_admin_all ON public.route_costs
  FOR ALL TO authenticated
  USING (public.cost_is_admin())
  WITH CHECK (public.cost_is_admin());

-- Gastos: admin todo; conductor/acompañante ve los de sus rutas
-- y solo puede cargar mientras la ruta está "En curso"
CREATE POLICY route_expenses_admin_all ON public.route_expenses
  FOR ALL TO authenticated
  USING (public.cost_is_admin())
  WITH CHECK (public.cost_is_admin());

CREATE POLICY route_expenses_participant_select ON public.route_expenses
  FOR SELECT TO authenticated
  USING (public.cost_is_route_participant(route_id));

CREATE POLICY route_expenses_participant_insert ON public.route_expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND public.cost_is_route_participant(route_id, true)
  );

-- ---------------------------------------------------------------------
-- 11. GRANTs explícitos
--     Con la configuración actual de Supabase (auto_expose_new_tables sin
--     activar), las tablas, vistas y funciones nuevas NO son accesibles por
--     la API hasta que se otorguen permisos. RLS sigue filtrando las filas.
-- ---------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.fuel_prices, public.salaries, public.route_costs, public.route_expenses
  TO authenticated, service_role;

GRANT SELECT ON public.route_cost_summary TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.cost_is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cost_is_route_participant(uuid, boolean)
  TO authenticated, service_role;

COMMIT;

-- =====================================================================
-- Ejemplos de uso (NO se ejecutan en la migración)
-- =====================================================================
-- Nuevo precio de nafta (el trigger cierra el anterior):
--   INSERT INTO public.fuel_prices (price_per_liter, valid_from)
--   VALUES (1400, '2026-11-10');
--
-- Nuevo sueldo (el trigger cierra el anterior de ese empleado):
--   INSERT INTO public.salaries (profile_id, monthly_salary, social_charges_pct, valid_from)
--   VALUES ('<uuid-profile>', 1800000, 30, '2026-11-01');
--
-- Estimar el costo al generar una ruta (km y minutos vienen de la API de ruteo):
--   SELECT * FROM public.estimate_route_cost(
--     '<vehicle_id>', '<driver_id>', NULL, 42.5, 180);
--   -- luego guardar el resultado:
--   INSERT INTO public.route_costs (route_id, estimated_fuel_cost, estimated_labor_cost)
--   VALUES ('<route_id>', <fuel_cost>, <labor_cost>);
--
-- Estimado vs real:
--   SELECT * FROM public.route_cost_summary ORDER BY route_date DESC;