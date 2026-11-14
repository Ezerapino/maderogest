-- PASO 7: Mantenimiento planta.
--  1) Columna "supervisada_por": quién supervisó (ya no pisa a quién estaba asignado para supervisar).
--  2) Solo admin y operario pueden leer y cambiar las tareas (igual que lo que muestra la app).
--  3) El Historial toma el nombre de la columna que indica cada trigger (auditar('tarea')),
--     en vez de una lista fija dentro de la función. Reemplaza lo del paso 6.
--  4) Completa el nombre en entradas viejas del Historial de tareas que ya se borraron.

alter table public.mantenimiento add column if not exists supervisada_por text;

drop policy if exists "Usuarios con sesion" on public.mantenimiento;
drop policy if exists "Admin y operario" on public.mantenimiento;
create policy "Admin y operario" on public.mantenimiento for all to authenticated
  using (public.rol_actual() in ('admin', 'operario'))
  with check (public.rol_actual() in ('admin', 'operario'));

create or replace function public.auditar() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  -- Campos que cambian solos o que ya son un registro (no aportan al control)
  ignorar text[] := array['updated_at', 'editado_en', 'editado_por', 'created_at', 'creado_en', 'history'];
  viejo jsonb; nuevo jsonb; fila jsonb; cambios jsonb := '{}'; c text;
  uid uuid := auth.uid();
  email text := auth.jwt() ->> 'email';
  quien text; obra text;
begin
  if tg_op <> 'INSERT' then viejo := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then nuevo := to_jsonb(new); end if;
  fila := coalesce(nuevo, viejo);

  if tg_op = 'UPDATE' then
    for c in select jsonb_object_keys(nuevo) loop
      if c = any(ignorar) or (viejo -> c) is not distinct from (nuevo -> c) then continue; end if;
      if jsonb_typeof(nuevo -> c) = 'array' or jsonb_typeof(viejo -> c) = 'array' then
        cambios := cambios || jsonb_build_object(c, public.auditoria_diff_lista(c, viejo -> c, nuevo -> c));
      else
        cambios := cambios || jsonb_build_object(c, jsonb_build_array(viejo -> c, nuevo -> c));
      end if;
    end loop;
    if cambios = '{}' then return null; end if;   -- se guardó lo mismo que había: no se anota
  else
    cambios := fila - ignorar;
  end if;

  if uid is not null then select u.nombre into quien from public.usuarios u where u.auth_id = uid limit 1; end if;
  -- Nombre que se muestra en el Historial: la columna que indique el trigger (ej. auditar('tarea')) o las de siempre
  obra := coalesce(case when tg_nargs > 0 then fila ->> tg_argv[0] end, fila ->> 'obra_nombre', fila ->> 'nombre', fila ->> 'name');
  if tg_table_name = 'avance_dias' then
    select oa.nombre into obra from public.obras_avance oa where oa.id::text = fila ->> 'obra_id';
  elsif obra is null and fila ? 'obra_id' then
    select o.nombre into obra from public.obras o where o.id = fila ->> 'obra_id';
  end if;

  insert into public.auditoria (usuario_email, usuario_nombre, tabla, fila_id, obra, accion, cambios)
  values (email, coalesce(quien, email, 'Sistema (automático)'), tg_table_name, fila ->> 'id', obra,
          case tg_op when 'INSERT' then 'creó' when 'UPDATE' then 'modificó' else 'borró' end, cambios);
  return null;
end $$;

drop trigger if exists auditar on public.mantenimiento;
create trigger auditar after insert or update or delete on public.mantenimiento
  for each row execute function public.auditar('tarea');

-- Entradas sin nombre de tareas ya borradas: el nombre está en la entrada "borró" de la misma tarea
update public.auditoria a
set obra = b.cambios ->> 'tarea'
from public.auditoria b
where a.tabla = 'mantenimiento' and a.obra is null
  and b.tabla = 'mantenimiento' and b.accion = 'borró' and b.fila_id = a.fila_id;
