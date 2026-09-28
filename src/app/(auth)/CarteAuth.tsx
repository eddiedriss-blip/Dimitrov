import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";

export function CarteAuth({ titre, sousTitre, children }: { titre: string; sousTitre?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-8">
      <div className="mb-6 flex flex-col items-center text-center text-primaire">
        <Logo taille="grand" />
        <h1 className="mt-6 text-xl font-semibold text-slate-900">{titre}</h1>
        {sousTitre && <p className="mt-2 text-sm text-slate-600">{sousTitre}</p>}
      </div>
      {children}
    </div>
  );
}
