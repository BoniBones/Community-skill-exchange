-- =============================================================================
-- Community Skill Exchange — Seed & Pilot Configuration (Stage 6)
-- Target communities: Santo Tomás, Pilar Centro, Presidente Derqui (Buenos Aires)
-- =============================================================================

begin;

-- 1. Neighborhoods (coarse locality only; never private residential addresses)
insert into public.neighborhoods (id, name, city, province)
values
  ('n-santo-tomas', 'Santo Tomás', 'Pilar / Santo Tomás', 'Buenos Aires'),
  ('n-pilar-centro', 'Pilar Centro', 'Pilar', 'Buenos Aires'),
  ('n-derqui', 'Presidente Derqui', 'Presidente Derqui', 'Buenos Aires')
on conflict (id) do update
  set name = excluded.name,
      city = excluded.city,
      province = excluded.province;

-- 2. Skill Categories
insert into public.skill_categories (id, name_es, name_en, icon, color)
values
  ('music_arts', 'Música y artes', 'Music & Arts', 'musical-notes', '#9333EA'),
  ('languages', 'Idiomas', 'Languages', 'language', '#2563EB'),
  ('academic', 'Apoyo académico', 'Academic Support', 'school', '#0891B2'),
  ('tech', 'Programación y tecnología', 'Programming & Tech', 'code-slash', '#4F46E5'),
  ('sports', 'Deportes y actividad física', 'Sports & Fitness', 'football', '#DC2626'),
  ('crafts', 'Oficios y habilidades prácticas', 'Crafts & Practical Skills', 'hammer', '#B45309'),
  ('personal', 'Desarrollo personal', 'Personal Development', 'leaf', '#15803D'),
  ('community', 'Otras actividades comunitarias', 'Community Activities', 'people', '#0F766E')
on conflict (id) do nothing;

-- 3. Catalog Skills (strictly separated from user_skills and activities)
insert into public.skills (id, category_id, name_es, name_en)
values
  ('s-piano', 'music_arts', 'Piano', 'Piano'),
  ('s-guitar', 'music_arts', 'Guitarra', 'Guitar'),
  ('s-photo', 'music_arts', 'Fotografía', 'Photography'),
  ('s-drawing', 'music_arts', 'Dibujo y pintura', 'Drawing & Painting'),
  ('s-english', 'languages', 'Inglés', 'English'),
  ('s-portuguese', 'languages', 'Portugués', 'Portuguese'),
  ('s-math', 'academic', 'Matemática', 'Mathematics'),
  ('s-physics', 'academic', 'Física', 'Physics'),
  ('s-python', 'tech', 'Programación (Python)', 'Programming (Python)'),
  ('s-digital', 'tech', 'Alfabetización digital', 'Digital Literacy'),
  ('s-karate', 'sports', 'Karate', 'Karate'),
  ('s-running', 'sports', 'Entrenamiento funcional', 'Functional Training'),
  ('s-cooking', 'crafts', 'Cocina casera', 'Home Cooking'),
  ('s-gardening', 'crafts', 'Huerta y jardinería', 'Gardening'),
  ('s-yoga', 'personal', 'Yoga y respiración', 'Yoga & Breathwork')
on conflict (id) do nothing;

-- 4. System Credit Accounts (mint + escrow)
insert into public.credit_accounts (id, user_id, kind, balance)
values
  ('00000000-0000-0000-0000-000000000001', null, 'system_mint', 0),
  ('00000000-0000-0000-0000-000000000002', null, 'escrow', 0)
on conflict (id) do nothing;

commit;
