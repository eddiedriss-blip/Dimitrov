"use client";

import { useRouter } from "next/navigation";
import { versUrl, type EtatListe } from "@/lib/logements/recherche";

export function SelectTaillePage({ etat, chemin }: { etat: EtatListe; chemin: string }) {
  const router = useRouter();
  return (
    <label className="inline-flex items-center gap-2">
      <span>Par page</span>
      <select
        value={etat.taille}
        onChange={(e) => router.replace(`${chemin}${versUrl(etat, { taille: Number(e.target.value), page: 1 })}`, { scroll: false })}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
      >
        {etat.tailles.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );
}
