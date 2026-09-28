import { formatDate, formatEtage, formatEuros, formatSurface } from "@/lib/format";
import { STATUTS_LOGEMENT } from "@/lib/logements/types";
import { STATUTS_TRAVAIL } from "@/lib/travaux/types";

/** Ligne de la vue `v_historique` (une ligne par champ modifié). */
export type LigneHistorique = {
  id: number;
  entite: "logement" | "vacance" | "travail" | "photo";
  entite_id: string;
  action: "creation" | "modification" | "suppression";
  champ: string | null;
  ancienne_valeur: unknown;
  nouvelle_valeur: unknown;
  automatique: boolean;
  utilisateur_nom: string | null;
  cree_le: string;
};

export type Categorie = "statut" | "logement" | "vacance" | "travaux" | "photos";

export type Evenement = {
  cle: string;
  date: string;
  utilisateur: string | null;
  automatique: boolean;
  categorie: Categorie;
  titre: string;
  /** Étape clé du cycle de vie (création, statut, travaux ajoutés/commandés/terminés, location). */
  important: boolean;
  details: { libelle: string; avant: string; apres: string }[];
};

/** Noms à afficher à la place des identifiants. */
export type Dictionnaires = {
  groupes: Map<string, string>;
  reservataires: Map<string, string>;
  entreprises: Map<string, string>;
};

const LIBELLES: Record<string, Record<string, string>> = {
  logement: {
    numero_esi: "N° ESI",
    groupe_id: "Groupe",
    type_logement_code: "Type",
    plafond_code: "Plafond",
    reservataire_id: "Réservataire",
    statut_code: "Statut",
    adresse: "Adresse",
    batiment: "Bâtiment",
    escalier: "Escalier",
    etage: "Étage",
    porte: "Porte",
    surface_habitable: "Surface",
    loyer: "Loyer",
    charges: "Charges",
    commentaire: "Commentaire",
  },
  vacance: {
    date_debut: "Date de libération",
    date_disponibilite: "Date de reprise",
    date_fin: "Date de location",
    nom_ancien_locataire: "Ancien locataire",
    date_preavis: "Préavis reçu le",
    date_envoi_reservataire: "Envoi au réservataire",
    motif_depart: "Motif de départ",
    commentaire: "Commentaire",
  },
  travail: {
    libelle: "Intitulé",
    description: "Commentaire",
    entreprise_id: "Entreprise",
    statut_code: "Statut",
    date_commande: "Commandé le",
    date_fin_reelle: "Fini le",
    montant_commande_ht: "Montant HT",
    montant_estime_ht: "Montant estimé HT",
    numero_bon_commande: "N° de bon de commande",
  },
  photo: { legende: "Légende" },
};

const TITRES_STATUT: Record<string, string> = {
  vacant_technique: "Passé en vacant technique",
  travaux_a_faire: "Passé en « Travaux à faire »",
  travaux_commandes: "Passé en « Travaux commandés »",
  travaux_finis: "Passé en « Travaux finis »",
  a_louer: "Passé à louer",
  loue: "Loué — logement archivé",
};

const texte = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));

function formater(entite: string, champ: string, valeur: unknown, d: Dictionnaires): string {
  const v = texte(valeur);
  if (v === null) return "—";
  if (champ === "statut_code") {
    const liste = entite === "travail" ? STATUTS_TRAVAIL : STATUTS_LOGEMENT;
    return liste.find((s) => s.code === v)?.libelle ?? v;
  }
  if (champ === "groupe_id") return d.groupes.get(v) ?? "Groupe inconnu";
  if (champ === "reservataire_id") return d.reservataires.get(v) ?? "Réservataire inconnu";
  if (champ === "entreprise_id") return d.entreprises.get(v) ?? "Entreprise inconnue";
  if (champ.startsWith("date_")) return formatDate(v);
  if (["loyer", "charges", "montant_commande_ht", "montant_estime_ht"].includes(champ)) return formatEuros(v);
  if (champ === "surface_habitable") return formatSurface(v);
  if (champ === "etage") return formatEtage(Number(v));
  return v.length > 120 ? `${v.slice(0, 117)}…` : v;
}

/**
 * Regroupe les lignes brutes en événements lisibles :
 * une même action (même instant, même élément, même utilisateur) = un événement.
 * Les lignes doivent être triées de la plus récente à la plus ancienne.
 */
export function construireEvenements(lignes: LigneHistorique[], d: Dictionnaires): Evenement[] {
  // Intitulé de chaque travail (y compris supprimé), pour nommer ses événements.
  const nomsTravaux = new Map<string, string>();
  for (const l of lignes) {
    if (l.entite !== "travail") continue;
    const valeurs = (l.nouvelle_valeur ?? l.ancienne_valeur) as Record<string, unknown> | null;
    if (l.action !== "modification" && valeurs?.libelle) nomsTravaux.set(l.entite_id, String(valeurs.libelle));
    if (l.champ === "libelle" && !nomsTravaux.has(l.entite_id)) nomsTravaux.set(l.entite_id, String(l.nouvelle_valeur));
  }

  const groupes = new Map<string, LigneHistorique[]>();
  for (const l of lignes) {
    // les photos ajoutées ensemble forment un seul événement
    const element = l.entite === "photo" && l.action === "creation" ? "lot" : l.entite_id;
    const cle = [l.cree_le, l.entite, element, l.action, l.automatique, l.utilisateur_nom].join("|");
    const groupe = groupes.get(cle);
    if (groupe) groupe.push(l);
    else groupes.set(cle, [l]);
  }

  const evenements: Evenement[] = [];
  for (const [cle, groupe] of groupes) {
    const premiere = groupe[0];
    const { entite, action } = premiere;
    const libelles = LIBELLES[entite] ?? {};
    const details = groupe
      .filter((l) => l.champ && libelles[l.champ])
      .sort((a, b) => (a.champ === "statut_code" ? -1 : b.champ === "statut_code" ? 1 : a.id - b.id))
      .map((l) => ({
        libelle: libelles[l.champ!],
        avant: formater(entite, l.champ!, l.ancienne_valeur, d),
        apres: formater(entite, l.champ!, l.nouvelle_valeur, d),
      }));
    const statut = groupe.find((l) => l.champ === "statut_code");
    const nomTravail = `« ${nomsTravaux.get(premiere.entite_id) ?? "travail"} »`;

    let titre = "";
    let categorie: Categorie = "logement";
    let important = false;

    if (entite === "logement") {
      if (action === "creation") {
        const v = premiere.nouvelle_valeur as Record<string, unknown>;
        titre = "Logement créé";
        important = true;
        categorie = "statut";
        details.push({ libelle: "Statut initial", avant: "—", apres: formater("logement", "statut_code", v?.statut_code, d) });
      } else if (statut) {
        titre = TITRES_STATUT[String(statut.nouvelle_valeur)] ?? "Statut modifié";
        important = true;
        categorie = "statut";
      } else {
        titre = "Informations du logement modifiées";
      }
    } else if (entite === "vacance") {
      categorie = "vacance";
      const fin = groupe.find((l) => l.champ === "date_fin");
      if (action === "creation") {
        titre = "Nouvelle vacance ouverte (fiche travaux créée)";
        important = true;
      } else if (fin && fin.nouvelle_valeur && !fin.ancienne_valeur) {
        titre = "Vacance clôturée (logement loué)";
      } else if (fin && !fin.nouvelle_valeur && fin.ancienne_valeur) {
        titre = "Vacance rouverte";
      } else if (action === "suppression") {
        titre = "Vacance supprimée";
      } else {
        titre = "Informations de la vacance modifiées";
      }
    } else if (entite === "travail") {
      categorie = "travaux";
      if (action === "creation") {
        titre = `Travail ajouté : ${nomTravail}`;
        important = true;
      } else if (action === "suppression") {
        titre = `Travail supprimé : ${nomTravail}`;
      } else if (statut) {
        titre =
          statut.nouvelle_valeur === "commande"
            ? `Travail commandé : ${nomTravail}`
            : statut.nouvelle_valeur === "fini"
              ? `Travail terminé : ${nomTravail}`
              : `Travail remis « À commander » : ${nomTravail}`;
        important = statut.nouvelle_valeur !== "a_commander";
      } else {
        titre = `Travail modifié : ${nomTravail}`;
      }
    } else {
      categorie = "photos";
      titre =
        action === "creation"
          ? groupe.length > 1
            ? `${groupe.length} photos ajoutées`
            : "Photo ajoutée"
          : action === "suppression"
            ? "Photo supprimée"
            : "Légende de photo modifiée";
    }

    // une modification sans aucun champ lisible (ex. champ technique) n'est pas affichée
    if (action === "modification" && details.length === 0) continue;

    evenements.push({
      cle,
      date: premiere.cree_le,
      utilisateur: premiere.utilisateur_nom,
      automatique: premiere.automatique,
      categorie,
      titre,
      important,
      details,
    });
  }
  return evenements;
}
