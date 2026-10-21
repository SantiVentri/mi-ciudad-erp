-- Alta de pedidos desde el panel de admin.
-- Crea el pedido y sus productos en una sola transacción: si algún producto falla,
-- no queda un pedido vacío.
--
-- p_items: [{ "product_id": "<uuid>", "quantity": <entero > 0> }, ...]
-- Si un producto viene repetido, se suman las cantidades.

create or replace function public.create_order(p_client_id uuid, p_arrival_date date, p_items jsonb)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_order_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_items jsonb := '{}'::jsonb;
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
    if not exists (select 1 from products where id = v_product_id) then
      raise exception 'Algún producto no existe';
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

  insert into order_details (order_id, product_id, quantity)
  select v_order_id, key::uuid, value::integer
  from jsonb_each_text(v_items);

  return v_order_id;
end;
$function$;

revoke execute on function public.create_order(uuid, date, jsonb) from anon;
