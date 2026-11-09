-- Ajustes que estaban aplicados en la base pero no en ninguna migración.
--
-- 1. RPCs de rutas y pedidos: sin ejecución para PUBLIC ni anon. Los
--    ALTER DEFAULT PRIVILEGES del esquema inicial se la daban a anon. Las funciones
--    validan el rol adentro, pero no tienen por qué ser invocables sin sesión.
-- 2. state obligatorio en orders, routes y stops (todas tienen default 'Pendiente').

REVOKE ALL ON FUNCTION public.cancel_order(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_route(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.change_orders_date(uuid[], date, boolean, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_route_with_stops(uuid, uuid, uuid, date, smallint, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_routes_batch(date, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.move_route_date(uuid, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.release_order_from_route(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_route_stops(uuid, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_route_assignment(uuid, uuid, uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.cancel_order(uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_route(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.change_orders_date(uuid[], date, boolean, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_route_with_stops(uuid, uuid, uuid, date, smallint, uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_routes_batch(date, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.move_route_date(uuid, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.release_order_from_route(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_route_stops(uuid, uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_route_assignment(uuid, uuid, uuid, uuid) TO authenticated, service_role;

UPDATE public.orders SET state = 'Pendiente' WHERE state IS NULL;
UPDATE public.routes SET state = 'Pendiente' WHERE state IS NULL;
UPDATE public.stops  SET state = 'Pendiente' WHERE state IS NULL;

ALTER TABLE public.orders ALTER COLUMN state SET NOT NULL;
ALTER TABLE public.routes ALTER COLUMN state SET NOT NULL;
ALTER TABLE public.stops  ALTER COLUMN state SET NOT NULL;
