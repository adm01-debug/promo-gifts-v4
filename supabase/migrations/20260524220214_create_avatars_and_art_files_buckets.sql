-- =============================================================
-- Cria os buckets de storage 'avatars' e 'art-files' referenciados pelo
-- frontend mas inexistentes:
--   avatars  -> src/components/admin/users/useUserManagement.ts (upload + getPublicUrl)
--   art-files-> src/pages/quotes/quote-view/*.ts (upload PDF + getPublicUrl)
-- Ambos públicos para leitura (getPublicUrl); escrita por usuários autenticados.
-- Idempotente.
-- =============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880,
        array['image/png','image/jpeg','image/jpg','image/webp','image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('art-files', 'art-files', true, 20971520,
        array['application/pdf','image/png','image/jpeg','image/jpg','image/webp','image/svg+xml'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Políticas de storage.objects (leitura pública; escrita autenticada por bucket).
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select to public using (bucket_id = 'avatars');

drop policy if exists "avatars_auth_insert" on storage.objects;
create policy "avatars_auth_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'avatars');

drop policy if exists "avatars_auth_update" on storage.objects;
create policy "avatars_auth_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars') with check (bucket_id = 'avatars');

drop policy if exists "avatars_auth_delete" on storage.objects;
create policy "avatars_auth_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'avatars');

drop policy if exists "art_files_public_read" on storage.objects;
create policy "art_files_public_read" on storage.objects
  for select to public using (bucket_id = 'art-files');

drop policy if exists "art_files_auth_insert" on storage.objects;
create policy "art_files_auth_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'art-files');

drop policy if exists "art_files_auth_update" on storage.objects;
create policy "art_files_auth_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'art-files') with check (bucket_id = 'art-files');

drop policy if exists "art_files_auth_delete" on storage.objects;
create policy "art_files_auth_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'art-files');
