import type { ComponentProps, ReactNode } from "react";

/** Champ de saisie des formulaires (logement, travail, paramètres). */
export const classeChampFormulaire =
  "block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 shadow-sm outline-none focus:border-primaire focus:ring-2 focus:ring-primaire/25 disabled:bg-slate-50 disabled:text-slate-500 aria-[invalid=true]:border-red-400 sm:text-sm";

export function Champ({
  label,
  id,
  aide,
  ...props
}: { label: string; id: string; aide?: ReactNode } & ComponentProps<"input">) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        name={id}
        className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-primaire focus:ring-2 focus:ring-primaire/25 sm:text-sm"
        {...props}
      />
      {aide && <p className="text-xs text-slate-500">{aide}</p>}
    </div>
  );
}

export function BoutonPrincipal({ enCours, children }: { enCours?: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={enCours}
      className="flex w-full items-center justify-center rounded-md bg-primaire px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primaire-fonce focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaire disabled:cursor-wait disabled:opacity-70"
    >
      {children}
    </button>
  );
}

export function Alerte({ type, children }: { type: "erreur" | "succes" | "info"; children: ReactNode }) {
  const styles = {
    erreur: "border-red-200 bg-red-50 text-red-800",
    succes: "border-green-200 bg-green-50 text-green-800",
    info: "border-primaire/20 bg-primaire-clair text-primaire-fonce",
  }[type];
  return (
    <div role={type === "erreur" ? "alert" : "status"} className={`rounded-md border px-3 py-2.5 text-sm ${styles}`}>
      {children}
    </div>
  );
}
