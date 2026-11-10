-- =====================================================================
-- Arranque de una base nueva (producción) con el esquema de la v1.0.
-- Se corre una sola vez, a mano, en el SQL Editor de Supabase.
-- NO es el seed: no carga datos ficticios.
--
--   1. Invitación para el primer admin. Nadie se puede registrar sin una
--      invitación válida (trigger on_auth_user_created_check_invitation), así
--      que la primera hay que crearla acá. La consulta devuelve el id: el admin
--      se registra entrando a  <URL de la app>/invite/<id>  con este mismo email.
--      Vence en 7 días; si vence, volvé a correr solo el paso 1.
--   2. Los productos. En la v1.0 no hay pantalla para crearlos. Mismos ids que
--      en desarrollo.
--
-- Idempotente: si la invitación pendiente o los productos ya existen, no duplica.
-- =====================================================================

BEGIN;

-- 1. Primer admin --------------------------------------------------------
INSERT INTO public.invitations (email, role, expires_at)
SELECT 'santino.ventrice@gmail.com', 'admin', now() + interval '7 days'
WHERE NOT EXISTS (
  SELECT 1 FROM public.invitations
   WHERE lower(email) = lower('santino.ventrice@gmail.com')
     AND used_at IS NULL
);

-- 2. Productos -----------------------------------------------------------
INSERT INTO public.products (id, name, description) VALUES
  ('b517c6f8-30c8-40b0-aaf6-4772ec300313', 'Bidón 20 Litros',     'Bidón de agua purificada retornable de 20L'),
  ('da563a7b-ebb5-4f8c-a18b-641b2eba221b', 'Bidón 12 Litros',     'Bidón de agua purificada retornable de 12L'),
  ('3b03ac70-0460-430c-baaa-0ff8a793e229', 'Sifón de Soda 1.5L',  'Sifón descartable o retornable de soda premium'),
  ('cdba6af2-3587-4f02-9fc5-5f27fca445e2', 'Dispensador de Mesa', 'Dispensador manual de agua para bidones de 10L y 20L')
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Link de registro del admin: copiá el id y armá <URL de la app>/invite/<id>
SELECT id, email, role, expires_at
  FROM public.invitations
 WHERE lower(email) = lower('santino.ventrice@gmail.com')
   AND used_at IS NULL;
