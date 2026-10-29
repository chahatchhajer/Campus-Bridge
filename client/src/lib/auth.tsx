import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { demoMode, supabase, supabaseConfigured } from './supabase';

type AuthState = {
  status: 'loading' | 'signed-in' | 'signed-out';
  email: string | null;
  isDemo: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase) && !demoMode);

  useEffect(() => {
    if (!supabase || demoMode) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Authentication is not configured.');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Authentication is not configured.');
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw new Error(error.message);
    return { needsConfirmation: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthState>(() => {
    if (demoMode) {
      return { status: 'signed-in', email: 'demo@campus-bridge.invalid', isDemo: true, configured: true, signIn, signUp, signOut };
    }
    return {
      status: loading ? 'loading' : session ? 'signed-in' : 'signed-out',
      email: session?.user.email ?? null,
      isDemo: false,
      configured: supabaseConfigured,
      signIn,
      signUp,
      signOut,
    };
  }, [loading, session, signIn, signUp, signOut]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();
  if (auth.status === 'loading') return <div className="boot" role="status" aria-label="Loading your workspace" />;
  if (auth.status === 'signed-out') return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}
