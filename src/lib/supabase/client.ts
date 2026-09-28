import { createBrowserClient } from "@supabase/ssr";
import { configSupabase } from "./env";

/** Client Supabase pour les composants exécutés dans le navigateur. */
export function createClient() {
  const { url, cle } = configSupabase();
  return createBrowserClient(url, cle);
}
