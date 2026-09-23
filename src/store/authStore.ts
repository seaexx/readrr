import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  username: string;
  email: string;
  avatar_url: string | null;
  city: string | null;
  bio: string | null;
  location?: unknown; // PostGIS geography (opaque on the client)
  avg_rating: number;
  total_swaps: number;
  created_at: string;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  hasPosted: boolean | null;
  setSession: (session: Session | null) => void;
  setUser: (user: User | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  setHasPosted: (hasPosted: boolean | null) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  profile: null,
  loading: true,
  hasPosted: null,
  setSession: (session) => set({ session, user: session?.user ?? null }),
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading }),
  setHasPosted: (hasPosted) => set({ hasPosted }),
  reset: () => set({ session: null, user: null, profile: null, loading: false, hasPosted: null }),
}));
