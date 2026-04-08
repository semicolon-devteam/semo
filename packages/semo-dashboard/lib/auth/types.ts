import type { User } from '@supabase/supabase-js';

export interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  role: 'admin' | 'member';
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
