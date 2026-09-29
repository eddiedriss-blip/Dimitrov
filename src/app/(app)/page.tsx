import type { Metadata } from "next";
import Link from "next/link";
import { BadgeStatutLogement, BadgeStatutTravaux } from "@/components/Badges";
import { Alerte } from "@/components/formulaire";
import { TitrePage } from "@/components/Page";
import { getProfil } from "@/lib/auth/profil";
import { formatDate } from "@/lib/format";
import { rechercherLogements } from "@/lib/logements/donnees";
import { STATUTS_LOGEMENT, type CodeStatutLogement } from "@/lib/logements/types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Accueil" };

const NB_RECENTS = 10;

/** Nombre de logements par statut (les loués compris, pour la carte « Archives »). */
async function compterParStatut(): Promise<Record<CodeStatutLogement, number>> {
  const supabase = await createClient();
  const comptes = await Promise.all(
    STATUTS_LOGEMENT.map((s) => supabase.from("logements").select("id", { count: "exact", head: true }).eq("statut_code", s.code)),
  );
  const erreur = comptes.find((c) => c.error)?.error;
  if (erreur) throw new Error(`Comptage des logements impossible : ${erreur.message}`);
  return Object.fromEntries(STATUTS_LOGEMENT.map((s, i) => [s.code, comptes[i].count ?? 0])) as Record<CodeStatutLogement, number>;
}

export default async function PageAccueil({ searchParams }: PageProps<"/">) {
  const [profil, { info }, parStatut, recents] = await Promise.all([
    getProfil(),
    searchParams,
    compterParStatut(),
    // Derniers logements devenus vacants (hors loués)
    rechercherLogements({ q: "", filtres: {}, loues: false, tri: "liberation", sens: "desc", page: 1, taille: NB_RECENTS, tailles: [NB_RECENTS] }),
  ]);

  const vacants = STATUTS_LOGEMENT.filter((s) => s.code !== "loue").reduce((n, s) => n + parStatut[s.code], 0);

  return (
    <>
      {info === "mot-de-passe-modifie" && (
        <div className="mb-6">
          <Alerte type="succes">Votre mot de passe a bien été modifié.</Alerte>
        </div>
      )}
      <TitrePage titre={profil.prenom ? `Bonjour ${profil.prenom}` : "Accueil"} description="Vue d'ensemble des logements vacants." />

      <section aria-labelledby="titre-statuts" className="mb-8">
        <h2 id="titre-statuts" className="mb-3 text-base font-semibold text-slate-900">
          {vacants} logement{vacants > 1 ? "s" : ""} vacant{vacants > 1 ? "s" : ""}
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {STATUTS_LOGEMENT.map((s) => (
            <li key={s.code}>
              <Link
                href={s.code === "loue" ? "/archives" : `/vacants?statut=${s.code}`}
                className="flex h-full flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-primaire/40 hover:shadow-md"
              >
                <span className="text-2xl font-semibold tabular-nums text-slate-900">{parStatut[s.code]}</span>
                <span className="mt-2">
                  <BadgeStatutLogement code={s.code} />
                </span>
                {s.code === "loue" && <span className="mt-1 text-xs text-slate-500">dans les Archives</span>}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="titre-recents">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="titre-recents" className="text-base font-semibold text-slate-900">
            Derniers logements vacants
          </h2>
          <div className="flex gap-4 text-sm">
            <Link href="/vacants/nouveau" className="font-medium text-primaire hover:underline">
              + Créer un logement
            </Link>
            <Link href="/vacants" className="font-medium text-primaire hover:underline">
              Tout voir →
            </Link>
          </div>
        </div>

        {recents.lignes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 px-6 py-12 text-center text-sm text-slate-500">
            Aucun logement vacant pour le moment.{" "}
            <Link href="/vacants/nouveau" className="font-medium text-primaire hover:underline">
              Créer un logement
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {recents.lignes.map((l) => (
              <li key={l.id}>
                <Link href={`/vacants/${l.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-slate-50">
                  <span className="min-w-[7.5rem] font-semibold text-slate-900">{l.numero_esi}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-600">
                    {l.groupe_nom} · porte {l.porte ?? "—"} · {l.type_logement_code}
                  </span>
                  <span className="text-xs text-slate-500">libéré le {formatDate(l.date_liberation)}</span>
                  <span className="flex gap-2">
                    <BadgeStatutLogement code={l.statut_code} />
                    <BadgeStatutTravaux code={l.statut_travaux} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
