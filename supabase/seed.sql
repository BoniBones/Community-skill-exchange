-- =============================================================================
-- Community Skill Exchange — Seed Data (Categories, Skills, Neighborhoods, Config)
-- =============================================================================

insert into public.app_config (key, value) values
  ('incentive_amount', '2'::jsonb),
  ('max_balance', '20'::jsonb),
  ('cancellation_deadline_hours', '24'::jsonb),
  ('late_cancel_penalty_pct', '50'::jsonb),
  ('min_age', '18'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();

insert into public.neighborhoods (id, name, centroid_lat, centroid_lng) values
  ('n-santo-tomas', 'Santo Tomás', -34.478, -58.895),
  ('n-pilar', 'Pilar Centro', -34.458, -58.914),
  ('n-derqui', 'Presidente Derqui', -34.492, -58.836)
on conflict (id) do nothing;

insert into public.skill_categories (id, name, icon, color) values
  ('music_arts', 'Música y artes', 'musical-notes', '#9333EA'),
  ('languages', 'Idiomas', 'language', '#2563EB'),
  ('academic', 'Apoyo escolar', 'school', '#0891B2'),
  ('tech', 'Programación y tecnología', 'code-slash', '#4F46E5'),
  ('sports', 'Deportes y actividad física', 'football', '#DC2626'),
  ('crafts', 'Oficios y manualidades', 'hammer', '#B45309'),
  ('personal', 'Desarrollo personal', 'leaf', '#15803D'),
  ('community', 'Actividades comunitarias', 'people', '#C2410C')
on conflict (id) do nothing;

insert into public.skills (id, category_id, name) values
  ('s-piano', 'music_arts', 'Piano'),
  ('s-guitar', 'music_arts', 'Guitarra'),
  ('s-photo', 'music_arts', 'Fotografía'),
  ('s-drawing', 'music_arts', 'Dibujo'),
  ('s-english', 'languages', 'Inglés'),
  ('s-portuguese', 'languages', 'Portugués'),
  ('s-math', 'academic', 'Matemática'),
  ('s-physics', 'academic', 'Física'),
  ('s-python', 'tech', 'Python'),
  ('s-web', 'tech', 'Desarrollo web'),
  ('s-karate', 'sports', 'Karate'),
  ('s-football', 'sports', 'Fútbol'),
  ('s-yoga', 'personal', 'Yoga'),
  ('s-meditation', 'personal', 'Meditación'),
  ('s-carpentry', 'crafts', 'Carpintería'),
  ('s-sewing', 'crafts', 'Costura'),
  ('s-cooking', 'crafts', 'Cocina'),
  ('s-gardening', 'community', 'Huerta comunitaria')
on conflict (id) do nothing;
