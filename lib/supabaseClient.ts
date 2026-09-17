import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

// Every request needs your current Clerk sign-in attached, or Postgres
// has no identity to check row-level security policies against — that
// was the actual bug: every "is this your own row" check was being
// evaluated with nobody signed in at all, which fails closed rather
// than open.
//
// Clerk attaches the active session to `window.Clerk` once it's loaded.
// accessToken is called fresh on every single request (not just once
// at startup), so this always reflects whoever is actually signed in
// right now, including after switching accounts, without needing to
// rebuild this client.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  accessToken: async () => {
    // Fails safe rather than fails hard: if Clerk isn't fully loaded yet,
    // or getToken() has any hiccup for any reason, this falls back to no
    // token (anon-key-only access) instead of throwing and silently
    // killing every request through this client — including ones, like
    // reading public league schedule data, that never needed a signed-in
    // user at all.
    try {
      // @ts-ignore — Clerk attaches itself to window at runtime, not statically typed here
      return (await window.Clerk?.session?.getToken()) ?? null;
    } catch (err) {
      console.error('[Supabase] Failed to get Clerk token, falling back to anon access:', err);
      return null;
    }
  },
});
