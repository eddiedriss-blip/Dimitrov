import Link from "next/link";
import { versUrl, type CleTri, type EtatListe } from "@/lib/logements/recherche";

/** En-tête de colonne d'un tableau : lien de tri si `tri` est fourni, simple libellé sinon. */
export function EnTeteColonne({
  etat,
  chemin,
  tri,
  libelle,
  nombre,
  sticky,
}: {
  etat: EtatListe;
  chemin: string;
  tri?: CleTri;
  libelle: string;
  nombre?: boolean;
  sticky?: boolean;
}) {
  const actif = tri !== undefined && etat.tri === tri;
  const sens = actif && etat.sens === "asc" ? "desc" : "asc";
  return (
    <th
      scope="col"
      aria-sort={tri === undefined ? undefined : actif ? (etat.sens === "asc" ? "ascending" : "descending") : "none"}
      className={`whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-600 ${nombre ? "text-right" : "text-left"} ${sticky ? "sticky left-0 z-10" : ""}`}
    >
      {tri === undefined ? (
        libelle
      ) : (
        <Link
          href={`${chemin}${versUrl(etat, { tri, sens, page: 1 })}`}
          scroll={false}
          className={`group inline-flex items-center gap-1 hover:text-slate-900 ${actif ? "text-primaire" : ""}`}
          title={`Trier par ${libelle.toLowerCase()} (${sens === "asc" ? "croissant" : "décroissant"})`}
        >
          {libelle}
          <span aria-hidden="true" className={actif ? "" : "text-slate-300 group-hover:text-slate-400"}>
            {actif ? (etat.sens === "asc" ? "▲" : "▼") : "↕"}
          </span>
        </Link>
      )}
    </th>
  );
}
