-- =====================================================================
-- Migración: módulo de stock
--   - Productos: precio, stock, stock mínimo, habilitado y archivado
--   - Historial de precios (lo escribe un trigger, sin importar quién cambie el precio)
--   - Cada renglón de pedido congela el precio unitario del momento
--   - Registro de movimientos de stock (ingreso, egreso, ajuste, pedido, devolución)
--   - El stock se descuenta al crear el pedido, vuelve al cancelarlo y se
--     descuenta otra vez si se restaura (si no alcanza, no se restaura)
--   - Eliminar un producto usado en pedidos lo archiva: el historial queda intacto
--
-- products.stock solo cambia a través de apply_stock_movement: así cada cambio
-- queda en stock_movements y el número siempre coincide con el registro.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Productos
-- ---------------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN price        numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN stock        integer NOT NULL DEFAULT 0,
  ADD COLUMN min_stock    integer NOT NULL DEFAULT 0,
  ADD COLUMN is_active    boolean NOT NULL DEFAULT true,
  ADD COLUMN archived_at  timestamp with time zone,          -- NULL = no eliminado
  ADD COLUMN updated_at   timestamp with time zone NOT NULL DEFAULT now(),
  ADD CONSTRAINT products_price_check     CHECK (price >= 0),
  ADD CONSTRAINT products_stock_check     CHECK (stock >= 0),
  ADD CONSTRAINT products_min_stock_check CHECK (min_stock >= 0),
  ADD CONSTRAINT products_name_check      CHECK (char_length(btrim(name)) > 0),
  -- Un producto archivado nunca vuelve a aparecer en pedidos nuevos
  ADD CONSTRAINT products_archived_inactive_check CHECK (archived_at IS NULL OR NOT is_active);

-- Sin nombres repetidos entre los productos que siguen en uso
CREATE UNIQUE INDEX uq_products_name_live
  ON public.products (lower(btrim(name)))
  WHERE archived_at IS NULL;

CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Precios de referencia para los productos que ya existen, tomados de distribuidoras
-- de agua a domicilio en noviembre 2026 (bidón 20 L: $6.000–$9.100; 12 L: $5.300–$6.300;
-- sifón: $1.300–$1.800). El dispensador es una estimación: no se encontró referencia.
-- El stock arranca en 0: se carga desde /admin/stock con un ingreso o un ajuste por conteo.
UPDATE public.products SET price = 7500,  min_stock = 60 WHERE id = 'b517c6f8-30c8-40b0-aaf6-4772ec300313'; -- Bidón 20 Litros
UPDATE public.products SET price = 5600,  min_stock = 40 WHERE id = 'da563a7b-ebb5-4f8c-a18b-641b2eba221b'; -- Bidón 12 Litros
UPDATE public.products SET price = 1500,  min_stock = 40 WHERE id = '3b03ac70-0460-430c-baaa-0ff8a793e229'; -- Sifón de Soda 1.5L
UPDATE public.products SET price = 18000, min_stock = 5  WHERE id = 'cdba6af2-3587-4f02-9fc5-5f27fca445e2'; -- Dispensador de Mesa

-- stock solo lo cambian las funciones de esta migración (SECURITY DEFINER: ahí
-- current_user es el dueño). Por la API, ni siquiera el admin lo puede pisar.
CREATE OR REPLACE FUNCTION public.protect_product_stock()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' AND NEW.stock <> 0 THEN
      RAISE EXCEPTION 'El stock inicial se carga como un movimiento de stock'
        USING ERRCODE = '42501';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.stock IS DISTINCT FROM OLD.stock THEN
      RAISE EXCEPTION 'El stock solo se cambia con un movimiento (ingreso, egreso o ajuste)'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_product_stock
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.protect_product_stock();

-- ---------------------------------------------------------------------
-- 2. Historial de precios
-- ---------------------------------------------------------------------
CREATE TABLE public.product_prices (
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id      uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  price           numeric(12, 2) NOT NULL CHECK (price >= 0),
  previous_price  numeric(12, 2) CHECK (previous_price >= 0),  -- NULL = precio inicial
  created_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT product_prices_pkey PRIMARY KEY (id)
);

CREATE INDEX idx_product_prices_product ON public.product_prices (product_id, created_at DESC);
CREATE INDEX idx_product_prices_created ON public.product_prices (created_at DESC);

-- Precio inicial de los productos que ya existen
INSERT INTO public.product_prices (product_id, price, created_at)
SELECT id, price, now() FROM public.products;

-- Cualquier alta o cambio de precio queda registrado, venga de donde venga
CREATE OR REPLACE FUNCTION public.log_product_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO product_prices (product_id, price, previous_price, created_by, created_at)
    VALUES (NEW.id, NEW.price, NULL, auth.uid(), NEW.created_at);
  ELSIF NEW.price IS DISTINCT FROM OLD.price THEN
    INSERT INTO product_prices (product_id, price, previous_price, created_by)
    VALUES (NEW.id, NEW.price, OLD.price, auth.uid());
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_product_price
AFTER INSERT OR UPDATE OF price ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.log_product_price();

-- ---------------------------------------------------------------------
-- 3. Pedidos: precio unitario congelado y productos que no se borran en cascada
-- ---------------------------------------------------------------------
-- NULL en los renglones anteriores a este módulo (no se sabe a cuánto se vendieron)
ALTER TABLE public.order_details
  ADD COLUMN unit_price numeric(12, 2) CHECK (unit_price >= 0);

CREATE OR REPLACE FUNCTION public.set_order_detail_unit_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.unit_price IS NULL THEN
    SELECT price INTO NEW.unit_price FROM products WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_order_detail_unit_price
BEFORE INSERT ON public.order_details
FOR EACH ROW
EXECUTE FUNCTION public.set_order_detail_unit_price();

-- Antes: borrar un producto borraba sus renglones en todos los pedidos
ALTER TABLE public.order_details DROP CONSTRAINT order_details_product_id_fkey;
ALTER TABLE public.order_details
  ADD CONSTRAINT order_details_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;

-- ---------------------------------------------------------------------
-- 4. Movimientos de stock
-- ---------------------------------------------------------------------
CREATE TABLE public.stock_movements (
  id           uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id   uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  type         text NOT NULL CHECK (type IN ('ingreso', 'egreso', 'ajuste', 'pedido', 'devolucion')),
  quantity     integer NOT NULL CHECK (quantity <> 0),   -- con signo: + entra, − sale
  stock_after  integer NOT NULL CHECK (stock_after >= 0),
  reason       text CHECK (char_length(reason) <= 300),
  order_id     uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  created_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT stock_movements_pkey PRIMARY KEY (id)
);

CREATE INDEX idx_stock_movements_product ON public.stock_movements (product_id, created_at DESC);
CREATE INDEX idx_stock_movements_created ON public.stock_movements (created_at DESC);
CREATE INDEX idx_stock_movements_order ON public.stock_movements (order_id) WHERE order_id IS NOT NULL;

-- Único punto que cambia products.stock. Bloquea la fila del producto, así dos
-- pedidos simultáneos no pueden llevarse la misma unidad.
CREATE OR REPLACE FUNCTION public.apply_stock_movement(
  p_product_id  uuid,
  p_delta       integer,
  p_type        text,
  p_reason      text DEFAULT NULL,
  p_order_id    uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name   text;
  v_stock  integer;
  v_new    integer;
BEGIN
  SELECT name, stock INTO v_name, v_stock FROM products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El producto no existe';
  END IF;

  IF p_delta IS NULL OR p_delta = 0 THEN
    RETURN v_stock;
  END IF;

  v_new := v_stock + p_delta;
  IF v_new < 0 THEN
    RAISE EXCEPTION 'No hay stock suficiente de %: hay % y se necesitan %', v_name, v_stock, -p_delta
      USING HINT = 'insufficient_stock';
  END IF;

  UPDATE products SET stock = v_new WHERE id = p_product_id;

  INSERT INTO stock_movements (product_id, type, quantity, stock_after, reason, order_id, created_by)
  VALUES (p_product_id, p_type, p_delta, v_new, nullif(btrim(p_reason), ''), p_order_id, auth.uid());

  RETURN v_new;
END;
$$;

-- ---------------------------------------------------------------------
-- 5. Funciones para el admin
-- ---------------------------------------------------------------------
-- Ingreso (suma), egreso (resta) o ajuste por conteo (p_quantity = lo que hay en realidad).
-- Devuelve el stock resultante.
CREATE OR REPLACE FUNCTION public.adjust_product_stock(
  p_product_id  uuid,
  p_type        text,
  p_quantity    integer,
  p_reason      text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p        products%rowtype;
  v_reason text := nullif(btrim(p_reason), '');
  v_delta  integer;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'No tenés permisos para mover stock' USING ERRCODE = '42501';
  END IF;

  IF p_type IS NULL OR p_type NOT IN ('ingreso', 'egreso', 'ajuste') THEN
    RAISE EXCEPTION 'Tipo de movimiento inválido';
  END IF;
  IF p_quantity IS NULL OR p_quantity < 0 OR (p_type <> 'ajuste' AND p_quantity = 0) THEN
    RAISE EXCEPTION 'La cantidad tiene que ser un número entero mayor a cero';
  END IF;
  IF p_type IN ('egreso', 'ajuste') AND v_reason IS NULL THEN
    RAISE EXCEPTION 'Contá el motivo del % (rotura, pérdida, conteo, etc.)',
      CASE p_type WHEN 'egreso' THEN 'egreso' ELSE 'ajuste' END;
  END IF;
  IF char_length(v_reason) > 300 THEN
    RAISE EXCEPTION 'El motivo puede tener hasta 300 caracteres';
  END IF;

  SELECT * INTO p FROM products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND OR p.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'El producto no existe o fue eliminado';
  END IF;

  v_delta := CASE p_type
    WHEN 'ingreso' THEN p_quantity
    WHEN 'egreso'  THEN -p_quantity
    ELSE p_quantity - p.stock
  END;

  IF v_delta = 0 THEN
    RAISE EXCEPTION 'El stock de % ya es %: no hay nada que ajustar', p.name, p.stock;
  END IF;

  RETURN apply_stock_movement(p_product_id, v_delta, p_type, v_reason, NULL);
END;
$$;

-- Alta de producto con su stock inicial, todo en una transacción
CREATE OR REPLACE FUNCTION public.create_product(
  p_name           text,
  p_description    text,
  p_price          numeric,
  p_min_stock      integer,
  p_initial_stock  integer DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'No tenés permisos para crear productos' USING ERRCODE = '42501';
  END IF;

  IF p_initial_stock IS NULL OR p_initial_stock < 0 THEN
    RAISE EXCEPTION 'El stock inicial no puede ser negativo';
  END IF;

  INSERT INTO products (name, description, price, min_stock, is_active)
  VALUES (btrim(p_name), nullif(btrim(p_description), ''), p_price, coalesce(p_min_stock, 0), true)
  RETURNING id INTO v_id;

  IF p_initial_stock > 0 THEN
    PERFORM apply_stock_movement(v_id, p_initial_stock, 'ingreso', 'Stock inicial', NULL);
  END IF;

  RETURN v_id;
END;
$$;

-- Si el producto aparece en algún pedido se archiva (sale del listado y de los
-- pedidos nuevos, pero el historial queda). Si nunca se usó, se borra de verdad.
-- Devuelve 'archived' o 'deleted'.
CREATE OR REPLACE FUNCTION public.delete_product(p_product_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'No tenés permisos para eliminar productos' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM products WHERE id = p_product_id AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El producto no existe o ya fue eliminado';
  END IF;

  IF EXISTS (SELECT 1 FROM order_details WHERE product_id = p_product_id) THEN
    UPDATE products SET archived_at = now(), is_active = false WHERE id = p_product_id;
    RETURN 'archived';
  END IF;

  DELETE FROM products WHERE id = p_product_id;
  RETURN 'deleted';
END;
$$;

-- ---------------------------------------------------------------------
-- 6. Pedidos: el stock se descuenta al crear y vuelve al cancelar
-- ---------------------------------------------------------------------
-- Misma firma que 20261022000000_create_order.sql: CREATE OR REPLACE conserva los permisos.
-- Nuevo: rechaza productos deshabilitados o eliminados y descuenta el stock.
-- Si algún producto no alcanza, no se crea nada.
CREATE OR REPLACE FUNCTION public.create_order(p_client_id uuid, p_arrival_date date, p_items jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_order_id uuid;
  v_item jsonb;
  v_product products%rowtype;
  v_product_id uuid;
  v_quantity integer;
  v_items jsonb := '{}'::jsonb;
  v_line record;
begin
  if not is_admin() then
    raise exception 'No autorizado';
  end if;

  if not exists (select 1 from clients where id = p_client_id and coalesce(is_active, true)) then
    raise exception 'El cliente no existe o está deshabilitado';
  end if;

  if p_arrival_date is null or p_arrival_date < app_today() then
    raise exception 'La fecha del pedido no puede ser pasada';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Agregá al menos un producto';
  end if;

  -- Valida y agrupa por producto
  for v_item in select * from jsonb_array_elements(p_items) loop
    begin
      v_product_id := (v_item ->> 'product_id')::uuid;
      v_quantity := (v_item ->> 'quantity')::integer;
    exception when others then
      raise exception 'Producto o cantidad inválidos';
    end;

    if v_product_id is null or v_quantity is null or v_quantity <= 0 then
      raise exception 'Cada producto necesita una cantidad mayor a cero';
    end if;

    select * into v_product from products where id = v_product_id;
    if not found or v_product.archived_at is not null then
      raise exception 'Algún producto no existe';
    end if;
    if not v_product.is_active then
      raise exception '% está deshabilitado: no se puede pedir', v_product.name;
    end if;

    v_items := jsonb_set(
      v_items,
      array[v_product_id::text],
      to_jsonb(coalesce((v_items ->> v_product_id::text)::integer, 0) + v_quantity)
    );
  end loop;

  insert into orders (client_id, arrival_date, state)
  values (p_client_id, (p_arrival_date::timestamp at time zone 'UTC'), 'Pendiente')
  returning id into v_order_id;

  -- unit_price lo completa trg_set_order_detail_unit_price con el precio actual
  insert into order_details (order_id, product_id, quantity)
  select v_order_id, key::uuid, value::integer
  from jsonb_each_text(v_items);

  -- En orden de id: dos pedidos simultáneos bloquean los productos en el mismo orden
  for v_line in
    select key::uuid as product_id, value::integer as quantity
    from jsonb_each_text(v_items)
    order by key
  loop
    perform apply_stock_movement(v_line.product_id, -v_line.quantity, 'pedido', null, v_order_id);
  end loop;

  return v_order_id;
end;
$function$;

-- Al cancelar se devuelve lo que el pedido tiene descontado según el registro
-- (los pedidos anteriores a este módulo no descontaron nada, así que no devuelven).
-- Al salir de "Cancelada" (restaurar o reprogramar) se vuelve a descontar: si no
-- alcanza, apply_stock_movement corta y el pedido sigue cancelado.
CREATE OR REPLACE FUNCTION public.sync_order_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line record;
BEGIN
  IF NEW.state = 'Cancelada' AND OLD.state IS DISTINCT FROM 'Cancelada' THEN
    FOR v_line IN
      SELECT product_id, -sum(quantity)::integer AS taken
        FROM stock_movements
       WHERE order_id = NEW.id
       GROUP BY product_id
      HAVING sum(quantity) < 0
       ORDER BY product_id
    LOOP
      PERFORM apply_stock_movement(v_line.product_id, v_line.taken, 'devolucion', 'Pedido cancelado', NEW.id);
    END LOOP;
  ELSIF OLD.state = 'Cancelada' AND NEW.state IS DISTINCT FROM 'Cancelada' THEN
    FOR v_line IN
      SELECT product_id, sum(quantity)::integer AS quantity
        FROM order_details
       WHERE order_id = NEW.id
       GROUP BY product_id
       ORDER BY product_id
    LOOP
      PERFORM apply_stock_movement(v_line.product_id, -v_line.quantity, 'pedido', 'Pedido restaurado', NEW.id);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_order_stock
AFTER UPDATE OF state ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_order_stock();

-- ---------------------------------------------------------------------
-- 7. Demanda por producto (para la pantalla de stock)
--    committed_units: en pedidos por entregar (ya descontados del stock)
--    units_last_30d:  pedidas para entregar en los últimos 30 días, sin canceladas
--    has_orders:      aparece en algún pedido (eliminarlo lo archiva)
-- ---------------------------------------------------------------------
CREATE VIEW public.product_order_stats
WITH (security_invoker = true) AS
SELECT
  p.id AS product_id,
  coalesce(sum(od.quantity) FILTER (WHERE o.state IN ('Pendiente', 'Asignada')), 0)::integer
    AS committed_units,
  coalesce(sum(od.quantity) FILTER (
    WHERE o.state <> 'Cancelada'
      AND o.arrival_date >= (app_today() - 30)::timestamp AT TIME ZONE 'UTC'
      AND o.arrival_date <  app_today()::timestamp AT TIME ZONE 'UTC'
  ), 0)::integer AS units_last_30d,
  count(od.id) > 0 AS has_orders
FROM public.products p
LEFT JOIN public.order_details od ON od.product_id = p.id
LEFT JOIN public.orders o ON o.id = od.order_id
WHERE public.is_admin()
GROUP BY p.id;

-- ---------------------------------------------------------------------
-- 8. RLS: historial de precios y movimientos, solo lectura para el admin.
--    Se escriben únicamente desde las funciones de arriba.
-- ---------------------------------------------------------------------
ALTER TABLE public.product_prices  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_prices_admin_select ON public.product_prices
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY stock_movements_admin_select ON public.stock_movements
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ---------------------------------------------------------------------
-- 9. Permisos
--    Los ALTER DEFAULT PRIVILEGES del esquema inicial dan todo a anon y
--    authenticated: se recorta a lo justo.
-- ---------------------------------------------------------------------
REVOKE ALL ON public.product_prices, public.stock_movements, public.product_order_stats
  FROM anon, authenticated;
GRANT SELECT ON public.product_prices, public.stock_movements, public.product_order_stats
  TO authenticated;
GRANT ALL ON public.product_prices, public.stock_movements TO service_role;
GRANT SELECT ON public.product_order_stats TO service_role;

-- Internas: triggers y el único punto que escribe el stock
REVOKE ALL ON FUNCTION public.protect_product_stock() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_product_price() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_order_detail_unit_price() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_order_stock() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_stock_movement(uuid, integer, text, text, uuid)
  FROM PUBLIC, anon, authenticated;

-- Para el admin (cada una valida is_admin() adentro)
REVOKE ALL ON FUNCTION public.adjust_product_stock(uuid, text, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_product(text, text, numeric, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_product(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adjust_product_stock(uuid, text, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_product(text, text, numeric, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_product(uuid) TO authenticated, service_role;

COMMIT;
