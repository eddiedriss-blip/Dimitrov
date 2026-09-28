/** Progression des travaux : « 3/5 terminés — 60 % ». */
export function BarreProgression({ finis, total, grande }: { finis: number; total: number; grande?: boolean }) {
  if (total === 0) return <p className={`${grande ? "text-sm" : "text-xs"} text-slate-500`}>Aucun travail saisi</p>;

  const pourcentage = Math.round((100 * finis) / total);
  const couleur = pourcentage === 100 ? "bg-green-600" : pourcentage > 0 ? "bg-primaire" : "bg-slate-300";

  return (
    <div>
      <div className={`mb-1 flex items-baseline justify-between gap-2 ${grande ? "text-sm" : "text-xs"}`}>
        <span className="text-slate-600">
          {finis}/{total} travaux terminé{finis > 1 ? "s" : ""}
        </span>
        <span className={`font-semibold tabular-nums ${pourcentage === 100 ? "text-green-700" : "text-slate-900"}`}>
          {pourcentage} %
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pourcentage}
        aria-label="Progression des travaux"
        className={`overflow-hidden rounded-full bg-slate-100 ${grande ? "h-3" : "h-2"}`}
      >
        <div className={`h-full rounded-full ${couleur} transition-[width]`} style={{ width: `${pourcentage}%` }} />
      </div>
    </div>
  );
}
