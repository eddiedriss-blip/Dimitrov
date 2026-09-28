import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

/**
 * Client Supabase avec la clé SECRÈTE (service_role) : réservé aux opérations
 * d'administration des comptes (invitation). Serveur uniquement, jamais exposé au navigateur.
 * Retourne null si la clé n'est pas configurée (variable SUPABASE_SECRET_KEY).
 */
export function clientAdministration() {
  const cle = process.env.SUPABASE_SECRET_KEY;
  if (!cle) return null;
  return createClient(SUPABASE_URL, cle, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const cleSecreteConfiguree = () => Boolean(process.env.SUPABASE_SECRET_KEY);
