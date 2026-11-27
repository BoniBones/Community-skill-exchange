import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { useI18n } from '../../lib/i18n';
import type { IconName } from '../../ui/primitives';
import { useTheme } from '../../ui/theme';

function TabIcon({
  name,
  color,
  size,
  fallbackColor,
}: {
  name: IconName;
  color: unknown;
  size: number;
  fallbackColor: string;
}) {
  return <Ionicons name={name} size={size} color={typeof color === 'string' ? color : fallbackColor} />;
}

export default function TabsLayout() {
  const { colors } = useTheme();
  const { t } = useI18n();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          minHeight: 60,
          paddingBottom: 6,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabCommunity'),
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="people-outline" color={color} size={size} fallbackColor={colors.textMuted} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: t('tabExplore'),
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="compass-outline" color={color} size={size} fallbackColor={colors.textMuted} />
          ),
        }}
      />
      <Tabs.Screen
        name="sessions"
        options={{
          title: t('tabSessions'),
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="calendar-outline" color={color} size={size} fallbackColor={colors.textMuted} />
          ),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: t('tabCredits'),
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="time-outline" color={color} size={size} fallbackColor={colors.textMuted} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabProfile'),
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="person-circle-outline" color={color} size={size} fallbackColor={colors.textMuted} />
          ),
        }}
      />
    </Tabs>
  );
}
