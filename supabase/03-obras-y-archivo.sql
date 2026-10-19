-- PASO 3: obras con varias entregas, archivo y vínculo de todas las pestañas con la entrega.
-- Solo agrega cosas (tabla y columnas nuevas); no borra ni cambia datos existentes.

-- Obra: agrupa una o varias entregas (las filas de la tabla "obras" son las entregas)
create table if not exists public.proyectos (
  id text primary key,
  nombre text not null,
  lugar text,
  notas text,
  archivada boolean not null default false,
  archivada_en timestamptz,
  creado_por text,
  creado_en timestamptz not null default now()
);
alter table public.proyectos enable row level security;
drop policy if exists "Usuarios con sesion" on public.proyectos;
create policy "Usuarios con sesion" on public.proyectos for all to authenticated using (true) with check (true);

-- Entregas: a qué obra pertenecen, etiqueta ("1ª entrega") y archivo
alter table public.obras add column if not exists proyecto_id text references public.proyectos(id) on delete set null;
alter table public.obras add column if not exists etiqueta text;
alter table public.obras add column if not exists archivada boolean not null default false;
alter table public.obras add column if not exists archivada_en timestamptz;
create index if not exists obras_proyecto_id_idx on public.obras (proyecto_id);

-- Vínculo de las otras pestañas con la entrega (Cobros y Materiales ya tienen obra_id)
alter table public.avance_obras add column if not exists obra_id text;
alter table public.obras_avance add column if not exists obra_id text;
alter table public.obras_aceptadas add column if not exists proyecto_id text;
