-- PASO 4: historial de modificaciones (auditoría), solo visible para admin@fabrica.com.
-- La base anota sola cada alta, cambio y baja en las tablas de la app: quién, cuándo y qué cambió.
-- Solo agrega cosas (tabla, funciones y triggers nuevos); no cambia datos existentes.

create table if not exists public.auditoria (
  id bigint generated always as identity primary key,
  creado_en timestamptz not null default now(),
  usuario_email text,
  usuario_nombre text,
  tabla text not null,
  fila_id text,
  obra text,
  accion text not null,          -- 'creó' | 'modificó' | 'borró'
  cambios jsonb                  -- modificó: { campo: [antes, después] } (listas: agregados/quitados/cambiados); creó/borró: la fila
);
create index if not exists auditoria_creado_en_idx on public.auditoria (creado_en desc);

alter table public.auditoria enable row level security;
drop policy if exists "Solo admin@fabrica.com" on public.auditoria;
create policy "Solo admin@fabrica.com" on public.auditoria for select to authenticated
  using (lower(auth.jwt() ->> 'email') = 'admin@fabrica.com');
-- Nadie la puede escribir ni borrar desde la app: solo la llenan los triggers
revoke insert, update, delete, truncate on public.auditoria from anon, authenticated;

-- Con qué se reconoce un elemento de una lista (ítems, adicionales, estaciones, archivos...)
create or replace function public.auditoria_clave(col text, e jsonb) returns text
language sql immutable as $$
  select case
    when jsonb_typeof(e) <> 'object' then e::text
    when col = 'stations' then e ->> 'name'
    else coalesce(e ->> 'id', e ->> 'path', e ->> 'time', e::text)
  end
$$;

-- Diferencia entre dos listas: solo lo agregado, lo quitado y lo que cambió de cada elemento
create or replace function public.auditoria_diff_lista(col text, viejo jsonb, nuevo jsonb) returns jsonb
language plpgsql immutable as $$
declare
  v jsonb := case when jsonb_typeof(viejo) = 'array' then viejo else '[]' end;
  n jsonb := case when jsonb_typeof(nuevo) = 'array' then nuevo else '[]' end;
  agregados jsonb := '[]'; quitados jsonb := '[]'; cambiados jsonb := '[]';
  e jsonb; o jsonb; dif jsonb; r jsonb := '{}';
begin
  for e in select * from jsonb_array_elements(n) loop
    o := null;
    select x into o from jsonb_array_elements(v) x where public.auditoria_clave(col, x) = public.auditoria_clave(col, e) limit 1;
    if o is null then
      agregados := agregados || jsonb_build_array(e);
    elsif o <> e then
      dif := null;
      if jsonb_typeof(e) = 'object' and jsonb_typeof(o) = 'object' then
        select jsonb_object_agg(k, jsonb_build_array(o -> k, e -> k)) into dif
        from (select jsonb_object_keys(o) k union select jsonb_object_keys(e)) ks
        where (o -> k) is distinct from (e -> k);
      end if;
      cambiados := cambiados || jsonb_build_array(jsonb_build_object(
        'item', coalesce(e ->> 'nombre', e ->> 'name', e ->> 'descripcion', e ->> 'title', public.auditoria_clave(col, e)),
        'cambios', coalesce(dif, jsonb_build_object('valor', jsonb_build_array(o, e)))));
    end if;
  end loop;
  for o in select * from jsonb_array_elements(v) loop
    if not exists (select 1 from jsonb_array_elements(n) x where public.auditoria_clave(col, x) = public.auditoria_clave(col, o)) then
      quitados := quitados || jsonb_build_array(o);
    end if;
  end loop;
  if agregados <> '[]' then r := r || jsonb_build_object('agregados', agregados); end if;
  if quitados <> '[]' then r := r || jsonb_build_object('quitados', quitados); end if;
  if cambiados <> '[]' then r := r || jsonb_build_object('cambiados', cambiados); end if;
  return r;
end $$;

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
  obra := coalesce(fila ->> 'obra_nombre', fila ->> 'nombre', fila ->> 'name');
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

-- Un trigger por tabla de la app
do $$
declare t text;
begin
  foreach t in array array['proyectos', 'obras', 'avance_obras', 'materiales', 'cobros', 'obras_avance',
                           'avance_dias', 'informes_finales', 'obras_aceptadas', 'agregados', 'usuarios'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('drop trigger if exists auditar on public.%I', t);
    execute format('create trigger auditar after insert or update or delete on public.%I for each row execute function public.auditar()', t);
  end loop;
end $$;
