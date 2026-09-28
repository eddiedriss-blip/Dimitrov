import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { configSupabase } from "./env";

/**
 * Client Supabase côté serveur (Server Components, Server Actions, Route Handlers).
 * À créer à chaque requête : ne jamais le partager entre requêtes.
 */
export async function createClient() {
  const cookieStore = await cookies();

  const { url, cle } = configSupabase();

  return createServerClient(url, cle, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Appelé depuis un Server Component (cookies en lecture seule) :
          // sans conséquence, le proxy rafraîchit la session à chaque requête.
        }
      },
    },
  });
}
