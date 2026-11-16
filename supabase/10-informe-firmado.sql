-- PASO 10: Informe final con lista de pendientes, conformidad firmada y PDF.
-- Solo agrega columnas y una regla; no cambia datos existentes.

alter table public.informes_finales add column if not exists pendientes jsonb not null default '[]'::jsonb; -- [{id, texto, resuelto: {fecha, por} | null}]
alter table public.informes_finales add column if not exists firma jsonb;        -- {nombre, cargo, email, imagen: {url, path}, fecha, tomada_por}
alter table public.informes_finales add column if not exists pdf jsonb;          -- {url, path, name, size}
alter table public.informes_finales add column if not exists firmado_en timestamptz;

-- Un informe firmado no se puede cambiar: lo que se firmó queda como se firmó.
-- Se pueden seguir marcando los pendientes como resueltos. Solo un admin lo puede reabrir (borra la firma).
create or replace function public.proteger_informe_firmado() returns trigger
language plpgsql as $$
begin
  if old.firmado_en is null then return new; end if;
  if public.rol_actual() = 'admin' or coalesce(auth.jwt() ->> 'role', '') = 'service_role' then return new; end if;
  if new.datos is distinct from old.datos or new.archivos is distinct from old.archivos
     or new.firma is distinct from old.firma or new.pdf is distinct from old.pdf
     or new.firmado_en is distinct from old.firmado_en then
    raise exception 'El informe ya está firmado y no se puede cambiar. Solo un administrador lo puede reabrir.';
  end if;
  return new;
end $$;

drop trigger if exists proteger_informe_firmado on public.informes_finales;
create trigger proteger_informe_firmado before update on public.informes_finales
  for each row execute function public.proteger_informe_firmado();
