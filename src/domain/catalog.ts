/**
 * Reference catalog: categories, skills and neighborhoods.
 * In Stage 3 this becomes seed data in supabase/seed.sql; it stays static and small,
 * so the UI can look names up synchronously.
 */
import type { CategoryId, Neighborhood, Skill, SkillCategory } from './types';

export const CATEGORIES: SkillCategory[] = [
  { id: 'music_arts', name: 'Música y artes', icon: 'musical-notes', color: '#9333EA' },
  { id: 'languages', name: 'Idiomas', icon: 'language', color: '#2563EB' },
  { id: 'academic', name: 'Apoyo escolar', icon: 'school', color: '#0891B2' },
  { id: 'tech', name: 'Programación y tecnología', icon: 'code-slash', color: '#4F46E5' },
  { id: 'sports', name: 'Deportes y actividad física', icon: 'football', color: '#DC2626' },
  { id: 'crafts', name: 'Oficios y manualidades', icon: 'hammer', color: '#B45309' },
  { id: 'personal', name: 'Desarrollo personal', icon: 'leaf', color: '#15803D' },
  { id: 'community', name: 'Actividades comunitarias', icon: 'people', color: '#C2410C' },
];

export const SKILLS: Skill[] = [
  { id: 's-piano', categoryId: 'music_arts', name: 'Piano' },
  { id: 's-guitar', categoryId: 'music_arts', name: 'Guitarra' },
  { id: 's-photo', categoryId: 'music_arts', name: 'Fotografía' },
  { id: 's-drawing', categoryId: 'music_arts', name: 'Dibujo' },
  { id: 's-english', categoryId: 'languages', name: 'Inglés' },
  { id: 's-portuguese', categoryId: 'languages', name: 'Portugués' },
  { id: 's-math', categoryId: 'academic', name: 'Matemática' },
  { id: 's-physics', categoryId: 'academic', name: 'Física' },
  { id: 's-python', categoryId: 'tech', name: 'Python' },
  { id: 's-web', categoryId: 'tech', name: 'Desarrollo web' },
  { id: 's-karate', categoryId: 'sports', name: 'Karate' },
  { id: 's-football', categoryId: 'sports', name: 'Fútbol' },
  { id: 's-yoga', categoryId: 'personal', name: 'Yoga' },
  { id: 's-meditation', categoryId: 'personal', name: 'Meditación' },
  { id: 's-carpentry', categoryId: 'crafts', name: 'Carpintería' },
  { id: 's-sewing', categoryId: 'crafts', name: 'Costura' },
  { id: 's-cooking', categoryId: 'crafts', name: 'Cocina' },
  { id: 's-gardening', categoryId: 'community', name: 'Huerta comunitaria' },
];

export const NEIGHBORHOODS: Neighborhood[] = [
  { id: 'n-santo-tomas', name: 'Santo Tomás' },
  { id: 'n-pilar', name: 'Pilar Centro' },
  { id: 'n-derqui', name: 'Presidente Derqui' },
];

const skillById = new Map(SKILLS.map((s) => [s.id, s]));
const categoryById = new Map(CATEGORIES.map((c) => [c.id, c]));
const neighborhoodById = new Map(NEIGHBORHOODS.map((n) => [n.id, n]));

export const getSkill = (id: string) => skillById.get(id);
export const getCategory = (id: CategoryId) => categoryById.get(id)!;
export const getNeighborhood = (id: string) => neighborhoodById.get(id);
export const skillName = (id: string) => skillById.get(id)?.name ?? 'Habilidad';
export const categoryOfSkill = (skillId: string) => {
  const s = skillById.get(skillId);
  return s ? categoryById.get(s.categoryId) : undefined;
};
