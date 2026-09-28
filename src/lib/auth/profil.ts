import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "admin" | "utilisateur";

export type Profil = {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  role: Role;
  actif: boolean;
};

/**
 * Utilisateur connecté + profil (table `utilisateurs`), mis en cache pour la durée d'un rendu.
 * Redirige vers la connexion si la session est absente, et déconnecte un compte désactivé.
 */
export const getProfil = cache(async (): Promise<Profil> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) redirect("/connexion");

  const { data: profil } = await supabase
    .from("utilisateurs")
    .select("id, email, nom, prenom, role, actif")
    .eq("id", id)
    .maybeSingle<Profil>();

  if (!profil?.actif) redirect("/auth/deconnexion?raison=compte-desactive");
  return profil;
});

export const estAdmin = (profil: Profil) => profil.role === "admin";

export function nomAffiche(profil: Pick<Profil, "prenom" | "nom" | "email">) {
  return `${profil.prenom} ${profil.nom}`.trim() || profil.email;
}
