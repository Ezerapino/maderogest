-- PASO 5: pestaña "Mantenimiento planta" (tareas para hacer en la planta).
-- Solo agrega una tabla nueva; no toca nada de lo que ya existe.

create table if not exists public.mantenimiento (
  id text primary key,
  tarea text not null,
  detalle text,
  responsable text,                                  -- quién la tiene que hacer
  supervisor text,                                   -- quién controla que esté bien hecha
  fecha_solicitud date not null default current_date,
  solicitado_por text,                               -- quién la cargó (lo pone la app)
  realizada boolean not null default false,
  realizada_en date,
  supervisada boolean not null default false,
  supervisada_en date,
  creado_en timestamptz not null default now(),
  editado_en timestamptz
);
alter table public.mantenimiento enable row level security;
drop policy if exists "Usuarios con sesion" on public.mantenimiento;
create policy "Usuarios con sesion" on public.mantenimiento for all to authenticated using (true) with check (true);

-- Que los cambios queden en el Historial de modificaciones (como las demás tablas)
drop trigger if exists auditar on public.mantenimiento;
create trigger auditar after insert or update or delete on public.mantenimiento for each row execute function public.auditar('tarea');  -- ver paso 7
