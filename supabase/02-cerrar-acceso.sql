-- PASO 2 (después de migrar usuarios y de publicar la versión nueva de la app).
-- Cierra el acceso público: solo se puede leer/escribir con sesión iniciada.

-- Rol del usuario logueado (lo guarda Supabase Auth en app_metadata, el usuario no lo puede cambiar)
create or replace function public.rol_actual() returns text
language sql stable as $$ select coalesce(auth.jwt() -> 'app_metadata' ->> 'rol', '') $$;

-- 1) Tablas de la app: borrar las políticas actuales ("Allow all for anon", etc.)
--    y permitir todo solo a usuarios con sesión iniciada.
do $$
declare
  t text;
  p record;
  tablas text[] := array['obras','historial','cobros','materiales','agregados','avance_obras',
                         'obras_avance','avance_dias','informes_finales','obras_aceptadas','usuarios'];
begin
  foreach t in array tablas loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('alter table public.%I enable row level security', t);
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    if t not in ('cobros', 'usuarios') then
      execute format('create policy "Usuarios con sesion" on public.%I for all to authenticated using (true) with check (true)', t);
    end if;
  end loop;
end $$;

-- Cobros: solo admin y finanzas
create policy "Admin y finanzas" on public.cobros for all to authenticated
  using (public.rol_actual() in ('admin', 'finanzas'))
  with check (public.rol_actual() in ('admin', 'finanzas'));

-- Usuarios: todos los logueados pueden ver la lista (nombres y roles);
-- altas y bajas solo desde el servidor (/api/usuarios).
create policy "Ver usuarios" on public.usuarios for select to authenticated using (true);

-- Las contraseñas ya viven cifradas en Supabase Auth: borrar la columna en texto plano.
alter table public.usuarios drop column if exists password;

-- 2) Archivos (fotos, PDFs, Excel): el bucket sigue siendo de lectura pública por link,
--    pero subir, reemplazar y borrar requiere sesión iniciada.
do $$
declare p record;
begin
  for p in select policyname from pg_policies
           where schemaname = 'storage' and tablename = 'objects'
             and (coalesce(qual, '') || coalesce(with_check, '')) like '%avance-obra-fotos%' loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end $$;

create policy "Subir archivos con sesion" on storage.objects for insert to authenticated
  with check (bucket_id = 'avance-obra-fotos');
create policy "Modificar archivos con sesion" on storage.objects for update to authenticated
  using (bucket_id = 'avance-obra-fotos') with check (bucket_id = 'avance-obra-fotos');
create policy "Borrar archivos con sesion" on storage.objects for delete to authenticated
  using (bucket_id = 'avance-obra-fotos');
create policy "Leer archivos con sesion" on storage.objects for select to authenticated
  using (bucket_id = 'avance-obra-fotos');

-- 3) Control: políticas de storage que quedaron (si alguna da acceso a "anon" o "public"
--    sobre storage.objects, avisame antes de borrarla).
select policyname, roles, cmd, qual from pg_policies where schemaname = 'storage' and tablename = 'objects';
