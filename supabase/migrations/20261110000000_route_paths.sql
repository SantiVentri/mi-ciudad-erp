-- =====================================================================
-- Migración: recorrido por calles guardado por ruta
--   El mapa de una ruta se dibuja con el camino por calles de OpenRouteService.
--   Se guarda la primera vez que se calcula, así el mapa sigue funcionando
--   aunque ORS no responda o se quede sin cupo.
--
--   points_key: huella (sha1) de depósito + paradas en orden + depósito. Si
--   cambian las paradas, su orden o la ubicación de un cliente, deja de
--   coincidir y la app vuelve a calcular el recorrido.
--   polyline:   recorrido comprimido (Google Encoded Polyline, precisión 5 ≈ 1 m).
-- =====================================================================

BEGIN;

CREATE TABLE public.route_paths (
  route_id    uuid NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  points_key  text NOT NULL,
  polyline    text NOT NULL,
  distance_m  numeric CHECK (distance_m >= 0),
  duration_s  numeric CHECK (duration_s >= 0),
  updated_at  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT route_paths_pkey PRIMARY KEY (route_id)
);

-- Lo leen el admin y el chofer o acompañante de la ruta (los mismos que ven su mapa)
ALTER TABLE public.route_paths ENABLE ROW LEVEL SECURITY;

CREATE POLICY route_paths_select ON public.route_paths
  FOR SELECT TO authenticated
  USING (public.is_admin() OR public.cost_is_route_participant(route_id));

-- Se escribe solo con esta función (mismo permiso que para leer)
CREATE OR REPLACE FUNCTION public.save_route_path(
  p_route_id    uuid,
  p_points_key  text,
  p_polyline    text,
  p_distance_m  numeric DEFAULT NULL,
  p_duration_s  numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (is_admin() OR cost_is_route_participant(p_route_id)) THEN
    RAISE EXCEPTION 'No tenés permisos para guardar el recorrido de esta ruta' USING ERRCODE = '42501';
  END IF;

  IF coalesce(p_points_key, '') = '' OR coalesce(p_polyline, '') = '' THEN
    RAISE EXCEPTION 'Recorrido inválido';
  END IF;

  INSERT INTO route_paths (route_id, points_key, polyline, distance_m, duration_s, updated_at)
  VALUES (p_route_id, p_points_key, p_polyline, p_distance_m, p_duration_s, now())
  ON CONFLICT (route_id) DO UPDATE
    SET points_key = excluded.points_key,
        polyline   = excluded.polyline,
        distance_m = excluded.distance_m,
        duration_s = excluded.duration_s,
        updated_at = now();
END;
$$;

-- Permisos: los ALTER DEFAULT PRIVILEGES del esquema inicial dan todo a anon y authenticated
REVOKE ALL ON public.route_paths FROM anon, authenticated;
GRANT SELECT ON public.route_paths TO authenticated;
GRANT ALL ON public.route_paths TO service_role;

REVOKE ALL ON FUNCTION public.save_route_path(uuid, text, text, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_route_path(uuid, text, text, numeric, numeric)
  TO authenticated, service_role;

COMMIT;
