import type { Metadata } from "next";
import { getProfil } from "@/lib/auth/profil";
import { cleSecreteConfiguree } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { GestionUtilisateurs, type CompteUtilisateur } from "./GestionUtilisateurs";

export const metadata: Metadata = { title: "Paramètres — Utilisateurs" };

export default async function PageUtilisateurs() {
  const [profil, supabase] = await Promise.all([getProfil(), createClient()]);
  const { data, error } = await supabase
    .from("utilisateurs")
    .select("id, email, nom, prenom, role, actif, anonymise_le, created_at")
    .order("nom")
    .order("prenom");
  if (error) throw new Error(`Lecture des utilisateurs impossible : ${error.message}`);

  return <GestionUtilisateurs comptes={(data ?? []) as CompteUtilisateur[]} moi={profil.id} creationPossible={cleSecreteConfiguree()} />;
}
