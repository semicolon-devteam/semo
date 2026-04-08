'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { AuthContextType, UserProfile } from './types';

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  menuAccess: [],
  projectAccess: [],
  isAdmin: false,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [menuAccess, setMenuAccess] = useState<string[]>([]);
  const [projectAccess, setProjectAccess] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const fetchPermissions = useCallback(
    async (userId: string) => {
      const [profileRes, menuRes, projectRes] = await Promise.all([
        supabase.from('user_profiles').select('*').eq('id', userId).single(),
        supabase.from('user_menu_access').select('menu_key').eq('user_id', userId),
        supabase.from('user_project_access').select('service_id').eq('user_id', userId),
      ]);

      if (profileRes.error) {
        console.error('[AuthProvider] profile fetch error:', profileRes.error);
      }
      if (profileRes.data) {
        setProfile(profileRes.data as UserProfile);
      }

      if (menuRes.data) {
        setMenuAccess(menuRes.data.map((r) => r.menu_key));
      }

      if (projectRes.data) {
        setProjectAccess(projectRes.data.map((r) => r.service_id));
      }
    },
    [supabase],
  );

  useEffect(() => {
    const init = async () => {
      const {
        data: { user: currentUser },
        error,
      } = await supabase.auth.getUser();
      console.log('[AuthProvider] getUser:', currentUser?.email, error?.message);
      setUser(currentUser);
      if (currentUser) {
        await fetchPermissions(currentUser.id);
        console.log('[AuthProvider] permissions loaded');
      }
      setLoading(false);
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const newUser = session?.user ?? null;
      setUser(newUser);
      if (newUser) {
        await fetchPermissions(newUser.id);
      } else {
        setProfile(null);
        setMenuAccess([]);
        setProjectAccess([]);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase, fetchPermissions]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }, [supabase]);

  const isAdmin = profile?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{ user, profile, menuAccess, projectAccess, isAdmin, loading, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
