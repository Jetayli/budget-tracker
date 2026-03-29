import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { User, Session, AuthError, SupabaseClient } from "@supabase/supabase-js";
import { initSupabase, getSupabase } from "@/lib/supabase";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [supabase, setSupabaseClient] = useState<SupabaseClient | null>(null);

  useEffect(() => {
    // Initialize Supabase (may fetch config from server in production)
    initSupabase().then((client) => {
      setSupabaseClient(client);

      // Get initial session
      client.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      });

      // Listen for auth changes
      const {
        data: { subscription },
      } = client.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      });

      return () => subscription.unsubscribe();
    });
  }, []);

  const signUp = async (email: string, password: string) => {
    const client = supabase || getSupabase();
    const { error } = await client.auth.signUp({
      email,
      password,
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const client = supabase || getSupabase();
    const { error } = await client.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    const client = supabase || getSupabase();
    await client.auth.signOut();
    setUser(null);
    setSession(null);
  };

  const getAccessToken = async () => {
    const client = supabase || getSupabase();
    const { data: { session } } = await client.auth.getSession();
    return session?.access_token ?? null;
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    getAccessToken,
  };

  // Show loading state while initializing Supabase
  if (!supabase && loading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

