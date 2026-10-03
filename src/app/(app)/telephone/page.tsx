import type { Metadata } from "next";
import Link from "next/link";
import { BadgeStatutLogement } from "@/components/Badges";
import { rechercherLogements } from "@/lib/logements/donnees";

export const metadata: Metadata = { title: "Téléphone" };

const NB_RESULTATS = 30;

/** Écran Téléphone : retrouver un logement (ou en créer un) pour y ajouter photos et infos sur le terrain. */
export default async function PageTelephone({ searchParams }: PageProps<"/telephone">) {
  const { q } = await searchParams;
  const recherche = typeof q === "string" ? q.trim().slice(0, 100) : "";
  const resultat = await rechercherLogements({
    q: recherche,
    filtres: {},
    loues: false,
    // Sans recherche : les derniers logements devenus vacants
    tri: recherche ? "esi" : "liberation",
    sens: recherche ? "asc" : "desc",
    page: 1,
    taille: NB_RESULTATS,
    tailles: [NB_RESULTATS],
  });

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold text-slate-900">Téléphone</h1>
      <p className="mt-1 text-sm text-slate-600">Choisissez un logement pour ajouter des photos et des infos.</p>

      <Link
        href="/telephone/nouveau"
        className="mt-5 flex w-full items-center justify-center rounded-xl bg-primaire px-4 py-4 text-base font-semibold text-white shadow-sm active:bg-primaire-fonce"
      >
        + Nouveau logement
      </Link>

      <form role="search" className="mt-5 flex gap-2">
        <label htmlFor="q" className="sr-only">
          Rechercher un logement
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={recherche}
          placeholder="N° ESI, ancien locataire…"
          autoComplete="off"
          enterKeyHint="search"
          className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none focus:border-primaire focus:ring-2 focus:ring-primaire/25"
        />
        <button type="submit" className="rounded-xl bg-anthracite px-4 text-base font-semibold text-white active:bg-black">
          OK
        </button>
      </form>

      <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {recherche ? `${resultat.total} résultat${resultat.total > 1 ? "s" : ""}` : "Derniers logements vacants"}
      </h2>

      {resultat.lignes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
          {recherche ? "Aucun logement trouvé. Vérifiez le N° ESI ou créez le logement." : "Aucun logement vacant pour le moment."}
        </p>
      ) : (
        <ul className="space-y-2">
          {resultat.lignes.map((l) => (
            <li key={l.id}>
              <Link
                href={`/telephone/${l.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm active:bg-slate-50"
              >
                <span className="min-w-0">
                  <span className="block font-semibold text-slate-900">{l.numero_esi}</span>
                  <span className="block truncate text-sm">
                    {l.nom_ancien_locataire ? (
                      <strong className="text-slate-800">{l.nom_ancien_locataire}</strong>
                    ) : (
                      <span className="text-slate-400">Ancien locataire non renseigné</span>
                    )}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <BadgeStatutLogement code={l.statut_code} />
                  <span aria-hidden="true" className="text-xl text-slate-400">
                    ›
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
