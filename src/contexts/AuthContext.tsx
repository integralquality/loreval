import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, SUPABASE_SETUP_MESSAGE } from '../lib/supabase';

export interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
}

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<{ error?: string }>;
  updateUsername: (username: string) => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  updatePassword: (password: string) => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .eq('id', userId)
      .single();
    if (data) setProfile(data);
  }, []);

  useEffect(() => {
    // Without a Supabase project there is no session to restore; the rest of
    // the app (designer, campaign, eval) runs signed-out.
    if (!isSupabaseConfigured) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signUp = async (email: string, password: string) => {
    if (!isSupabaseConfigured) return { error: SUPABASE_SETUP_MESSAGE };
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    return {};
  };

  const signIn = async (email: string, password: string) => {
    if (!isSupabaseConfigured) return { error: SUPABASE_SETUP_MESSAGE };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return {};
  };

  const signOut = async () => {
    if (!isSupabaseConfigured) return;
    await supabase.auth.signOut();
    setProfile(null);
  };

  const deleteAccount = async () => {
    if (!isSupabaseConfigured) return { error: SUPABASE_SETUP_MESSAGE };
    const { error } = await supabase.rpc('delete_own_account');
    if (error) return { error: error.message };
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    return {};
  };

  const resetPassword = async (email: string) => {
    if (!isSupabaseConfigured) return { error: SUPABASE_SETUP_MESSAGE };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return { error: error.message };
    return {};
  };

  const updatePassword = async (password: string) => {
    if (!isSupabaseConfigured) return { error: SUPABASE_SETUP_MESSAGE };
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: error.message };
    return {};
  };

  const updateUsername = async (username: string) => {
    if (!user || !isSupabaseConfigured) return;
    const { error } = await supabase
      .from('profiles')
      .update({ username })
      .eq('id', user.id);
    if (!error) {
      setProfile(prev => prev ? { ...prev, username } : null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signUp, signIn, signOut, deleteAccount, updateUsername, resetPassword, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
