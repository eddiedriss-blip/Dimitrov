export type CodeStatutTravail = "a_commander" | "commande" | "fini";

/** Ligne de la vue `v_travaux`. */
export type Travail = {
  id: string;
  logement_id: string;
  vacance_id: string;
  entreprise_id: string | null;
  entreprise_nom: string | null;
  statut_code: CodeStatutTravail;
  statut_libelle: string;
  libelle: string;
  description: string | null;
  montant_commande_ht: number | null;
  date_commande: string | null;
  date_fin_reelle: string | null;
  created_at: string;
};

export type Photo = {
  id: string;
  legende: string | null;
  storage_path: string;
  miniature_path: string | null;
  created_at: string;
  /** Liens signés temporaires (bucket privé). */
  url: string | null;
  urlMiniature: string | null;
};

export type Entreprise = { id: string; raison_sociale: string };

export const STATUTS_TRAVAIL: { code: CodeStatutTravail; libelle: string; badge: string }[] = [
  { code: "a_commander", libelle: "À commander", badge: "bg-orange-50 text-orange-800 ring-orange-600/25" },
  { code: "commande", libelle: "Commandé", badge: "bg-blue-50 text-blue-700 ring-blue-600/20" },
  { code: "fini", libelle: "Fini", badge: "bg-green-50 text-green-700 ring-green-600/20" },
];

export const BUCKET_PHOTOS = "photos-logements";

/** Valeur de la liste « Entreprise » qui ouvre la saisie d'une nouvelle entreprise. */
export const NOUVELLE_ENTREPRISE = "__nouvelle__";
