import { Redirect } from 'expo-router';

/**
 * Entry route. Stage 2 will branch on the auth session here
 * (signed out → /welcome, onboarding incomplete → onboarding, else → tabs).
 */
export default function Index() {
  return <Redirect href="/welcome" />;
}
