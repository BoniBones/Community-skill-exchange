import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { CATEGORIES, getCategoryColor, getCategoryName, getSkillName } from '../domain/catalog';
import type { CategoryId, CustomSkillInput, ID, Skill } from '../domain/types';
import { useI18n } from '../lib/i18n';
import { Badge, Button, Chip, IconCircle, Ionicons, Text, type IconName } from '../ui/primitives';
import { animateLayout, radius, spacing, useTheme } from '../ui/theme';

interface SkillCatalogPickerProps {
  mode: 'single' | 'multi';
  skills: Skill[];
  selectedIds: ID[];
  onChange: (nextIds: ID[]) => void;
  tone?: string;
  allowCustomCreate?: boolean;
  onCreateCustomSkill?: (input: CustomSkillInput) => Promise<Skill>;
  isCreatingCustom?: boolean;
}

export function SkillCatalogPicker({
  mode,
  skills,
  selectedIds,
  onChange,
  tone,
  allowCustomCreate = false,
  onCreateCustomSkill,
  isCreatingCustom = false,
}: SkillCatalogPickerProps) {
  const { colors, resolvedScheme } = useTheme();
  const { locale, t } = useI18n();

  const [search, setSearch] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCategoryId, setCustomCategoryId] = useState<CategoryId>('practical');
  const [customDescription, setCustomDescription] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const resolvedTone = tone ?? colors.primary;

  const groupedCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    return CATEGORIES.map((cat) => {
      const catEs = cat.name.toLowerCase();
      const catEn = (cat.nameEn ?? cat.name).toLowerCase();
      const catMatches = q.length > 0 && (catEs.includes(q) || catEn.includes(q));
      const matchingSkills = skills.filter((skill) => {
        if (skill.categoryId !== cat.id) return false;
        if (!q || catMatches) return true;
        const nameEs = skill.name.toLowerCase();
        const nameEn = (skill.nameEn ?? skill.name).toLowerCase();
        const desc = (skill.description ?? '').toLowerCase();
        return nameEs.includes(q) || nameEn.includes(q) || desc.includes(q);
      });
      return { category: cat, skills: matchingSkills };
    }).filter((group) => group.skills.length > 0);
  }, [skills, search]);

  const handleSelect = (skillId: ID) => {
    if (mode === 'single') {
      onChange([skillId]);
      return;
    }
    if (selectedSet.has(skillId)) {
      onChange(selectedIds.filter((id) => id !== skillId));
    } else {
      onChange([...selectedIds, skillId]);
    }
  };

  const handleCreateCustom = async () => {
    if (!onCreateCustomSkill) return;
    setCreateError(null);
    const trimmedName = customName.trim();
    if (trimmedName.length < 2) {
      setCreateError(t('repoErrCustomSkillName'));
      return;
    }
    try {
      const created = await onCreateCustomSkill({
        name: trimmedName,
        categoryId: customCategoryId,
        description: customDescription.trim() || undefined,
      });
      if (mode === 'single') {
        onChange([created.id]);
      } else if (!selectedSet.has(created.id)) {
        onChange([...selectedIds, created.id]);
      }
      setCustomName('');
      setCustomDescription('');
      animateLayout();
      setShowCreateForm(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : t('skillPickerCreateErr'));
    }
  };

  return (
    <View style={{ gap: spacing.md }}>
      {/* Live search */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          backgroundColor: colors.bg,
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: spacing.md,
          minHeight: 42,
        }}
      >
        <Ionicons name="search-outline" size={16} color={colors.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t('skillPickerSearchPlaceholder')}
          placeholderTextColor={colors.textMuted}
          style={{ flex: 1, fontSize: 14, color: colors.text, paddingVertical: 6 }}
        />
        {search ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('exploreClearFilters')}
            onPress={() => setSearch('')}
            hitSlop={8}
          >
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {/* Category-grouped skill chips */}
      {groupedCategories.length === 0 ? (
        <View
          style={{
            padding: spacing.md,
            borderRadius: radius.md,
            backgroundColor: colors.surfaceAlt,
            gap: 4,
          }}
        >
          <Text variant="bodyStrong">{t('skillPickerEmptyTitle')}</Text>
          <Text variant="caption" color={colors.textMuted}>
            {t('skillPickerEmptyHint')}
          </Text>
        </View>
      ) : (
        <View style={{ gap: spacing.md }}>
          {groupedCategories.map(({ category, skills: catSkills }) => {
            const catColor = getCategoryColor(category, resolvedScheme);
            return (
              <View key={category.id} style={{ gap: spacing.xs }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <IconCircle icon={category.icon as IconName} color={catColor} size={24} />
                  <Text variant="label" color={catColor} style={{ flex: 1 }}>
                    {getCategoryName(category, locale).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                  {catSkills.map((skill) => {
                    const baseLabel = getSkillName(skill, locale);
                    const label = skill.isCustom
                      ? `${baseLabel} · ${t('skillPickerCustomBadge')}`
                      : baseLabel;
                    return (
                      <Chip
                        key={skill.id}
                        label={label}
                        selected={selectedSet.has(skill.id)}
                        tone={resolvedTone}
                        icon={skill.isCustom ? 'sparkles-outline' : undefined}
                        onPress={() => handleSelect(skill.id)}
                      />
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Inline custom skill creator */}
      {allowCustomCreate && onCreateCustomSkill ? (
        <View style={{ paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border }}>
          {!showCreateForm ? (
            <Button
              title={t('skillPickerCreateToggle')}
              variant="secondary"
              icon="add-circle-outline"
              onPress={() => {
                setCreateError(null);
                if (search.trim().length >= 2 && !customName) {
                  setCustomName(search.trim());
                }
                animateLayout();
                setShowCreateForm(true);
              }}
            />
          ) : (
            <View
              style={{
                gap: spacing.sm,
                padding: spacing.md,
                borderRadius: radius.md,
                backgroundColor: colors.surfaceAlt,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Badge
                label={t('skillPickerCreateTitle')}
                fg={colors.primary}
                bg={colors.primarySoft}
                icon="sparkles-outline"
              />

              <View style={{ gap: 4 }}>
                <Text variant="label" color={colors.textMuted}>
                  {t('skillPickerCreateNameLabel')}
                </Text>
                <TextInput
                  value={customName}
                  onChangeText={setCustomName}
                  placeholder={t('skillPickerCreateNamePlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  style={{
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: radius.md,
                    paddingHorizontal: spacing.md,
                    minHeight: 42,
                    fontSize: 14,
                    color: colors.text,
                  }}
                />
              </View>

              <View style={{ gap: spacing.xs }}>
                <Text variant="label" color={colors.textMuted}>
                  {t('skillPickerCreateCatLabel')}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                  {CATEGORIES.map((cat) => (
                    <Chip
                      key={`custom-cat-${cat.id}`}
                      label={getCategoryName(cat, locale)}
                      selected={customCategoryId === cat.id}
                      tone={getCategoryColor(cat, resolvedScheme)}
                      onPress={() => setCustomCategoryId(cat.id)}
                    />
                  ))}
                </View>
              </View>

              <View style={{ gap: 4 }}>
                <Text variant="label" color={colors.textMuted}>
                  {t('skillPickerCreateDescLabel')}
                </Text>
                <TextInput
                  value={customDescription}
                  onChangeText={setCustomDescription}
                  placeholder={t('skillPickerCreateDescPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={2}
                  style={{
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: radius.md,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.xs,
                    minHeight: 62,
                    fontSize: 14,
                    color: colors.text,
                    textAlignVertical: 'top',
                  }}
                />
              </View>

              {createError ? (
                <Text variant="caption" color={colors.danger}>
                  {createError}
                </Text>
              ) : null}

              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button
                  title={t('skillPickerCreateSubmit')}
                  icon="checkmark-outline"
                  loading={isCreatingCustom}
                  style={{ flex: 1 }}
                  onPress={handleCreateCustom}
                />
                <Button
                  title={t('skillPickerCreateCancel')}
                  variant="ghost"
                  onPress={() => {
                    animateLayout();
                    setShowCreateForm(false);
                    setCreateError(null);
                  }}
                />
              </View>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}
