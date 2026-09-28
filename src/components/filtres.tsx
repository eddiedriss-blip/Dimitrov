"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { FILTRES, lireEtat, versUrl, type EtatListe, type ParamFiltre } from "@/lib/logements/recherche";

type Valeurs = Record<string, string>;

function versValeurs(etat: EtatListe): Valeurs {
  const v: Valeurs = { q: etat.q, loues: etat.loues ? "1" : "" };
  for (const cle of Object.keys(FILTRES) as ParamFiltre[]) v[cle] = etat.filtres[cle] ?? "";
  return v;
}

/**
 * Filtres d'une liste synchronisés avec l'URL.
 * - saisie texte : mise à jour après 400 ms sans frappe ; listes et dates : immédiate ;
 * - les valeurs locales sont resynchronisées quand l'URL change pour une autre raison
 *   (bouton Retour, lien de tri…), sans écraser ce que l'utilisateur est en train de taper.
 */
export function useFiltresUrl(etat: EtatListe) {
  const router = useRouter();
  const chemin = usePathname();
  const [enCours, demarrer] = useTransition();
  const minuteur = useRef<number | undefined>(undefined);

  const urlCourante = versUrl(etat);
  const [local, setLocal] = useState({ vu: urlCourante, envoye: urlCourante, valeurs: versValeurs(etat) });
  if (local.vu !== urlCourante) {
    setLocal({
      vu: urlCourante,
      envoye: local.envoye,
      valeurs: urlCourante === local.envoye ? local.valeurs : versValeurs(etat),
    });
  }

  useEffect(() => () => window.clearTimeout(minuteur.current), []);

  const naviguer = (valeurs: Valeurs) => {
    const nouvel = lireEtat({ ...valeurs, tri: etat.tri, sens: etat.sens, taille: String(etat.taille) }, etat.tailles);
    const url = versUrl(nouvel);
    setLocal((s) => ({ ...s, envoye: url }));
    demarrer(() => router.replace(`${chemin}${url}`, { scroll: false }));
  };

  const modifier = (nom: string, valeur: string, immediat = false) => {
    const valeurs = { ...local.valeurs, [nom]: valeur };
    setLocal((s) => ({ ...s, valeurs }));
    window.clearTimeout(minuteur.current);
    if (immediat) naviguer(valeurs);
    else minuteur.current = window.setTimeout(() => naviguer(valeurs), 400);
  };

  const reinitialiser = () => {
    window.clearTimeout(minuteur.current);
    const vide = versValeurs(lireEtat({}, etat.tailles));
    setLocal((s) => ({ ...s, valeurs: vide }));
    naviguer(vide);
  };

  return { valeurs: local.valeurs, modifier, reinitialiser, enCours };
}

export const classeChamp =
  "block w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-primaire focus:ring-2 focus:ring-primaire/25";

export function Libelle({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-slate-600">
      {children}
    </label>
  );
}

export function BoutonReinitialiser({ onClick, desactive }: { onClick: () => void; desactive: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desactive}
      className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-primaire hover:bg-primaire-clair disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent"
    >
      Réinitialiser les filtres
    </button>
  );
}

export function AnnonceChargement({ enCours }: { enCours: boolean }) {
  return (
    <p aria-live="polite" className="sr-only">
      {enCours ? "Mise à jour de la liste…" : ""}
    </p>
  );
}
