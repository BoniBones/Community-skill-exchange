import { createContext, useContext, useState, type ReactNode } from 'react';

import type { ID, UserSkill } from '../../domain/types';
import { config } from '../../lib/config';
import { getSupabase } from '../../services/supabase';

export interface OnboardingDraft {
  displayName: string;
  neighborhoodId: ID;
  bio: string;
  availabilitySummary: string;
  skills: UserSkill[];
}

interface AuthContextValue {
  email: string;
  isNewRegistration: boolean;
  onboardingCompleted: boolean;
  draft: OnboardingDraft;
  sendOtp: (email: string, isNewRegistration: boolean) => Promise<void>;
  verifyOtp: (code: string) => Promise<{ nextRoute: '/(onboarding)/eligibility' | '/(tabs)' }>;
  updateDraft: (partial: Partial<OnboardingDraft>) => void;
  markOnboardingCompleted: () => void;
  resetToNewOnboarding: () => void;
  signOut: () => void;
}

const defaultDraft: OnboardingDraft = {
  displayName: 'Sofía Romero',
  neighborhoodId: 'n-santo-tomas',
  bio: 'Profe de piano hace 8 años. Me encanta enseñar a quienes nunca tocaron un instrumento. Quiero animarme al karate y aprender a programar.',
  availabilitySummary: 'Martes y jueves por la tarde',
  skills: [
    { skillId: 's-piano', kind: 'offers', level: 'advanced' },
    { skillId: 's-english', kind: 'offers', level: 'advanced' },
    { skillId: 's-karate', kind: 'wants' },
    { skillId: 's-photo', kind: 'wants' },
    { skillId: 's-python', kind: 'wants' },
  ],
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState('sofia.romero@comunidad.ar');
  const [isNewRegistration, setIsNewRegistration] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(true);
  const [draft, setDraft] = useState<OnboardingDraft>(defaultDraft);

  const sendOtp = async (rawEmail: string, isNew: boolean) => {
    const trimmed = rawEmail.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      throw new Error('Ingresá un email válido.');
    }
    setEmail(trimmed);
    setIsNewRegistration(isNew);

    const sb = getSupabase();
    if (config.dataMode === 'supabase' && sb) {
      const { error } = await sb.auth.signInWithOtp({ email: trimmed });
      if (error) throw new Error(error.message);
    } else {
      await new Promise((r) => setTimeout(r, 250));
    }
  };

  const verifyOtp = async (code: string): Promise<{ nextRoute: '/(onboarding)/eligibility' | '/(tabs)' }> => {
    const digits = code.trim();
    if (digits.length !== 6) {
      throw new Error('El código debe tener 6 dígitos.');
    }

    const sb = getSupabase();
    if (config.dataMode === 'supabase' && sb) {
      const { error } = await sb.auth.verifyOtp({
        email,
        token: digits,
        type: 'email',
      });
      if (error) throw new Error(error.message);
    } else {
      await new Promise((r) => setTimeout(r, 250));
    }

    if (isNewRegistration) {
      setOnboardingCompleted(false);
      return { nextRoute: '/(onboarding)/eligibility' };
    }
    setOnboardingCompleted(true);
    return { nextRoute: '/(tabs)' };
  };

  const updateDraft = (partial: Partial<OnboardingDraft>) => {
    setDraft((prev) => ({ ...prev, ...partial }));
  };

  const markOnboardingCompleted = () => {
    setOnboardingCompleted(true);
    setIsNewRegistration(false);
  };

  const resetToNewOnboarding = () => {
    setIsNewRegistration(true);
    setOnboardingCompleted(false);
  };

  const signOut = () => {
    setIsNewRegistration(false);
  };

  return (
    <AuthContext.Provider
      value={{
        email,
        isNewRegistration,
        onboardingCompleted,
        draft,
        sendOtp,
        verifyOtp,
        updateDraft,
        markOnboardingCompleted,
        resetToNewOnboarding,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
