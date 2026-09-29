import type { ReactNode } from "react";
import { BadgeStatutTravaux } from "@/components/Badges";
import { formatDate, formatEtage, formatEuros, formatSurface } from "@/lib/format";
import type { LigneLogement } from "@/lib/logements/types";

export function Bloc({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200">
      <h2 className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-900">{titre}</h2>
      <dl className="grid gap-x-6 gap-y-4 p-4 sm:grid-cols-2 lg:grid-cols-3">{children}</dl>
    </section>
  );
}

export function Info({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{libelle}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{children ?? "—"}</dd>
    </div>
  );
}

const jours = (n: number | null) => (n === null ? null : `${n} jour${n > 1 ? "s" : ""}`);

/** Caractéristiques, loyer, dernière vacance et commentaire d'un logement (lecture). */
export function DetailsLogement({ l }: { l: LigneLogement }) {
  return (
    <>
      <Bloc titre="Logement">
        <Info libelle="N° ESI">{l.numero_esi}</Info>
        <Info libelle="Groupe">{l.groupe_nom}</Info>
        <Info libelle="Porte">{l.porte}</Info>
        <Info libelle="Type de logement">{l.type_logement_libelle}</Info>
        <Info libelle="Réservataire">{l.reservataire_nom}</Info>
        <Info libelle="Plafond">{l.plafond_libelle}</Info>
        <Info libelle="Étage">{formatEtage(l.etage)}</Info>
        <Info libelle="Surface habitable">{formatSurface(l.surface_habitable)}</Info>
        <Info libelle="Adresse">{l.adresse}</Info>
        <Info libelle="Bâtiment / escalier">{[l.batiment, l.escalier].filter(Boolean).join(" / ") || null}</Info>
      </Bloc>

      <Bloc titre="Loyer">
        <Info libelle="Loyer">{formatEuros(l.loyer)}</Info>
        <Info libelle="Charges">{formatEuros(l.charges)}</Info>
        <Info libelle="Loyer + charges">
          <strong>{formatEuros(l.loyer_charges)}</strong>
        </Info>
      </Bloc>

      <Bloc titre={l.archive ? "Dernière vacance" : "Vacance en cours"}>
        <Info libelle="Ancien locataire">{l.nom_ancien_locataire}</Info>
        <Info libelle="Préavis reçu le">{formatDate(l.date_preavis)}</Info>
        <Info libelle="Date de libération">{formatDate(l.date_liberation)}</Info>
        <Info libelle="Envoi au réservataire">{formatDate(l.date_envoi_reservataire)}</Info>
        <Info libelle="Date de reprise (prévue)">{formatDate(l.date_reprise)}</Info>
        {l.archive && <Info libelle="Loué le">{formatDate(l.date_location)}</Info>}
        <Info libelle={l.archive ? "Durée de la vacance" : "Durée de vacance (en cours)"}>
          {jours(l.archive ? l.duree_derniere_vacance_jours : l.duree_vacance_jours)}
        </Info>
        <Info libelle="Statut des travaux">
          <BadgeStatutTravaux code={l.statut_travaux} />
          {l.nb_travaux > 0 && <span className="ml-2 text-xs text-slate-500">({l.nb_travaux} travaux)</span>}
        </Info>
      </Bloc>

      <section className="rounded-lg border border-slate-200">
        <h2 className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-900">Commentaire</h2>
        <p className="whitespace-pre-line p-4 text-sm text-slate-700">{l.commentaire || "—"}</p>
      </section>
    </>
  );
}
