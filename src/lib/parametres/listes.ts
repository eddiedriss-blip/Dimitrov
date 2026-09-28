/** Configuration des listes déroulantes gérées dans les Paramètres (partagée serveur / navigateur). */

export type Champ = {
  nom: string;
  libelle: string;
  type?: "text" | "number" | "email" | "tel" | "select";
  requis?: boolean;
  max?: number;
  /** Expression régulière de validation (source) et message associé. */
  motif?: string;
  messageMotif?: string;
  options?: { valeur: string; libelle: string }[];
  /** Non modifiable après création (codes repris dans l'historique). */
  figeApresCreation?: boolean;
  majuscules?: boolean;
  /** Valeur enregistrée si le champ est laissé vide (colonne obligatoire en base). */
  defaut?: number;
  /** Affiché comme colonne dans le tableau. */
  colonne?: boolean;
};

export type SlugListe = "groupes" | "reservataires" | "plafonds" | "types" | "entreprises";

export type ConfigListe = {
  slug: SlugListe;
  table: "groupes" | "reservataires" | "plafonds" | "types_logements" | "entreprises";
  titre: string;
  singulier: string;
  /** Colonne identifiant la ligne. */
  cle: "id" | "code";
  ordre: string;
  /** Ce que compte l'usage : logements ou travaux. */
  usage: "logements" | "travaux";
  champs: Champ[];
};

export const CATEGORIES_RESERVATAIRE = [
  { valeur: "prefecture", libelle: "Préfecture" },
  { valeur: "action_logement", libelle: "Action Logement" },
  { valeur: "collectivite", libelle: "Collectivité" },
  { valeur: "bailleur", libelle: "Bailleur" },
  { valeur: "autre", libelle: "Autre" },
];

const CODE = { motif: "^[A-Za-z0-9_-]{1,20}$", messageMotif: "Lettres, chiffres, tiret ou souligné (20 caractères au plus)." };

export const LISTES: Record<SlugListe, ConfigListe> = {
  groupes: {
    slug: "groupes",
    table: "groupes",
    titre: "Groupes",
    singulier: "groupe",
    cle: "id",
    ordre: "nom",
    usage: "logements",
    champs: [
      { nom: "code", libelle: "Code", requis: true, max: 20, ...CODE, majuscules: true, colonne: true },
      { nom: "nom", libelle: "Nom", requis: true, max: 120, colonne: true },
      { nom: "adresse", libelle: "Adresse", max: 200 },
      { nom: "code_postal", libelle: "Code postal", max: 5, motif: "^\\d{5}$", messageMotif: "5 chiffres." },
      { nom: "commune", libelle: "Commune", max: 120, colonne: true },
    ],
  },
  reservataires: {
    slug: "reservataires",
    table: "reservataires",
    titre: "Réservataires",
    singulier: "réservataire",
    cle: "id",
    ordre: "nom",
    usage: "logements",
    champs: [
      { nom: "nom", libelle: "Nom", requis: true, max: 120, colonne: true },
      { nom: "categorie", libelle: "Catégorie", type: "select", requis: true, options: CATEGORIES_RESERVATAIRE, colonne: true },
      { nom: "contact_nom", libelle: "Contact", max: 120, colonne: true },
      { nom: "contact_email", libelle: "E-mail du contact", type: "email", max: 200 },
      { nom: "contact_telephone", libelle: "Téléphone du contact", type: "tel", max: 30 },
    ],
  },
  plafonds: {
    slug: "plafonds",
    table: "plafonds",
    titre: "Plafonds",
    singulier: "plafond",
    cle: "code",
    ordre: "ordre",
    usage: "logements",
    champs: [
      { nom: "code", libelle: "Code", requis: true, max: 20, ...CODE, majuscules: true, figeApresCreation: true, colonne: true },
      { nom: "libelle", libelle: "Libellé", requis: true, max: 200, colonne: true },
      { nom: "ordre", libelle: "Ordre d'affichage", type: "number", defaut: 0, colonne: true },
    ],
  },
  types: {
    slug: "types",
    table: "types_logements",
    titre: "Types de logements",
    singulier: "type de logement",
    cle: "code",
    ordre: "ordre",
    usage: "logements",
    champs: [
      { nom: "code", libelle: "Code", requis: true, max: 20, ...CODE, majuscules: true, figeApresCreation: true, colonne: true },
      { nom: "libelle", libelle: "Libellé", requis: true, max: 120, colonne: true },
      { nom: "nb_pieces", libelle: "Nombre de pièces", type: "number", colonne: true },
      { nom: "ordre", libelle: "Ordre d'affichage", type: "number", defaut: 0 },
    ],
  },
  entreprises: {
    slug: "entreprises",
    table: "entreprises",
    titre: "Entreprises",
    singulier: "entreprise",
    cle: "id",
    ordre: "raison_sociale",
    usage: "travaux",
    champs: [
      { nom: "raison_sociale", libelle: "Raison sociale", requis: true, max: 200, colonne: true },
      { nom: "corps_etat", libelle: "Corps d'état", max: 120, colonne: true },
      { nom: "siret", libelle: "SIRET", max: 14, motif: "^\\d{14}$", messageMotif: "14 chiffres." },
      { nom: "contact_nom", libelle: "Contact", max: 120 },
      { nom: "email", libelle: "E-mail", type: "email", max: 200, colonne: true },
      { nom: "telephone", libelle: "Téléphone", type: "tel", max: 30, colonne: true },
      { nom: "adresse", libelle: "Adresse", max: 200 },
    ],
  },
};

export const ONGLETS_PARAMETRES = [
  { href: "/parametres/utilisateurs", libelle: "Utilisateurs" },
  ...Object.values(LISTES).map((l) => ({ href: `/parametres/${l.slug}`, libelle: l.titre })),
];
