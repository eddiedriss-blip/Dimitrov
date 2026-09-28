/**
 * État de la liste (recherche, filtres, tri, page) ↔ paramètres d'URL.
 * L'URL est la source de vérité : la liste est partageable et le bouton « Retour » fonctionne.
 */

export const TAILLES_PAGE = [25, 50, 100] as const;
/** Grilles de cartes : multiples de 2, 3 et 4 colonnes. */
export const TAILLES_CARTES = [24, 48, 96] as const;

/** Paramètre d'URL → clé attendue par la fonction SQL `rechercher_logements`. */
export const FILTRES = {
  esi: "numero_esi",
  statut: "statut_code",
  travaux: "statut_travaux",
  groupe: "groupe_id",
  reservataire: "reservataire_id",
  plafond: "plafond_code",
  type: "type_logement_code",
  etage: "etage",
  surface_min: "surface_min",
  surface_max: "surface_max",
  lc_min: "loyer_charges_min",
  lc_max: "loyer_charges_max",
  preavis_du: "date_preavis_du",
  preavis_au: "date_preavis_au",
  envoi_du: "date_envoi_du",
  envoi_au: "date_envoi_au",
  reprise_du: "date_reprise_du",
  reprise_au: "date_reprise_au",
  loue_du: "date_location_du",
  loue_au: "date_location_au",
} as const;

export type ParamFiltre = keyof typeof FILTRES;

/** Colonnes triables : paramètre d'URL `tri` → colonne SQL. */
export const TRIS = {
  esi: "numero_esi",
  groupe: "groupe_nom",
  reservataire: "reservataire_nom",
  envoi: "date_envoi_reservataire",
  reprise: "date_reprise",
  plafond: "plafond_code",
  locataire: "nom_ancien_locataire",
  type: "type_logement_code",
  etage: "etage",
  surface: "surface_habitable",
  loyer: "loyer",
  charges: "charges",
  loyer_charges: "loyer_charges",
  preavis: "date_preavis",
  travaux: "statut_travaux_ordre",
  statut: "statut_ordre",
  commentaire: "commentaire",
  progression: "progression_travaux",
  liberation: "date_liberation",
  loue_le: "date_location",
  duree: "duree_derniere_vacance_jours",
} as const;

export type CleTri = keyof typeof TRIS;

export type EtatListe = {
  q: string;
  filtres: Partial<Record<ParamFiltre, string>>;
  loues: boolean;
  tri: CleTri;
  sens: "asc" | "desc";
  page: number;
  taille: number;
  /** Tailles de page proposées ; la première est la valeur par défaut (omise dans l'URL). */
  tailles: readonly number[];
};

type Params = Record<string, string | string[] | undefined>;
const premier = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";

const VALIDATEURS: Partial<Record<ParamFiltre, RegExp>> = {
  esi: /^.{1,30}$/,
  groupe: /^[0-9a-f-]{36}$/,
  reservataire: /^([0-9a-f-]{36}|aucun)$/,
  etage: /^-?\d{1,3}$/,
  surface_min: /^\d+([.,]\d+)?$/,
  surface_max: /^\d+([.,]\d+)?$/,
  lc_min: /^\d+([.,]\d+)?$/,
  lc_max: /^\d+([.,]\d+)?$/,
  preavis_du: /^\d{4}-\d{2}-\d{2}$/,
  preavis_au: /^\d{4}-\d{2}-\d{2}$/,
  envoi_du: /^\d{4}-\d{2}-\d{2}$/,
  envoi_au: /^\d{4}-\d{2}-\d{2}$/,
  reprise_du: /^\d{4}-\d{2}-\d{2}$/,
  reprise_au: /^\d{4}-\d{2}-\d{2}$/,
  loue_du: /^\d{4}-\d{2}-\d{2}$/,
  loue_au: /^\d{4}-\d{2}-\d{2}$/,
};

export function lireEtat(params: Params, tailles: readonly number[] = TAILLES_PAGE): EtatListe {
  const filtres: EtatListe["filtres"] = {};
  for (const cle of Object.keys(FILTRES) as ParamFiltre[]) {
    const valeur = premier(params[cle]);
    if (valeur && (!VALIDATEURS[cle] || VALIDATEURS[cle].test(valeur))) filtres[cle] = valeur.replace(",", ".");
  }
  const tri = premier(params.tri);
  const taille = Number(premier(params.taille));
  return {
    q: premier(params.q).slice(0, 100),
    filtres,
    loues: premier(params.loues) === "1",
    tri: tri in TRIS ? (tri as CleTri) : "esi",
    sens: premier(params.sens) === "desc" ? "desc" : "asc",
    page: Math.max(1, Math.floor(Number(premier(params.page))) || 1),
    taille: tailles.includes(taille) ? taille : tailles[0],
    tailles,
  };
}

/** Construit la query string ; les valeurs par défaut sont omises pour garder des URL courtes. */
export function versUrl(etat: EtatListe, modifs: Partial<EtatListe> = {}): string {
  const e = { ...etat, ...modifs };
  const p = new URLSearchParams();
  if (e.q) p.set("q", e.q);
  for (const [cle, valeur] of Object.entries(e.filtres)) if (valeur) p.set(cle, valeur);
  if (e.loues) p.set("loues", "1");
  if (e.tri !== "esi") p.set("tri", e.tri);
  if (e.sens !== "asc") p.set("sens", e.sens);
  if (e.page > 1) p.set("page", String(e.page));
  if (e.taille !== e.tailles[0]) p.set("taille", String(e.taille));
  const qs = p.toString();
  return qs ? `?${qs}` : "";
}

export const nbFiltresActifs = (etat: EtatListe) =>
  Object.values(etat.filtres).filter(Boolean).length + (etat.q ? 1 : 0) + (etat.loues ? 1 : 0);

/** Filtres au format attendu par `rechercher_logements`. */
export function filtresSql(etat: EtatListe): Record<string, string | boolean> {
  const sql: Record<string, string | boolean> = {};
  for (const [cle, valeur] of Object.entries(etat.filtres)) if (valeur) sql[FILTRES[cle as ParamFiltre]] = valeur;
  if (etat.loues) sql.inclure_loues = true;
  return sql;
}
