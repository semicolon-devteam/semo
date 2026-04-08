import type { User } from '@supabase/supabase-js';

export type OnboardingStatus = 'none' | 'pending' | 'approved' | 'rejected';
export type OnboardingRole = 'team-member' | 'incubator-participant';

export interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  role: 'admin' | 'member';
  onboarding_status: OnboardingStatus;
  onboarding_role: OnboardingRole | null;
  linked_domain: string | null;
  linked_service_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  menuAccess: string[];
  projectAccess: string[];
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

export const ALL_MENU_KEYS = [
  'bots',
  'org',
  'cost',
  'goals',
  'action-items',
  'kb',
  'system',
  'tests',
  'incubator',
  'meetings',
  'voice',
] as const;

export type MenuKey = (typeof ALL_MENU_KEYS)[number];
