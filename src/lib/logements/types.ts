/** Ligne de la vue `v_logements` (colonnes utilisées par l'interface). */
export type LigneLogement = {
  id: string;
  numero_esi: string;
  groupe_id: string;
  groupe_code: string;
  groupe_nom: string;
  reservataire_id: string | null;
  reservataire_nom: string | null;
  plafond_code: string | null;
  plafond_libelle: string | null;
  type_logement_code: string;
  type_logement_libelle: string;
  statut_code: CodeStatutLogement;
  statut_libelle: string;
  adresse: string | null;
  batiment: string | null;
  escalier: string | null;
  etage: number | null;
  porte: string | null;
  surface_habitable: number | null;
  loyer: number | null;
  charges: number | null;
  loyer_charges: number | null;
  commentaire: string | null;
  archive: boolean;
  derniere_vacance_id: string | null;
  date_liberation: string | null;
  date_reprise: string | null;
  date_location: string | null;
  nom_ancien_locataire: string | null;
  date_preavis: string | null;
  date_envoi_reservataire: string | null;
  duree_vacance_jours: number | null;
  nb_travaux: number;
  nb_travaux_finis: number;
  /** Pourcentage de travaux finis (null si aucun travail). */
  progression_travaux: number | null;
  /** Durée de la dernière vacance, terminée ou non (jours). */
  duree_derniere_vacance_jours: number | null;
  statut_travaux: CodeStatutTravaux;
  created_at: string;
  updated_at: string;
};

export type ResultatRecherche = { total: number; lignes: LigneLogement[] };

export type CodeStatutLogement =
  | "vacant_technique"
  | "travaux_a_faire"
  | "travaux_commandes"
  | "travaux_finis"
  | "a_louer"
  | "loue";

export type CodeStatutTravaux = "aucun" | "a_commander" | "commande" | "fini";

/** Listes déroulantes, valeurs désactivées comprises (utiles aux filtres et aux fiches existantes). */
export type Referentiels = {
  groupes: { id: string; code: string; nom: string; actif: boolean }[];
  reservataires: { id: string; nom: string; actif: boolean }[];
  plafonds: { code: string; libelle: string; actif: boolean }[];
  types: { code: string; libelle: string; actif: boolean }[];
};

/** Libellé d'une valeur dans une liste de filtre (les valeurs désactivées restent filtrables). */
export const avecEtat = (libelle: string, actif: boolean) => (actif ? libelle : `${libelle} (désactivé)`);

/** Classes Tailwind des badges (fond + texte + bordure). */
export const STATUTS_LOGEMENT: { code: CodeStatutLogement; libelle: string; badge: string }[] = [
  { code: "vacant_technique", libelle: "Vacant technique", badge: "bg-red-50 text-red-700 ring-red-600/20" },
  { code: "travaux_a_faire", libelle: "Travaux à faire", badge: "bg-orange-50 text-orange-800 ring-orange-600/25" },
  { code: "travaux_commandes", libelle: "Travaux commandés", badge: "bg-blue-50 text-blue-700 ring-blue-600/20" },
  { code: "travaux_finis", libelle: "Travaux finis", badge: "bg-green-50 text-green-700 ring-green-600/20" },
  { code: "a_louer", libelle: "À louer", badge: "bg-violet-50 text-violet-700 ring-violet-600/20" },
  { code: "loue", libelle: "Loué", badge: "bg-slate-100 text-slate-600 ring-slate-500/20" },
];

export const STATUTS_TRAVAUX: { code: CodeStatutTravaux; libelle: string; badge: string }[] = [
  { code: "aucun", libelle: "Aucun travaux", badge: "bg-white text-slate-500 ring-slate-300" },
  { code: "a_commander", libelle: "À commander", badge: "bg-orange-50 text-orange-800 ring-orange-600/25" },
  { code: "commande", libelle: "Commandés", badge: "bg-blue-50 text-blue-700 ring-blue-600/20" },
  { code: "fini", libelle: "Finis", badge: "bg-green-50 text-green-700 ring-green-600/20" },
];
