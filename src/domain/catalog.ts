/**
 * Reference catalog: categories, skills and neighborhoods, plus runtime registry
 * for community-created custom skills so synchronous UI helpers resolve them cleanly.
 */
import { getActiveLocale, type SupportedLocale } from '../lib/i18n';
import type { ResolvedScheme } from '../ui/themeTokens';
import type { CategoryId, Neighborhood, Skill, SkillCategory } from './types';

export const CATEGORIES: SkillCategory[] = [
  {
    id: 'languages',
    name: 'Idiomas',
    nameEn: 'Languages',
    icon: 'language',
    color: '#1D4ED8',
    darkColor: '#60A5FA',
  },
  {
    id: 'music',
    name: 'Música',
    nameEn: 'Music',
    icon: 'musical-notes',
    color: '#7E22CE',
    darkColor: '#C084FC',
  },
  {
    id: 'academic',
    name: 'Apoyo escolar',
    nameEn: 'Academic',
    icon: 'school',
    color: '#0E7490',
    darkColor: '#22D3EE',
  },
  {
    id: 'tech',
    name: 'Tecnología',
    nameEn: 'Technology',
    icon: 'code-slash',
    color: '#4338CA',
    darkColor: '#818CF8',
  },
  {
    id: 'sports',
    name: 'Deportes',
    nameEn: 'Sports',
    icon: 'football',
    color: '#B91C1C',
    darkColor: '#F87171',
  },
  {
    id: 'arts_crafts',
    name: 'Artes y manualidades',
    nameEn: 'Arts & crafts',
    icon: 'color-palette',
    color: '#92400E',
    darkColor: '#FBBF24',
  },
  {
    id: 'practical',
    name: 'Habilidades prácticas',
    nameEn: 'Practical',
    icon: 'hammer',
    color: '#166534',
    darkColor: '#4ADE80',
  },
];

export const SKILLS: Skill[] = [
  // Languages
  { id: 's-english', categoryId: 'languages', name: 'Inglés', nameEn: 'English' },
  { id: 's-portuguese', categoryId: 'languages', name: 'Portugués', nameEn: 'Portuguese' },
  { id: 's-french', categoryId: 'languages', name: 'Francés', nameEn: 'French' },
  { id: 's-italian', categoryId: 'languages', name: 'Italiano', nameEn: 'Italian' },

  // Music
  { id: 's-piano', categoryId: 'music', name: 'Piano', nameEn: 'Piano' },
  { id: 's-guitar', categoryId: 'music', name: 'Guitarra', nameEn: 'Guitar' },
  { id: 's-singing', categoryId: 'music', name: 'Canto', nameEn: 'Singing' },
  { id: 's-percussion', categoryId: 'music', name: 'Percusión', nameEn: 'Percussion' },

  // Academic
  { id: 's-math', categoryId: 'academic', name: 'Matemática', nameEn: 'Mathematics' },
  { id: 's-physics', categoryId: 'academic', name: 'Física', nameEn: 'Physics' },
  { id: 's-literature', categoryId: 'academic', name: 'Lengua y literatura', nameEn: 'Literature & writing' },
  { id: 's-history', categoryId: 'academic', name: 'Historia', nameEn: 'History' },

  // Technology
  { id: 's-python', categoryId: 'tech', name: 'Python', nameEn: 'Python' },
  { id: 's-web', categoryId: 'tech', name: 'Desarrollo web', nameEn: 'Web development' },
  { id: 's-excel', categoryId: 'tech', name: 'Planillas y Excel', nameEn: 'Spreadsheets & Excel' },
  { id: 's-design', categoryId: 'tech', name: 'Diseño digital', nameEn: 'Digital design' },

  // Sports
  { id: 's-karate', categoryId: 'sports', name: 'Karate', nameEn: 'Karate' },
  { id: 's-football', categoryId: 'sports', name: 'Fútbol', nameEn: 'Football' },
  { id: 's-yoga', categoryId: 'sports', name: 'Yoga', nameEn: 'Yoga' },
  { id: 's-meditation', categoryId: 'sports', name: 'Meditación', nameEn: 'Meditation' },
  { id: 's-running', categoryId: 'sports', name: 'Running y entrenamiento', nameEn: 'Running & fitness' },
  { id: 's-swimming', categoryId: 'sports', name: 'Natación', nameEn: 'Swimming' },

  // Arts & crafts
  { id: 's-photo', categoryId: 'arts_crafts', name: 'Fotografía', nameEn: 'Photography' },
  { id: 's-drawing', categoryId: 'arts_crafts', name: 'Dibujo', nameEn: 'Drawing' },
  { id: 's-sewing', categoryId: 'arts_crafts', name: 'Costura', nameEn: 'Sewing' },
  { id: 's-pottery', categoryId: 'arts_crafts', name: 'Cerámica', nameEn: 'Pottery' },
  { id: 's-embroidery', categoryId: 'arts_crafts', name: 'Bordado', nameEn: 'Embroidery' },

  // Practical
  { id: 's-carpentry', categoryId: 'practical', name: 'Carpintería', nameEn: 'Carpentry' },
  { id: 's-cooking', categoryId: 'practical', name: 'Cocina', nameEn: 'Cooking' },
  { id: 's-gardening', categoryId: 'practical', name: 'Huerta comunitaria', nameEn: 'Community gardening' },
  { id: 's-home-repair', categoryId: 'practical', name: 'Reparaciones del hogar', nameEn: 'Home repairs' },
  { id: 's-first-aid', categoryId: 'practical', name: 'Primeros auxilios', nameEn: 'First aid' },
];

export const NEIGHBORHOODS: Neighborhood[] = [
  { id: 'n-santo-tomas', name: 'Santo Tomás', isActive: true },
  { id: 'n-pilar', name: 'Pilar Centro', isActive: false },
  { id: 'n-derqui', name: 'Presidente Derqui', isActive: false },
];

const skillById = new Map(SKILLS.map((s) => [s.id, s]));
const customSkillById = new Map<string, Skill>();
const categoryById = new Map(CATEGORIES.map((c) => [c.id, c]));
const neighborhoodById = new Map(NEIGHBORHOODS.map((n) => [n.id, n]));

export function registerCustomSkill(skill: Skill): void {
  customSkillById.set(skill.id, skill);
}

export function clearCustomSkills(): void {
  customSkillById.clear();
}

export function getAllSkills(): Skill[] {
  return [...SKILLS, ...Array.from(customSkillById.values())];
}

export const getSkill = (id: string): Skill | undefined => skillById.get(id) ?? customSkillById.get(id);
export const getCategory = (id: CategoryId) => categoryById.get(id)!;
export const getNeighborhood = (id: string) => neighborhoodById.get(id);

export function getCategoryColor(category: SkillCategory, resolvedScheme: ResolvedScheme = 'light'): string {
  return resolvedScheme === 'dark' ? category.darkColor : category.color;
}

export function getCategoryName(category: SkillCategory, locale: SupportedLocale = getActiveLocale()): string {
  return locale === 'en' ? category.nameEn ?? category.name : category.name;
}

export function categoryName(id: CategoryId, locale: SupportedLocale = getActiveLocale()): string {
  const cat = categoryById.get(id);
  if (!cat) return locale === 'en' ? 'Category' : 'Categoría';
  return getCategoryName(cat, locale);
}

export function getSkillName(skill: Skill, locale: SupportedLocale = getActiveLocale()): string {
  return locale === 'en' ? skill.nameEn ?? skill.name : skill.name;
}

export function skillName(id: string, locale: SupportedLocale = getActiveLocale()): string {
  const skill = getSkill(id);
  if (!skill) return locale === 'en' ? 'Skill' : 'Habilidad';
  return getSkillName(skill, locale);
}

export const categoryOfSkill = (skillId: string) => {
  const s = getSkill(skillId);
  return s ? categoryById.get(s.categoryId) : undefined;
};
