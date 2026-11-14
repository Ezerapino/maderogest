-- PASO 8: cuando cambia el nombre, la dirección o la fecha de una entrega, la base lo copia sola a
-- Cobros, Materiales, Avance de Producción y Avance de Obra.
-- Antes lo hacía solo la app con los permisos de quien editaba: si un operario renombraba una obra,
-- Cobros (que es solo de admin y finanzas) quedaba con el nombre viejo sin avisar.
-- Solo agrega una función y un trigger; no cambia datos existentes.

create or replace function public.sincronizar_entrega() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.nombre is distinct from old.nombre or new.lugar is distinct from old.lugar then
    update public.cobros set obra_nombre = new.nombre, obra_lugar = new.lugar
      where obra_id::text = new.id::text and (obra_nombre is distinct from new.nombre or obra_lugar is distinct from new.lugar);
    update public.materiales set obra_nombre = new.nombre, obra_lugar = new.lugar
      where obra_id::text = new.id::text and (obra_nombre is distinct from new.nombre or obra_lugar is distinct from new.lugar);
    update public.avance_obras set name = new.nombre, client = new.lugar
      where obra_id::text = new.id::text and (name is distinct from new.nombre or client is distinct from new.lugar);
    update public.obras_avance set nombre = new.nombre, direccion = new.lugar
      where obra_id::text = new.id::text and (nombre is distinct from new.nombre or direccion is distinct from new.lugar);
  end if;
  if new.fecha is distinct from old.fecha then
    update public.avance_obras set due_date = nullif(new.fecha::text, '')::date
      where obra_id::text = new.id::text;
    update public.obras_avance set fecha_entrega = nullif(new.fecha::text, '')::date
      where obra_id::text = new.id::text;
  end if;
  return null;
end $$;

drop trigger if exists sincronizar_entrega on public.obras;
create trigger sincronizar_entrega after update of nombre, lugar, fecha on public.obras
  for each row execute function public.sincronizar_entrega();
