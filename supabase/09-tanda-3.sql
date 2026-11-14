-- PASO 9: Mantenimiento con prioridad, sector y tareas que se repiten; remito al entregar; registro de avisos.
-- Solo agrega columnas y una tabla nueva; no cambia datos existentes.

-- 1) Mantenimiento planta
alter table public.mantenimiento add column if not exists prioridad text not null default 'normal';   -- urgente | normal | mejora
alter table public.mantenimiento add column if not exists sector text;                                -- máquina o sector (Cabina de lustre, Seccionadora...)
alter table public.mantenimiento add column if not exists repetir_cada_dias integer;                  -- preventivo: al terminarla se programa la siguiente
alter table public.mantenimiento add column if not exists anterior_id text;                           -- de qué tarea salió (si es una repetición)

-- 2) Remito o foto de la entrega (se adjunta al tocar "Entregar")
alter table public.obras add column if not exists remito jsonb not null default '[]'::jsonb;

-- 3) Cuándo salió cada aviso por mail (lo anota el servidor; la app muestra el último)
create table if not exists public.avisos_enviados (
  id bigint generated always as identity primary key,
  tipo text not null,                     -- entregas | materiales
  enviado_en timestamptz not null default now(),
  destinos integer,
  por text                                -- "automático" o el nombre de quien lo mandó
);
create index if not exists avisos_enviados_tipo_idx on public.avisos_enviados (tipo, enviado_en desc);
alter table public.avisos_enviados enable row level security;
drop policy if exists "Ver avisos con sesion" on public.avisos_enviados;
create policy "Ver avisos con sesion" on public.avisos_enviados for select to authenticated using (true);
-- Nadie la escribe desde la app: solo el servidor (service role)
revoke insert, update, delete, truncate on public.avisos_enviados from anon, authenticated;
