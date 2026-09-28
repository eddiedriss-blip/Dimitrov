"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ONGLETS_PARAMETRES } from "@/lib/parametres/listes";

export function OngletsParametres() {
  const chemin = usePathname();
  return (
    <nav aria-label="Rubriques des paramètres" className="mb-6 overflow-x-auto border-b border-slate-200">
      <ul className="flex gap-1">
        {ONGLETS_PARAMETRES.map((o) => {
          const actif = chemin === o.href;
          return (
            <li key={o.href}>
              <Link
                href={o.href}
                aria-current={actif ? "page" : undefined}
                className={`block whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium ${
                  actif ? "border-primaire text-primaire" : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
                }`}
              >
                {o.libelle}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
