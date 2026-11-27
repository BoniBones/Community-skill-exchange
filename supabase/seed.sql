-- =============================================================================
-- Community Skill Exchange — Seed & Pilot Configuration (CSE-M3 Sync)
-- Target communities: Santo Tomás (active), Pilar Centro, Presidente Derqui
-- Schema aligned with 20261108000001..20261125000006
-- =============================================================================

begin;

-- 1. Application Credit Policy Configuration (integer-only, non-cashable)
insert into public.app_config (key, value)
values
  ('credit_policy', '{"unit":"hour","credits_per_hour":1,"integer_only":true,"non_cashable":true}'::jsonb)
on conflict (key) do update
  set value = excluded.value,
      updated_at = now();

-- 2. Neighborhoods (coarse locality only; never private residential addresses)
insert into public.neighborhoods (id, name, centroid_lat, centroid_lng)
values
  ('n-santo-tomas', 'Santo Tomás', -34.4789, -58.9211),
  ('n-pilar', 'Pilar Centro', -34.4587, -58.9142),
  ('n-derqui', 'Presidente Derqui', -34.4961, -58.8364)
on conflict (id) do update
  set name = excluded.name,
      centroid_lat = excluded.centroid_lat,
      centroid_lng = excluded.centroid_lng;

update public.neighborhoods
set is_active = (id = 'n-santo-tomas');

-- Precomputed salted SHA-256 digest for active pilot neighborhood access
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

-- 3. Skill Categories (7 categories matching src/domain/catalog.ts)
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

-- 4. Catalog Skills (strictly separated from user_skills and activities)
insert into public.skills (id, category_id, name)
values
  ('s-english', 'languages', 'Inglés'),
  ('s-portuguese', 'languages', 'Portugués'),
  ('s-french', 'languages', 'Francés'),
  ('s-italian', 'languages', 'Italiano'),
  ('s-piano', 'music', 'Piano'),
  ('s-guitar', 'music', 'Guitarra'),
  ('s-singing', 'music', 'Canto'),
  ('s-percussion', 'music', 'Percusión'),
  ('s-math', 'academic', 'Matemática'),
  ('s-physics', 'academic', 'Física'),
  ('s-literature', 'academic', 'Lengua y literatura'),
  ('s-history', 'academic', 'Historia'),
  ('s-python', 'tech', 'Python'),
  ('s-web', 'tech', 'Desarrollo web'),
  ('s-excel', 'tech', 'Planillas y Excel'),
  ('s-design', 'tech', 'Diseño digital'),
  ('s-karate', 'sports', 'Karate'),
  ('s-football', 'sports', 'Fútbol'),
  ('s-yoga', 'sports', 'Yoga'),
  ('s-meditation', 'sports', 'Meditación'),
  ('s-running', 'sports', 'Running y entrenamiento'),
  ('s-swimming', 'sports', 'Natación'),
  ('s-photo', 'arts_crafts', 'Fotografía'),
  ('s-drawing', 'arts_crafts', 'Dibujo'),
  ('s-sewing', 'arts_crafts', 'Costura'),
  ('s-pottery', 'arts_crafts', 'Cerámica'),
  ('s-embroidery', 'arts_crafts', 'Bordado'),
  ('s-carpentry', 'practical', 'Carpintería'),
  ('s-cooking', 'practical', 'Cocina'),
  ('s-gardening', 'practical', 'Huerta comunitaria'),
  ('s-home-repair', 'practical', 'Reparaciones del hogar'),
  ('s-first-aid', 'practical', 'Primeros auxilios')
on conflict (id) do update
  set category_id = excluded.category_id,
      name = excluded.name;

-- 5. System Credit Accounts (escrow, incentive_pool, adjustments; integer balances)
insert into public.credit_accounts (id, owner_id, kind, balance)
values
  ('00000000-0000-0000-0000-000000000001', null, 'escrow', 0),
  ('00000000-0000-0000-0000-000000000002', null, 'incentive_pool', 1000000),
  ('00000000-0000-0000-0000-000000000003', null, 'adjustments', 0)
on conflict (id) do nothing;

commit;
