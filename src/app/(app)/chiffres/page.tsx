import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BadgeStatutLogement } from "@/components/Badges";
import { Barres, type LigneBarre } from "@/components/graphiques/Barres";
import { CarteGraphique } from "@/components/graphiques/CarteGraphique";
import { Colonnes } from "@/components/graphiques/Colonnes";
import { Tuile } from "@/components/graphiques/Tuile";
import { TitrePage } from "@/components/Page";
import { anneeCourante, getStatistiques } from "@/lib/chiffres/donnees";
import { lireFiltres, MOIS_COURTS, NOMS_MOIS, type Repartition } from "@/lib/chiffres/types";
import { formatDate } from "@/lib/format";
import { chargerReferentiels } from "@/lib/logements/donnees";
import type { CodeStatutLogement } from "@/lib/logements/types";
import { FiltresChiffres } from "./FiltresChiffres";

export const metadata: Metadata = { title: "Chiffres" };

const SERIE_VACANTS = { nom: "Logements vacants", classeCouleur: "bg-serie-1" };
const SERIE_ENTREES = { nom: "Entrées en vacance", classeCouleur: "bg-serie-1" };
const SERIE_SORTIES = { nom: "Sorties de vacance", classeCouleur: "bg-serie-2" };

const tiret = (v: number | null) => (v === null ? "—" : v);

function Section({ titre, children, note }: { titre: string; children: ReactNode; note?: ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">{titre}</h2>
      {note && <p className="-mt-2 mb-3 text-xs text-slate-500">{note}</p>}
      {children}
    </section>
  );
}

const lignesRepartition = (r: Repartition, libelle?: (id: string, texte: string) => ReactNode): LigneBarre[] =>
  r.map((x) => ({ cle: x.id, texte: x.libelle, libelle: libelle ? libelle(x.id, x.libelle) : x.libelle, valeur: x.valeur }));

export default async function PageChiffres({ searchParams }: PageProps<"/chiffres">) {
  const annee = anneeCourante();
  const filtres = lireFiltres(await searchParams, annee);
  const [s, referentiels] = await Promise.all([getStatistiques(filtres), chargerReferentiels()]);

  const libellePeriode = filtres.mois ? `${NOMS_MOIS[filtres.mois - 1]} ${filtres.annee}` : `l'année ${filtres.annee}`;
  const pctFinis = s.travaux.total ? Math.round((100 * s.travaux.fini) / s.travaux.total) : null;

  const mois = s.mensuel.map((m) => m.mois - 1);
  const annees = s.annuel.map((a) => String(a.annee));

  return (
    <>
      <TitrePage titre="Chiffres" description="Indicateurs de vacance, de travaux et de mouvements." />

      <FiltresChiffres filtres={filtres} annees={s.annees_disponibles} anneeCourante={annee} referentiels={referentiels}>
        <p className="mb-6 text-sm text-slate-600">
          Période : du <strong>{formatDate(s.periode.debut)}</strong> au <strong>{formatDate(s.periode.fin)}</strong>
          {filtres.groupe || filtres.type ? " · filtres groupe / type appliqués à tous les chiffres" : ""}
        </p>

        <Section titre="Logements vacants">
          <div className="grid gap-4 sm:grid-cols-2">
            <Tuile principal libelle="Logements vacants aujourd'hui" valeur={s.vacants.actuellement} detail="Vacance en cours, quel que soit le statut" />
            <Tuile libelle={`Logements vacants sur ${libellePeriode}`} valeur={s.vacants.periode} detail="Au moins un jour de vacance dans la période" />
          </div>
        </Section>

        <Section titre="Entrées et sorties" note={`Sur ${libellePeriode}.`}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tuile libelle="Logements devenus vacants" valeur={s.mouvements.devenus_vacants} detail="Logements distincts" />
            <Tuile libelle="Logements loués" valeur={s.mouvements.loues} detail="Logements distincts" />
            <Tuile libelle="Entrées en vacance" valeur={s.mouvements.entrees} detail="Nombre de mouvements" />
            <Tuile libelle="Sorties de vacance" valeur={s.mouvements.sorties} detail="Nombre de mouvements (relocations)" />
          </div>
        </Section>

        <Section titre="Travaux" note={`Travaux des logements vacants sur ${libellePeriode}, selon leur statut actuel.`}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tuile libelle="Logements avec travaux" valeur={s.travaux.logements_avec_travaux} detail={`${s.travaux.total} travaux au total`} />
            <Tuile libelle="Travaux à commander" valeur={s.travaux.a_commander} />
            <Tuile libelle="Travaux commandés" valeur={s.travaux.commande} />
            <Tuile libelle="Travaux terminés" valeur={s.travaux.fini} detail={pctFinis === null ? undefined : `${pctFinis} % des travaux`} />
          </div>
        </Section>

        <Section titre={`Évolution mensuelle — ${filtres.annee}`} note={filtres.mois ? `Le mois sélectionné (${NOMS_MOIS[filtres.mois - 1]}) est mis en gras.` : undefined}>
          <div className="grid gap-4 lg:grid-cols-2">
            <CarteGraphique
              titre="Logements vacants par mois"
              sousTitre="Logements ayant été vacants au moins un jour dans le mois"
              tableau={{ colonnes: ["Mois", "Logements vacants"], lignes: s.mensuel.map((m) => [NOMS_MOIS[m.mois - 1], tiret(m.vacants)]) }}
            >
              <Colonnes
                categories={mois.map((i) => MOIS_COURTS[i])}
                libellesComplets={mois.map((i) => `${NOMS_MOIS[i]} ${filtres.annee}`)}
                series={[{ ...SERIE_VACANTS, valeurs: s.mensuel.map((m) => m.vacants) }]}
                surligne={filtres.mois ? filtres.mois - 1 : null}
              />
            </CarteGraphique>
            <CarteGraphique
              titre="Entrées et sorties de vacance par mois"
              legende={[SERIE_ENTREES, SERIE_SORTIES]}
              tableau={{ colonnes: ["Mois", "Entrées", "Sorties"], lignes: s.mensuel.map((m) => [NOMS_MOIS[m.mois - 1], tiret(m.entrees), tiret(m.sorties)]) }}
            >
              <Colonnes
                categories={mois.map((i) => MOIS_COURTS[i])}
                libellesComplets={mois.map((i) => `${NOMS_MOIS[i]} ${filtres.annee}`)}
                series={[
                  { ...SERIE_ENTREES, valeurs: s.mensuel.map((m) => m.entrees) },
                  { ...SERIE_SORTIES, valeurs: s.mensuel.map((m) => m.sorties) },
                ]}
                surligne={filtres.mois ? filtres.mois - 1 : null}
              />
            </CarteGraphique>
          </div>
        </Section>

        <Section titre="Évolution annuelle">
          <div className="grid gap-4 lg:grid-cols-2">
            <CarteGraphique
              titre="Logements vacants par année"
              sousTitre="Logements ayant été vacants au moins un jour dans l'année"
              tableau={{ colonnes: ["Année", "Logements vacants"], lignes: s.annuel.map((a) => [String(a.annee), a.vacants]) }}
            >
              <Colonnes categories={annees} series={[{ ...SERIE_VACANTS, valeurs: s.annuel.map((a) => a.vacants) }]} surligne={annees.indexOf(String(filtres.annee))} />
            </CarteGraphique>
            <CarteGraphique
              titre="Entrées et sorties de vacance par année"
              legende={[SERIE_ENTREES, SERIE_SORTIES]}
              tableau={{ colonnes: ["Année", "Entrées", "Sorties"], lignes: s.annuel.map((a) => [String(a.annee), a.entrees, a.sorties]) }}
            >
              <Colonnes
                categories={annees}
                series={[
                  { ...SERIE_ENTREES, valeurs: s.annuel.map((a) => a.entrees) },
                  { ...SERIE_SORTIES, valeurs: s.annuel.map((a) => a.sorties) },
                ]}
                surligne={annees.indexOf(String(filtres.annee))}
              />
            </CarteGraphique>
          </div>
        </Section>

        <Section titre="Répartitions" note={`Logements vacants sur ${libellePeriode}.`}>
          <div className="grid gap-4 lg:grid-cols-3">
            <CarteGraphique
              titre="Par groupe"
              tableau={{ colonnes: ["Groupe", "Logements"], lignes: s.vacants.par_groupe.map((x) => [x.libelle, x.valeur]) }}
            >
              <Barres lignes={lignesRepartition(s.vacants.par_groupe)} />
            </CarteGraphique>
            <CarteGraphique
              titre="Par type de logement"
              tableau={{ colonnes: ["Type", "Logements"], lignes: s.vacants.par_type.map((x) => [x.libelle, x.valeur]) }}
            >
              <Barres lignes={lignesRepartition(s.vacants.par_type)} />
            </CarteGraphique>
            <CarteGraphique
              titre="Par statut"
              sousTitre="Statut actuel des logements"
              tableau={{ colonnes: ["Statut", "Logements"], lignes: s.vacants.par_statut.map((x) => [x.libelle, x.valeur]) }}
            >
              <Barres lignes={lignesRepartition(s.vacants.par_statut, (id) => <BadgeStatutLogement code={id as CodeStatutLogement} />)} />
            </CarteGraphique>
          </div>
        </Section>

        <details className="rounded-lg border border-slate-200 p-4 text-sm text-slate-600">
          <summary className="cursor-pointer font-medium text-slate-900">Comment ces chiffres sont-ils calculés ?</summary>
          <ul className="mt-3 list-inside list-disc space-y-1">
            <li>Un logement est « vacant sur une période » s&apos;il a été vacant au moins un jour pendant cette période (de la date de libération jusqu&apos;à la veille de la location).</li>
            <li>« Devenus vacants » et « loués » comptent des logements distincts ; « entrées » et « sorties de vacance » comptent des mouvements : un logement libéré deux fois dans l&apos;année compte deux entrées.</li>
            <li>Une sortie de vacance correspond à une location (passage au statut « Loué »).</li>
            <li>Les travaux sont ceux des vacances de la période, comptés selon leur statut actuel.</li>
            <li>Les mois à venir ne sont pas comptés. Les logements enregistrés directement comme loués (sans vacance) n&apos;apparaissent pas.</li>
          </ul>
        </details>
      </FiltresChiffres>
    </>
  );
}
