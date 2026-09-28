import Link from "next/link";
import { versUrl, type EtatListe } from "@/lib/logements/recherche";
import { SelectTaillePage } from "./SelectTaillePage";

/** Pages affichées : première, dernière, et deux de part et d'autre de la page courante. */
function pagesVisibles(courante: number, derniere: number): (number | "…")[] {
  const pages = new Set([1, derniere, courante - 2, courante - 1, courante, courante + 1, courante + 2]);
  const triees = [...pages].filter((p) => p >= 1 && p <= derniere).sort((a, b) => a - b);
  return triees.flatMap((p, i) => (i > 0 && p - triees[i - 1] > 1 ? ["…" as const, p] : [p]));
}

export function Pagination({
  etat,
  total,
  chemin,
  unite = ["logement", "logements"],
}: {
  etat: EtatListe;
  total: number;
  /** Page de la liste, ex. « /vacants ». */
  chemin: string;
  unite?: [string, string];
}) {
  const derniere = Math.max(1, Math.ceil(total / etat.taille));
  const page = Math.min(etat.page, derniere);
  const debut = total === 0 ? 0 : (page - 1) * etat.taille + 1;
  const fin = Math.min(page * etat.taille, total);
  const lien = (p: number) => `${chemin}${versUrl(etat, { page: p })}`;
  const classeBouton = "rounded-md px-3 py-1.5 text-sm font-medium";

  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4 text-sm text-slate-600">
        <span>
          {debut}–{fin} sur <strong className="text-slate-900">{total}</strong> {total > 1 ? unite[1] : unite[0]}
        </span>
        <SelectTaillePage etat={etat} chemin={chemin} />
      </div>

      {derniere > 1 && (
        <ul className="flex flex-wrap items-center gap-1">
          <li>
            {page > 1 ? (
              <Link href={lien(page - 1)} scroll={false} className={`${classeBouton} text-slate-700 hover:bg-slate-100`}>
                ← Précédent
              </Link>
            ) : (
              <span className={`${classeBouton} text-slate-300`}>← Précédent</span>
            )}
          </li>
          {pagesVisibles(page, derniere).map((p, i) =>
            p === "…" ? (
              <li key={`e${i}`} className="px-1 text-slate-400">
                …
              </li>
            ) : (
              <li key={p}>
                <Link
                  href={lien(p)}
                  scroll={false}
                  aria-current={p === page ? "page" : undefined}
                  className={`${classeBouton} ${p === page ? "bg-primaire text-white" : "text-slate-700 hover:bg-slate-100"}`}
                >
                  {p}
                </Link>
              </li>
            ),
          )}
          <li>
            {page < derniere ? (
              <Link href={lien(page + 1)} scroll={false} className={`${classeBouton} text-slate-700 hover:bg-slate-100`}>
                Suivant →
              </Link>
            ) : (
              <span className={`${classeBouton} text-slate-300`}>Suivant →</span>
            )}
          </li>
        </ul>
      )}
    </nav>
  );
}
