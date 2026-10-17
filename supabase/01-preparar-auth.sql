-- PASO 1 (antes de migrar usuarios). No cambia nada de lo que ve la app.
-- Agrega el vínculo entre la tabla "usuarios" y el usuario de Supabase Auth.
alter table public.usuarios add column if not exists auth_id uuid unique;
