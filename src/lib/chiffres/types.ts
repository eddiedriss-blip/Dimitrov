export type Repartition = { id: string; libelle: string; valeur: number }[];

export type Statistiques = {
  periode: { debut: string; fin: string };
  vacants: {
    actuellement: number;
    periode: number;
    par_groupe: Repartition;
    par_type: Repartition;
    par_statut: Repartition;
  };
  mouvements: { devenus_vacants: number; entrees: number; loues: number; sorties: number };
  travaux: { logements_avec_travaux: number; total: number; a_commander: number; commande: number; fini: number };
  /** 12 mois ; valeurs nulles pour les mois pas encore commencés. */
  mensuel: { mois: number; vacants: number | null; entrees: number | null; sorties: number | null }[];
  annuel: { annee: number; vacants: number; entrees: number; sorties: number }[];
  annees_disponibles: number[];
};

export type FiltresChiffres = { annee: number; mois: number | null; groupe: string | null; type: string | null };

export const NOMS_MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

type Params = Record<string, string | string[] | undefined>;
const premier = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";

/** Filtres de la page lus dans l'URL (valeurs invalides ignorées). */
export function lireFiltres(params: Params, anneeCourante: number): FiltresChiffres {
  const annee = Number(premier(params.annee));
  const mois = Number(premier(params.mois));
  const groupe = premier(params.groupe);
  const type = premier(params.type);
  return {
    annee: Number.isInteger(annee) && annee >= 2000 && annee <= anneeCourante ? annee : anneeCourante,
    mois: Number.isInteger(mois) && mois >= 1 && mois <= 12 ? mois : null,
    groupe: /^[0-9a-f-]{36}$/.test(groupe) ? groupe : null,
    type: /^[A-Za-z0-9]{1,10}$/.test(type) ? type : null,
  };
}
