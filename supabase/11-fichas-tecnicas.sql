-- PASO 11: Fichas técnicas de desarrollo de mobiliario (Avance de Obra).
-- Una obra puede tener una ficha para toda la obra o una por ambiente / mueble.
-- Al firmarla queda cerrada; si piden cambios se hace una nueva versión (mismo número, revisión + 1).
-- Solo agrega una tabla nueva; no cambia datos existentes.

create sequence if not exists public.fichas_tecnicas_numero_seq;

create table if not exists public.fichas_tecnicas (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras_avance(id) on delete cascade,
  numero integer not null default nextval('public.fichas_tecnicas_numero_seq'),  -- N° de ficha (las versiones lo comparten)
  revision integer not null default 1,
  alcance text not null default 'obra',          -- obra (toda la obra) | ambiente (un ambiente o mueble)
  datos jsonb not null default '{}'::jsonb,      -- cliente, dimensiones, materiales, herrajes, notas...
  archivos jsonb not null default '[]'::jsonb,   -- fotos y croquis
  firma jsonb,                                   -- {nombre, cargo, email, imagen: {url, path}, fecha, tomada_por}
  pdf jsonb,                                     -- {url, path, name, size}
  firmado_en timestamptz,
  creado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (numero, revision)
);
alter sequence public.fichas_tecnicas_numero_seq owned by public.fichas_tecnicas.numero;
create index if not exists fichas_tecnicas_obra_idx on public.fichas_tecnicas (obra_id);

-- Todos los usuarios con sesión las ven; las cargan el arquitecto y los admin
alter table public.fichas_tecnicas enable row level security;
drop policy if exists "Ver fichas" on public.fichas_tecnicas;
drop policy if exists "Cargar fichas" on public.fichas_tecnicas;
drop policy if exists "Editar fichas" on public.fichas_tecnicas;
drop policy if exists "Borrar fichas" on public.fichas_tecnicas;
create policy "Ver fichas" on public.fichas_tecnicas for select to authenticated using (true);
create policy "Cargar fichas" on public.fichas_tecnicas for insert to authenticated
  with check (public.rol_actual() in ('admin', 'arquitecto'));
create policy "Editar fichas" on public.fichas_tecnicas for update to authenticated
  using (public.rol_actual() in ('admin', 'arquitecto')) with check (public.rol_actual() in ('admin', 'arquitecto'));
-- Borrar: el arquitecto solo las que no están firmadas; un admin cualquiera
create policy "Borrar fichas" on public.fichas_tecnicas for delete to authenticated
  using (public.rol_actual() = 'admin' or (public.rol_actual() = 'arquitecto' and firmado_en is null));

-- Una ficha firmada no se puede cambiar: lo que se firmó queda como se firmó
create or replace function public.proteger_ficha_firmada() returns trigger
language plpgsql as $$
begin
  if old.firmado_en is null then return new; end if;
  if coalesce(auth.jwt() ->> 'role', '') = 'service_role' then return new; end if;
  raise exception 'La ficha ya está firmada y no se puede cambiar. Hacé una nueva versión.';
end $$;
drop trigger if exists proteger_ficha_firmada on public.fichas_tecnicas;
create trigger proteger_ficha_firmada before update on public.fichas_tecnicas
  for each row execute function public.proteger_ficha_firmada();

-- Historial (quién cargó o cambió cada ficha)
drop trigger if exists auditar on public.fichas_tecnicas;
create trigger auditar after insert or update or delete on public.fichas_tecnicas
  for each row execute function public.auditar();

-- Control: tiene que devolver 0 filas y sin error
select * from public.fichas_tecnicas limit 0;
