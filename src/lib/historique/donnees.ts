import "server-only";
import { createClient } from "@/lib/supabase/server";
import { construireEvenements, type Evenement, type LigneHistorique } from "./evenements";

/** Historique lisible d'un logement (le plus récent en premier). */
export async function getEvenements(logementId: string): Promise<Evenement[]> {
  const supabase = await createClient();
  const [historique, groupes, reservataires, entreprises] = await Promise.all([
    supabase
      .from("v_historique")
      .select("id, entite, entite_id, action, champ, ancienne_valeur, nouvelle_valeur, automatique, utilisateur_nom, cree_le")
      .eq("logement_id", logementId)
      .order("cree_le", { ascending: false })
      .order("id", { ascending: false }),
    supabase.from("groupes").select("id, nom"),
    supabase.from("reservataires").select("id, nom"),
    supabase.from("entreprises").select("id, raison_sociale"),
  ]);
  const erreur = historique.error ?? groupes.error ?? reservataires.error ?? entreprises.error;
  if (erreur) throw new Error(`Lecture de l'historique impossible : ${erreur.message}`);

  return construireEvenements((historique.data ?? []) as LigneHistorique[], {
    groupes: new Map((groupes.data ?? []).map((g) => [g.id as string, g.nom as string])),
    reservataires: new Map((reservataires.data ?? []).map((r) => [r.id as string, r.nom as string])),
    entreprises: new Map((entreprises.data ?? []).map((e) => [e.id as string, e.raison_sociale as string])),
  });
}
