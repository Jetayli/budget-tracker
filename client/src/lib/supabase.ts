import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Try to get config from Vite env vars (development) or fallback to runtime config
let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
let supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

// Supabase client instance (will be initialized)
let supabaseInstance: SupabaseClient | null = null;

// Function to create/get the Supabase client
function createSupabaseClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
}

// Initialize Supabase - fetches config from server if not available from Vite
export async function initSupabase(): Promise<SupabaseClient> {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  // If we don't have config from Vite, fetch from server
  if (!supabaseUrl || !supabaseAnonKey) {
    try {
      const response = await fetch("/api/config");
      if (response.ok) {
        const config = await response.json();
        supabaseUrl = config.supabaseUrl;
        supabaseAnonKey = config.supabaseAnonKey;
      }
    } catch (error) {
      console.error("Failed to fetch Supabase config from server:", error);
    }
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      "Missing Supabase configuration. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY or configure server environment."
    );
  }

  supabaseInstance = createSupabaseClient(supabaseUrl, supabaseAnonKey);
  return supabaseInstance;
}

// Synchronous getter (returns current instance or creates with available config)
export const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey);

// Export a getter function for components that need the latest instance
export function getSupabase(): SupabaseClient {
  return supabaseInstance || supabase;
}
