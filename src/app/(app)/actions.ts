"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Déconnexion de cet appareil uniquement.
 * Appelée par le bouton « Se déconnecter » (formulaire) ou par la surveillance d'inactivité.
 */
export async function seDeconnecter(raison?: unknown) {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect(raison === "inactivite" ? "/connexion?raison=inactivite" : "/connexion");
}
