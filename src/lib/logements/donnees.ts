import "server-only";
import { UUID } from "@/lib/motifs";
import { createClient } from "@/lib/supabase/server";
import { filtresSql, TRIS, type EtatListe } from "./recherche";
import type { LigneLogement, Referentiels, ResultatRecherche } from "./types";

export async function rechercherLogements(etat: EtatListe): Promise<ResultatRecherche> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rechercher_logements", {
    p_recherche: etat.q || null,
    p_filtres: filtresSql(etat),
    p_tri: TRIS[etat.tri],
    p_sens: etat.sens,
    p_page: etat.page,
    p_taille: etat.taille,
  });
  if (error) throw new Error(`Recherche des logements impossible : ${error.message}`);
  return data as ResultatRecherche;
}

export async function chargerReferentiels(): Promise<Referentiels> {
  const supabase = await createClient();
  const [groupes, reservataires, plafonds, types] = await Promise.all([
    supabase.from("groupes").select("id, code, nom, actif").order("nom"),
    supabase.from("reservataires").select("id, nom, actif").order("nom"),
    supabase.from("plafonds").select("code, libelle, actif").order("ordre"),
    supabase.from("types_logements").select("code, libelle, actif").order("ordre"),
  ]);
  const erreur = groupes.error ?? reservataires.error ?? plafonds.error ?? types.error;
  if (erreur) throw new Error(`Chargement des listes impossible : ${erreur.message}`);
  return {
    groupes: groupes.data ?? [],
    reservataires: reservataires.data ?? [],
    plafonds: plafonds.data ?? [],
    types: types.data ?? [],
  };
}

export async function getLogement(id: string): Promise<LigneLogement | null> {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("v_logements").select("*").eq("id", id).maybeSingle<LigneLogement>();
  if (error) throw new Error(`Lecture du logement impossible : ${error.message}`);
  return data;
}

export type VacanceResume = {
  id: string;
  date_debut: string;
  date_fin: string | null;
  en_cours: boolean;
  duree_jours: number;
  nb_travaux: number;
  nb_travaux_finis: number;
  montant_commande_ht: number;
};

/** Toutes les vacances successives d'un logement, la plus récente en premier. */
export async function getVacances(logementId: string): Promise<VacanceResume[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_vacances")
    .select("id, date_debut, date_fin, en_cours, duree_jours, nb_travaux, nb_travaux_finis, montant_commande_ht")
    .eq("logement_id", logementId)
    .order("date_debut", { ascending: false });
  if (error) throw new Error(`Lecture des vacances impossible : ${error.message}`);
  return (data ?? []) as VacanceResume[];
}
