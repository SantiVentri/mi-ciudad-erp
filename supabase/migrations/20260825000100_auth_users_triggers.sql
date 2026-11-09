-- Triggers sobre auth.users que existían en la base pero no en ninguna migración.
--   - on_auth_user_created_check_invitation: rechaza el registro sin una invitación
--     válida para ese email y guarda el rol en app_metadata.role.
--   - on_auth_user_created_or_updated: crea y mantiene el perfil en public.profiles.
-- Las funciones están en 20260825000000_initial_schema. CREATE OR REPLACE: idempotente.

CREATE OR REPLACE TRIGGER "on_auth_user_created_check_invitation"
  BEFORE INSERT ON "auth"."users"
  FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user_invitation"();

CREATE OR REPLACE TRIGGER "on_auth_user_created_or_updated"
  AFTER INSERT OR UPDATE ON "auth"."users"
  FOR EACH ROW EXECUTE FUNCTION "public"."handle_auth_user_changes"();
