


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."get_drivers"() RETURNS TABLE("id" "uuid", "first_name" "text", "last_name" "text", "email" "text", "phone" "text", "avatar" "text", "is_active" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.first_name,
        p.last_name,
        p.email,
        p.phone,
        p.avatar,
        p.is_active
    FROM profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE u.raw_app_meta_data->>'role' = 'driver'
       OR u.raw_user_meta_data->>'role' = 'driver';
END;
$$;


ALTER FUNCTION "public"."get_drivers"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_auth_user_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- Si es un usuario nuevo (INSERT)
  if tg_op = 'INSERT' then
    insert into public.profiles (id, email, first_name, last_name, display_name)
    values (
      new.id,
      new.email,
      -- Usamos COALESCE para evitar errores si el dato viene nulo (ya que tus columnas son NOT NULL)
      coalesce(new.raw_user_meta_data->>'first_name', ''),
      coalesce(new.raw_user_meta_data->>'last_name', ''),
      coalesce(new.raw_user_meta_data->>'display_name', '')
    );
    
  -- Si el usuario fue modificado (UPDATE)
  elsif tg_op = 'UPDATE' then
    update public.profiles
    set
      email = new.email,
      -- Actualiza los nombres solo si vienen en los metadatos; si no, mantiene los que ya estaban
      first_name = coalesce(new.raw_user_meta_data->>'first_name', profiles.first_name),
      last_name = coalesce(new.raw_user_meta_data->>'last_name', profiles.last_name),
      display_name = coalesce(new.raw_user_meta_data->>'display_name', profiles.display_name)
    where id = new.id;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_auth_user_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user_invitation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
declare
  v_token text := new.raw_user_meta_data->>'invite_token';
  v_invitation public.invitations%rowtype;
begin
  if v_token is null then
    raise exception 'INVITATION_REQUIRED: se requiere una invitación válida para registrarte';
  end if;

  if v_token !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    raise exception 'INVITATION_INVALID: no hay una invitación válida para este email';
  end if;

  select * into v_invitation
  from public.invitations
  where id = v_token::uuid
    and lower(email) = lower(new.email)
    and used_at is null
    and expires_at > now()
  for update;

  if v_invitation.id is null then
    raise exception 'INVITATION_INVALID: no hay una invitación válida para este email';
  end if;

  new.raw_app_meta_data :=
    coalesce(new.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', v_invitation.role);

  update public.invitations
  set used_at = now()
  where id = v_invitation.id;

  return new;
end;
$_$;


ALTER FUNCTION "public"."handle_new_user_invitation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin';
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_driver"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select (auth.jwt() -> 'app_metadata' ->> 'role') = 'driver';
$$;


ALTER FUNCTION "public"."is_driver"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_self_reactivation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.uid() = old.id
     and not is_admin()
     and new.is_active is distinct from old.is_active
  then
    new.is_active := old.is_active;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."prevent_self_reactivation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_invitation"("p_token" "uuid") RETURNS TABLE("email" "text", "role" "text", "is_valid" boolean)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    i.email,
    i.role,
    (i.used_at is null and i.expires_at > now()) as is_valid
  from public.invitations i
  where i.id = p_token;
$$;


ALTER FUNCTION "public"."validate_invitation"("p_token" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "street" "text" NOT NULL,
    "number" "text" NOT NULL,
    "city" "text" NOT NULL,
    "province" "text" NOT NULL,
    "latitude" numeric,
    "longitude" numeric,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_active" boolean DEFAULT true,
    "observations" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "clients_is_active_check" CHECK (("is_active" = ANY (ARRAY[true, false])))
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" NOT NULL,
    "invited_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL,
    "used_at" timestamp with time zone
);


ALTER TABLE "public"."invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "message" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "seen" boolean DEFAULT false,
    "metadata" "jsonb",
    "href" "text",
    CONSTRAINT "alerts_seen_check" CHECK (("seen" = ANY (ARRAY[true, false])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_details" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "quantity" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."order_details" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "arrival_date" timestamp with time zone NOT NULL,
    "state" "text" DEFAULT 'Pendiente'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "description" "text"
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "avatar" "text" DEFAULT 'https://placehold.co/100/3454d1/ffffff?text=MC'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "display_name" "text" NOT NULL,
    "phone" "text",
    "is_active" boolean DEFAULT true,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."phone" IS '[SENSITIVE]';



CREATE TABLE IF NOT EXISTS "public"."routes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "driver_id" "uuid" NOT NULL,
    "vehicle_id" "uuid" NOT NULL,
    "route_date" timestamp with time zone NOT NULL,
    "state" "text" DEFAULT '''Pendiente''::text'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "route_number" smallint NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."routes" OWNER TO "postgres";


ALTER TABLE "public"."routes" ALTER COLUMN "route_number" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."routes_route_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."stops" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "route_id" "uuid" NOT NULL,
    "order_id" "uuid" NOT NULL,
    "visit_order" smallint NOT NULL,
    "state" "text" DEFAULT 'Pendiente'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."stops" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vehicles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "patent" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_active" boolean DEFAULT true,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "vehicles_is_active_check" CHECK (("is_active" = ANY (ARRAY[true, false])))
);


ALTER TABLE "public"."vehicles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_details"
    ADD CONSTRAINT "order_details_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."routes"
    ADD CONSTRAINT "routes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stops"
    ADD CONSTRAINT "stops_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vehicles"
    ADD CONSTRAINT "vehicles_patent_key" UNIQUE ("patent");



ALTER TABLE ONLY "public"."vehicles"
    ADD CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_invitations_email" ON "public"."invitations" USING "btree" ("email");



CREATE INDEX "idx_invitations_role" ON "public"."invitations" USING "btree" ("role");



CREATE INDEX "idx_order_details_order_id" ON "public"."order_details" USING "btree" ("order_id");



CREATE INDEX "idx_order_details_product_id" ON "public"."order_details" USING "btree" ("product_id");



CREATE INDEX "idx_orders_client_id" ON "public"."orders" USING "btree" ("client_id");



CREATE INDEX "idx_routes_driver_id" ON "public"."routes" USING "btree" ("driver_id");



CREATE INDEX "idx_routes_vehicle_id" ON "public"."routes" USING "btree" ("vehicle_id");



CREATE INDEX "idx_stops_order_id" ON "public"."stops" USING "btree" ("order_id");



CREATE INDEX "idx_stops_route_id" ON "public"."stops" USING "btree" ("route_id");



CREATE UNIQUE INDEX "invitations_pending_email_idx" ON "public"."invitations" USING "btree" ("lower"("email")) WHERE ("used_at" IS NULL);



CREATE OR REPLACE TRIGGER "trg_clients_updated_at" BEFORE UPDATE ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_orders_updated_at" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_prevent_self_reactivation" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_self_reactivation"();



CREATE OR REPLACE TRIGGER "trg_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_routes_updated_at" BEFORE UPDATE ON "public"."routes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_vehicles_updated_at" BEFORE UPDATE ON "public"."vehicles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."order_details"
    ADD CONSTRAINT "order_details_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_details"
    ADD CONSTRAINT "order_details_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."routes"
    ADD CONSTRAINT "routes_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."routes"
    ADD CONSTRAINT "routes_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stops"
    ADD CONSTRAINT "stops_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stops"
    ADD CONSTRAINT "stops_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can create invitations" ON "public"."invitations" FOR INSERT WITH CHECK (((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can delete clients" ON "public"."clients" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "Admins can delete invitations" ON "public"."invitations" FOR DELETE USING (((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can delete order_details" ON "public"."order_details" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "Admins can delete orders" ON "public"."orders" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "Admins can delete products" ON "public"."products" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "Admins can delete profiles" ON "public"."profiles" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "Admins can delete routes" ON "public"."routes" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "Admins can delete stops" ON "public"."stops" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "Admins can delete vehicles" ON "public"."vehicles" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "Admins can insert clients" ON "public"."clients" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can insert order_details" ON "public"."order_details" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can insert orders" ON "public"."orders" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can insert products" ON "public"."products" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can insert routes" ON "public"."routes" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can insert stops" ON "public"."stops" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can insert vehicles" ON "public"."vehicles" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can update all profiles" ON "public"."profiles" FOR UPDATE USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can update clients" ON "public"."clients" FOR UPDATE USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can update order_details" ON "public"."order_details" FOR UPDATE USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can update orders" ON "public"."orders" FOR UPDATE USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can update products" ON "public"."products" FOR UPDATE USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can update routes" ON "public"."routes" FOR UPDATE USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can update stops" ON "public"."stops" FOR UPDATE USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can update vehicles" ON "public"."vehicles" FOR UPDATE USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can view all clients" ON "public"."clients" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "Admins can view all order_details" ON "public"."order_details" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "Admins can view all orders" ON "public"."orders" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "Admins can view all profiles" ON "public"."profiles" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "Admins can view all routes" ON "public"."routes" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "Admins can view all stops" ON "public"."stops" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "Admins can view invitations" ON "public"."invitations" FOR SELECT USING (((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Authenticated users can view products" ON "public"."products" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can view vehicles" ON "public"."vehicles" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Drivers can update state of own route stops" ON "public"."stops" FOR UPDATE USING (("public"."is_driver"() AND (EXISTS ( SELECT 1
   FROM "public"."routes" "r"
  WHERE (("r"."id" = "stops"."route_id") AND ("r"."driver_id" = "auth"."uid"())))))) WITH CHECK (("public"."is_driver"() AND (EXISTS ( SELECT 1
   FROM "public"."routes" "r"
  WHERE (("r"."id" = "stops"."route_id") AND ("r"."driver_id" = "auth"."uid"()))))));



CREATE POLICY "Drivers can update state of own routes" ON "public"."routes" FOR UPDATE USING (("public"."is_driver"() AND ("driver_id" = "auth"."uid"()))) WITH CHECK (("public"."is_driver"() AND ("driver_id" = "auth"."uid"())));



CREATE POLICY "Drivers can view clients on their routes" ON "public"."clients" FOR SELECT USING (("public"."is_driver"() AND (EXISTS ( SELECT 1
   FROM (("public"."orders" "o"
     JOIN "public"."stops" "s" ON (("s"."order_id" = "o"."id")))
     JOIN "public"."routes" "r" ON (("r"."id" = "s"."route_id")))
  WHERE (("o"."client_id" = "clients"."id") AND ("r"."driver_id" = "auth"."uid"()))))));



CREATE POLICY "Drivers can view own route order_details" ON "public"."order_details" FOR SELECT USING (("public"."is_driver"() AND (EXISTS ( SELECT 1
   FROM ("public"."stops" "s"
     JOIN "public"."routes" "r" ON (("r"."id" = "s"."route_id")))
  WHERE (("s"."order_id" = "order_details"."order_id") AND ("r"."driver_id" = "auth"."uid"()))))));



CREATE POLICY "Drivers can view own route orders" ON "public"."orders" FOR SELECT USING (("public"."is_driver"() AND (EXISTS ( SELECT 1
   FROM ("public"."stops" "s"
     JOIN "public"."routes" "r" ON (("r"."id" = "s"."route_id")))
  WHERE (("s"."order_id" = "orders"."id") AND ("r"."driver_id" = "auth"."uid"()))))));



CREATE POLICY "Drivers can view own route stops" ON "public"."stops" FOR SELECT USING (("public"."is_driver"() AND (EXISTS ( SELECT 1
   FROM "public"."routes" "r"
  WHERE (("r"."id" = "stops"."route_id") AND ("r"."driver_id" = "auth"."uid"()))))));



CREATE POLICY "Drivers can view own routes" ON "public"."routes" FOR SELECT USING (("public"."is_driver"() AND ("driver_id" = "auth"."uid"())));



CREATE POLICY "Enable users to view their own data only" ON "public"."notifications" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("id" = "auth"."uid"()));



ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_details" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."routes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stops" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vehicles" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."get_drivers"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_drivers"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_drivers"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_auth_user_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_auth_user_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_auth_user_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user_invitation"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user_invitation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user_invitation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_driver"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_driver"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_driver"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_self_reactivation"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_self_reactivation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_self_reactivation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_invitation"("p_token" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_invitation"("p_token" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_invitation"("p_token" "uuid") TO "service_role";


















GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON TABLE "public"."invitations" TO "anon";
GRANT ALL ON TABLE "public"."invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."invitations" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."order_details" TO "anon";
GRANT ALL ON TABLE "public"."order_details" TO "authenticated";
GRANT ALL ON TABLE "public"."order_details" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."routes" TO "anon";
GRANT ALL ON TABLE "public"."routes" TO "authenticated";
GRANT ALL ON TABLE "public"."routes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."routes_route_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."routes_route_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."routes_route_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."stops" TO "anon";
GRANT ALL ON TABLE "public"."stops" TO "authenticated";
GRANT ALL ON TABLE "public"."stops" TO "service_role";



GRANT ALL ON TABLE "public"."vehicles" TO "anon";
GRANT ALL ON TABLE "public"."vehicles" TO "authenticated";
GRANT ALL ON TABLE "public"."vehicles" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































