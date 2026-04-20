-- 019 — Fotky a videá inzerátov
-- Fotky sa nahrávajú do Supabase Storage bucketu 'inzerat-fotky' (public).
-- Videá sú primárne YouTube/Vimeo linky (väčšina portálov nepodporuje direct upload).

alter table nehnutelnosti
  add column if not exists fotky_urls    text[] default array[]::text[],
  add column if not exists fotky_thumbs  text[] default array[]::text[],
  add column if not exists videa_urls    text[] default array[]::text[];

comment on column nehnutelnosti.fotky_urls   is 'Verejné URL-s fotiek v poradí zobrazenia (Supabase Storage: inzerat-fotky).';
comment on column nehnutelnosti.fotky_thumbs is 'Thumbnail URL-s (400px), paralelné pole k fotky_urls.';
comment on column nehnutelnosti.videa_urls   is 'YouTube/Vimeo linky, alebo storage URL pre direct upload.';

-- Storage bucket pre fotky inzerátov (public read, authenticated write)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'inzerat-fotky',
  'inzerat-fotky',
  true,
  10485760, -- 10 MB strop na jednu fotku
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- RLS policies pre storage.objects v bucketi inzerat-fotky
drop policy if exists "inzerat-fotky public read" on storage.objects;
create policy "inzerat-fotky public read"
  on storage.objects for select
  using (bucket_id = 'inzerat-fotky');

drop policy if exists "inzerat-fotky authenticated write" on storage.objects;
create policy "inzerat-fotky authenticated write"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'inzerat-fotky');

drop policy if exists "inzerat-fotky owner delete" on storage.objects;
create policy "inzerat-fotky owner delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'inzerat-fotky' and auth.uid()::text = owner);
