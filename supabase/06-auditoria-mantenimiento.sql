-- PASO 6: que el Historial muestre el nombre de la tarea en los cambios de "Mantenimiento planta".
-- Reemplaza la función auditar() (misma que en el paso 4, con "tarea" como nombre de respaldo)
-- y completa el nombre en las entradas del Historial de Mantenimiento que quedaron sin él.

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
  obra := coalesce(fila ->> 'obra_nombre', fila ->> 'nombre', fila ->> 'name', fila ->> 'tarea');
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

-- Las entradas ya anotadas sin nombre: se completan con el nombre de la tarea
update public.auditoria a
set obra = coalesce(case when jsonb_typeof(a.cambios -> 'tarea') = 'string' then a.cambios ->> 'tarea' end,
                   (select m.tarea from public.mantenimiento m where m.id = a.fila_id))
where a.tabla = 'mantenimiento' and a.obra is null;
