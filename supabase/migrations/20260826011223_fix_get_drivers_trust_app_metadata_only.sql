-- get_drivers: solo para admin y confiando únicamente en app_metadata.role.
-- La versión del esquema inicial no validaba el rol de quien llama y también
-- aceptaba user_metadata.role, que el propio usuario puede modificar.
-- (Este archivo estaba vacío; el cambio ya estaba aplicado en la base.)

CREATE OR REPLACE FUNCTION "public"."get_drivers"()
RETURNS TABLE("id" "uuid", "first_name" "text", "last_name" "text", "email" "text", "phone" "text", "avatar" "text", "is_active" boolean)
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
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
$$;

REVOKE ALL ON FUNCTION "public"."get_drivers"() FROM PUBLIC, anon;
GRANT ALL ON FUNCTION "public"."get_drivers"() TO authenticated, service_role;
