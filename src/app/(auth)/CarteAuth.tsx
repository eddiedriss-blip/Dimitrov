import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";

export function CarteAuth({ titre, sousTitre, children }: { titre: string; sousTitre?: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-stone-200 bg-white px-6 py-8 shadow-lg shadow-stone-200/60 sm:px-8">
      <div className="mb-6 flex flex-col items-center text-center">
        <Logo taille="grand" />
        <h1 className="mt-6 text-xl font-semibold text-slate-900">{titre}</h1>
        {sousTitre && <p className="mt-2 text-sm text-slate-600">{sousTitre}</p>}
      </div>
      {children}
    </div>
  );
}
