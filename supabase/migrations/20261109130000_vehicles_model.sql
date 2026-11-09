-- Versiona vehicles.model: existe en la base remota (y en database.types.ts)
-- pero no estaba en ninguna migración, así que una base armada desde cero no la tenía.
-- Idempotente: no cambia nada donde la columna ya existe.
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS model text;
