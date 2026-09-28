import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { FiltresChiffres, Statistiques } from "./types";

export async function getStatistiques(f: FiltresChiffres): Promise<Statistiques> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("statistiques", {
    p_annee: f.annee,
    p_mois: f.mois,
    p_groupe: f.groupe,
    p_type: f.type,
  });
  if (error) throw new Error(`Calcul des statistiques impossible : ${error.message}`);
  return data as Statistiques;
}

/** Année en cours à Paris (et non en UTC, pour la nuit du 31 décembre). */
export const anneeCourante = () =>
  Number(new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", year: "numeric" }).format(new Date()));
