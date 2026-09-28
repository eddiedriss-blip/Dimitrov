import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Déconnexion forcée (compte désactivé détecté pendant le rendu d'une page). */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  const raison = request.nextUrl.searchParams.get("raison") === "compte-desactive" ? "?raison=compte-desactive" : "";
  redirect(`/connexion${raison}`);
}
