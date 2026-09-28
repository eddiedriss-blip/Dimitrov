import { STATUTS_LOGEMENT, STATUTS_TRAVAUX, type CodeStatutLogement, type CodeStatutTravaux } from "@/lib/logements/types";
import { STATUTS_TRAVAIL as STATUTS_TRAVAIL_UNITAIRE, type CodeStatutTravail } from "@/lib/travaux/types";

const base = "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset";

export function BadgeStatutLogement({ code }: { code: CodeStatutLogement }) {
  const s = STATUTS_LOGEMENT.find((x) => x.code === code);
  return <span className={`${base} ${s?.badge ?? ""}`}>{s?.libelle ?? code}</span>;
}

export function BadgeStatutTravaux({ code }: { code: CodeStatutTravaux }) {
  const s = STATUTS_TRAVAUX.find((x) => x.code === code);
  return <span className={`${base} ${s?.badge ?? ""}`}>{s?.libelle ?? code}</span>;
}

export function BadgeStatutTravail({ code }: { code: CodeStatutTravail }) {
  const s = STATUTS_TRAVAIL_UNITAIRE.find((x) => x.code === code);
  return <span className={`${base} ${s?.badge ?? ""}`}>{s?.libelle ?? code}</span>;
}
