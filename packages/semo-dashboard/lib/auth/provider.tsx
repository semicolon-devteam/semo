'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
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
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [menuAccess, setMenuAccess] = useState<string[]>([]);
  const [projectAccess, setProjectAccess] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const fetchSession = useCallback(async () => {
    try {
      // 서버 API를 통해 세션 확인 (httpOnly 쿠키를 서버에서 읽음)
      const res = await fetch('/api/auth/me');
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();

      if (data.user) {
        setUser(data.user);
        setProfile(data.profile);
        setMenuAccess(data.menuAccess || []);
        setProjectAccess(data.projectAccess || []);
      }
    } catch (e) {
      console.error('[AuthProvider] session fetch error:', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSession();
  }, [fetchSession]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }, [supabase]);

  const isAdmin = profile?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user: user as AuthContextType['user'],
        profile,
        menuAccess,
        projectAccess,
        isAdmin,
        loading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
