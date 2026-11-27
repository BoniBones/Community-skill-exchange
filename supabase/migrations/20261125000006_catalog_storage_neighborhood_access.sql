-- =============================================================================
-- Community Skill Exchange — CSE-M3 Catalog, Custom Skills, Avatar Storage
-- & Hashed Neighborhood Access Gate
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Expanded 7-Category Catalog & Custom Skills
-- -----------------------------------------------------------------------------

-- Upsert the 7 target categories before remapping existing skills (ON DELETE RESTRICT safe)
insert into public.skill_categories (id, name, icon, color)
values
  ('languages', 'Idiomas', 'language', '#1D4ED8'),
  ('music', 'Música', 'musical-notes', '#7E22CE'),
  ('academic', 'Apoyo escolar', 'school', '#0E7490'),
  ('tech', 'Tecnología', 'code-slash', '#4338CA'),
  ('sports', 'Deportes', 'football', '#B91C1C'),
  ('arts_crafts', 'Artes y manualidades', 'color-palette', '#92400E'),
  ('practical', 'Habilidades prácticas', 'hammer', '#166534')
on conflict (id) do update
  set name = excluded.name,
      icon = excluded.icon,
      color = excluded.color;

-- Remap legacy categories on existing skills before removing obsolete category rows
update public.skills
set category_id = 'music'
where id in ('s-piano', 's-guitar') and category_id = 'music_arts';

update public.skills
set category_id = 'arts_crafts'
where category_id = 'music_arts';

update public.skills
set category_id = 'arts_crafts'
where id = 's-sewing' and category_id = 'crafts';

update public.skills
set category_id = 'practical'
where category_id in ('crafts', 'community');

update public.skills
set category_id = 'sports'
where category_id = 'personal';

delete from public.skill_categories
where id in ('music_arts', 'crafts', 'personal', 'community');

-- Extend skills table for optional description and community-created custom skills
alter table public.skills
  add column if not exists description text,
  add column if not exists is_custom boolean not null default false,
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'skills_name_len_check'
  ) then
    alter table public.skills
      add constraint skills_name_len_check check (char_length(trim(name)) >= 2);
  end if;
end $$;

create unique index if not exists skills_category_lower_name_uidx
  on public.skills (category_id, lower(trim(name)));

-- Upsert expanded built-in catalog across all 7 categories
insert into public.skills (id, category_id, name, is_custom)
values
  ('s-english', 'languages', 'Inglés', false),
  ('s-portuguese', 'languages', 'Portugués', false),
  ('s-french', 'languages', 'Francés', false),
  ('s-italian', 'languages', 'Italiano', false),
  ('s-piano', 'music', 'Piano', false),
  ('s-guitar', 'music', 'Guitarra', false),
  ('s-singing', 'music', 'Canto', false),
  ('s-percussion', 'music', 'Percusión', false),
  ('s-math', 'academic', 'Matemática', false),
  ('s-physics', 'academic', 'Física', false),
  ('s-literature', 'academic', 'Lengua y literatura', false),
  ('s-history', 'academic', 'Historia', false),
  ('s-python', 'tech', 'Python', false),
  ('s-web', 'tech', 'Desarrollo web', false),
  ('s-excel', 'tech', 'Planillas y Excel', false),
  ('s-design', 'tech', 'Diseño digital', false),
  ('s-karate', 'sports', 'Karate', false),
  ('s-football', 'sports', 'Fútbol', false),
  ('s-yoga', 'sports', 'Yoga', false),
  ('s-meditation', 'sports', 'Meditación', false),
  ('s-running', 'sports', 'Running y entrenamiento', false),
  ('s-swimming', 'sports', 'Natación', false),
  ('s-photo', 'arts_crafts', 'Fotografía', false),
  ('s-drawing', 'arts_crafts', 'Dibujo', false),
  ('s-sewing', 'arts_crafts', 'Costura', false),
  ('s-pottery', 'arts_crafts', 'Cerámica', false),
  ('s-embroidery', 'arts_crafts', 'Bordado', false),
  ('s-carpentry', 'practical', 'Carpintería', false),
  ('s-cooking', 'practical', 'Cocina', false),
  ('s-gardening', 'practical', 'Huerta comunitaria', false),
  ('s-home-repair', 'practical', 'Reparaciones del hogar', false),
  ('s-first-aid', 'practical', 'Primeros auxilios', false)
on conflict (id) do update
  set category_id = excluded.category_id,
      name = excluded.name,
      is_custom = false;

drop policy if exists "Authenticated create custom skills" on public.skills;
create policy "Authenticated create custom skills"
  on public.skills
  for insert
  to authenticated
  with check (
    is_custom = true
    and created_by = auth.uid()
    and char_length(trim(name)) >= 2
  );

create or replace function public.create_custom_skill(
  p_name text,
  p_category_id text,
  p_description text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := trim(coalesce(p_name, ''));
  v_desc text := nullif(trim(coalesce(p_description, '')), '');
  v_existing record;
  v_new_id text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if char_length(v_name) < 2 then
    raise exception 'Skill name must be at least 2 characters';
  end if;

  if not exists (select 1 from public.skill_categories where id = p_category_id) then
    raise exception 'Invalid skill category';
  end if;

  select id, category_id, name, description, is_custom, created_by
  into v_existing
  from public.skills
  where category_id = p_category_id
    and lower(trim(name)) = lower(v_name)
  limit 1;

  if v_existing is not null then
    return jsonb_build_object(
      'id', v_existing.id,
      'category_id', v_existing.category_id,
      'name', v_existing.name,
      'description', v_existing.description,
      'is_custom', v_existing.is_custom,
      'created_by', v_existing.created_by
    );
  end if;

  v_new_id := 's-custom-' || replace(gen_random_uuid()::text, '-', '');

  insert into public.skills (id, category_id, name, description, is_custom, created_by)
  values (v_new_id, p_category_id, v_name, v_desc, true, v_uid);

  return jsonb_build_object(
    'id', v_new_id,
    'category_id', p_category_id,
    'name', v_name,
    'description', v_desc,
    'is_custom', true,
    'created_by', v_uid
  );
end;
$$;

revoke all on function public.create_custom_skill(text, text, text) from public, anon;
grant execute on function public.create_custom_skill(text, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Profile Avatars Storage Bucket & RLS Policies
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read avatars" on storage.objects;
create policy "Public read avatars"
  on storage.objects
  for select
  using (bucket_id = 'avatars');

drop policy if exists "Owner upload avatars" on storage.objects;
create policy "Owner upload avatars"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Owner update avatars" on storage.objects;
create policy "Owner update avatars"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Owner delete avatars" on storage.objects;
create policy "Owner delete avatars"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- -----------------------------------------------------------------------------
-- 3. Neighborhood Active Gate & Hashed Access Verification
-- -----------------------------------------------------------------------------

alter table public.neighborhoods
  add column if not exists is_active boolean not null default false;

update public.neighborhoods
set is_active = (id = 'n-santo-tomas');

alter table public.profiles
  add column if not exists neighborhood_verified_at timestamptz;

create table if not exists public.private_neighborhood_codes (
  neighborhood_id text primary key references public.neighborhoods(id) on delete cascade,
  code_salt text not null,
  code_hash text not null,
  updated_at timestamptz not null default now()
);

alter table public.private_neighborhood_codes enable row level security;
revoke all on table public.private_neighborhood_codes from public, anon, authenticated;

-- Precomputed salted SHA-256 hex digest (no plaintext invite code stored)
insert into public.private_neighborhood_codes (neighborhood_id, code_salt, code_hash)
values (
  'n-santo-tomas',
  'cse-nb-n-santo-tomas-v1',
  '5bc348b4cf70c95d77f7f890961bc0656146c8dadc3ae315c085d542f4e57ac6'
)
on conflict (neighborhood_id) do update
  set code_salt = excluded.code_salt,
      code_hash = excluded.code_hash,
      updated_at = now();

create or replace function public.verify_neighborhood_access(
  p_neighborhood_id text,
  p_access_code text
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_nb record;
  v_code_row record;
  v_trimmed_code text := trim(coalesce(p_access_code, ''));
  v_computed_hash text;
  v_verified_at timestamptz := now();
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select id, name, is_active
  into v_nb
  from public.neighborhoods
  where id = p_neighborhood_id;

  if v_nb is null then
    raise exception 'Neighborhood not found';
  end if;

  if not v_nb.is_active then
    raise exception 'Neighborhood is not active yet';
  end if;

  if v_trimmed_code = '' then
    raise exception 'Access code is required';
  end if;

  select neighborhood_id, code_salt, code_hash
  into v_code_row
  from public.private_neighborhood_codes
  where neighborhood_id = p_neighborhood_id;

  if v_code_row is null then
    raise exception 'Neighborhood access configuration missing';
  end if;

  v_computed_hash := encode(
    digest(v_code_row.code_salt || ':' || p_neighborhood_id || ':' || v_trimmed_code, 'sha256'),
    'hex'
  );

  if lower(v_computed_hash) <> lower(v_code_row.code_hash) then
    raise exception 'Invalid neighborhood access code';
  end if;

  update public.profiles
  set neighborhood_id = p_neighborhood_id,
      neighborhood_verified_at = v_verified_at,
      updated_at = now()
  where id = v_uid;

  return jsonb_build_object(
    'neighborhood_id', p_neighborhood_id,
    'verified_at', v_verified_at
  );
end;
$$;

revoke all on function public.verify_neighborhood_access(text, text) from public, anon;
grant execute on function public.verify_neighborhood_access(text, text) to authenticated;

commit;
