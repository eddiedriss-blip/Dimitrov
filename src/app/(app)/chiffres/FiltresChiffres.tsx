"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import { BoutonReinitialiser, classeChamp, Libelle } from "@/components/filtres";
import { NOMS_MOIS, type FiltresChiffres as Filtres } from "@/lib/chiffres/types";
import { avecEtat, type Referentiels } from "@/lib/logements/types";

/**
 * Un seul rang de filtres au-dessus de tout ; ils s'appliquent à tous les chiffres et graphiques.
 * Pendant le rechargement, le contenu précédent reste affiché, estompé (pas de saut de mise en page).
 */
export function FiltresChiffres({
  filtres,
  annees,
  anneeCourante,
  referentiels,
  children,
}: {
  filtres: Filtres;
  annees: number[];
  anneeCourante: number;
  referentiels: Referentiels;
  children: ReactNode;
}) {
  const router = useRouter();
  const chemin = usePathname();
  const [enCours, demarrer] = useTransition();

  const naviguer = (modifs: Partial<Record<keyof Filtres, string | number | null>>) => {
    const f = { ...filtres, ...modifs };
    const p = new URLSearchParams();
    if (f.annee && f.annee !== anneeCourante) p.set("annee", String(f.annee));
    if (f.mois) p.set("mois", String(f.mois));
    if (f.groupe) p.set("groupe", String(f.groupe));
    if (f.type) p.set("type", String(f.type));
    const qs = p.toString();
    demarrer(() => router.replace(`${chemin}${qs ? `?${qs}` : ""}`, { scroll: false }));
  };

  const listeAnnees = annees.includes(filtres.annee) ? annees : [filtres.annee, ...annees];
  const actifs = (filtres.annee !== anneeCourante ? 1 : 0) + [filtres.mois, filtres.groupe, filtres.type].filter(Boolean).length;

  return (
    <>
      <section aria-label="Filtres" className="mb-6 rounded-lg border border-slate-200 bg-slate-50/60 p-3 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
          <div>
            <Libelle htmlFor="f-annee">Année</Libelle>
            <select id="f-annee" value={filtres.annee} onChange={(e) => naviguer({ annee: Number(e.target.value) })} className={classeChamp}>
              {listeAnnees.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Libelle htmlFor="f-mois">Mois</Libelle>
            <select id="f-mois" value={filtres.mois ?? ""} onChange={(e) => naviguer({ mois: e.target.value ? Number(e.target.value) : null })} className={classeChamp}>
              <option value="">Toute l&apos;année</option>
              {NOMS_MOIS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Libelle htmlFor="f-groupe">Groupe</Libelle>
            <select id="f-groupe" value={filtres.groupe ?? ""} onChange={(e) => naviguer({ groupe: e.target.value || null })} className={classeChamp}>
              <option value="">Tous</option>
              {referentiels.groupes.map((g) => (
                <option key={g.id} value={g.id}>
                  {avecEtat(`${g.nom} (${g.code})`, g.actif)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Libelle htmlFor="f-type">Type de logement</Libelle>
            <select id="f-type" value={filtres.type ?? ""} onChange={(e) => naviguer({ type: e.target.value || null })} className={classeChamp}>
              <option value="">Tous</option>
              {referentiels.types.map((t) => (
                <option key={t.code} value={t.code}>
                  {avecEtat(t.libelle, t.actif)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <BoutonReinitialiser onClick={() => naviguer({ annee: anneeCourante, mois: null, groupe: null, type: null })} desactive={actifs === 0} />
          </div>
        </div>
      </section>

      <div aria-busy={enCours} className={`transition-opacity ${enCours ? "opacity-50" : ""}`}>
        {children}
      </div>
    </>
  );
}
