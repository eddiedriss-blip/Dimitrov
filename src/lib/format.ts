const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const nombre = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

export const formatEuros = (v: number | string | null | undefined) =>
  v === null || v === undefined || v === "" ? "—" : euros.format(Number(v));

export const formatSurface = (v: number | string | null | undefined) =>
  v === null || v === undefined || v === "" ? "—" : `${nombre.format(Number(v))} m²`;

const dateParis = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric" });

/**
 * Date → 'JJ/MM/AAAA'.
 * - date seule 'AAAA-MM-JJ' : reformatée telle quelle (aucun décalage de fuseau) ;
 * - horodatage (created_at…) : date à l'heure de Paris.
 */
export const formatDate = (v: string | null | undefined) => {
  if (!v) return "—";
  if (v.length > 10) return dateParis.format(new Date(v));
  const [a, m, j] = v.split("-");
  return `${j}/${m}/${a}`;
};

const dateHeureParis = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Horodatage → 'JJ/MM/AAAA à HH:MM' (heure de Paris). */
export const formatDateHeure = (v: string | null | undefined) => (v ? dateHeureParis.format(new Date(v)).replace(" ", " à ") : "—");

export const formatEtage = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : v === 0 ? "RDC" : String(v);
