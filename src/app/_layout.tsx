import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '../features/auth/authContext';
import { I18nProvider, useI18n } from '../lib/i18n';
import { ThemeProvider, useTheme } from '../ui/theme';

function RootNavigator() {
  const { colors, resolvedScheme } = useTheme();
  const { t } = useI18n();

  return (
    <>
      <StatusBar style={resolvedScheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerShadowVisible: false,
          headerTintColor: colors.primary,
          headerTitleStyle: { color: colors.text, fontWeight: '700' },
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ title: t('navSignIn') }} />
        <Stack.Screen name="verify-otp" options={{ title: t('navVerifyOtp') }} />
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="activity/[id]" options={{ title: t('navActivity') }} />
        <Stack.Screen name="user/[id]" options={{ title: t('navUserProfile') }} />
        <Stack.Screen name="session/[id]" options={{ title: t('navSession') }} />
        <Stack.Screen name="my-activities" options={{ title: t('navMyActivities') }} />
        <Stack.Screen name="activity-form" options={{ title: t('navActivityForm') }} />
        <Stack.Screen name="availability" options={{ title: t('navAvailability') }} />
        <Stack.Screen name="settings" options={{ title: t('navSettings') }} />
        <Stack.Screen name="edit-profile" options={{ headerShown: false }} />
        <Stack.Screen name="notifications" options={{ title: t('navNotifications') }} />
        <Stack.Screen name="admin" options={{ title: t('navAdmin') }} />
        <Stack.Screen name="dev" options={{ title: t('navDev') }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
      }),
  );

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <I18nProvider>
            <AuthProvider>
              <RootNavigator />
            </AuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
