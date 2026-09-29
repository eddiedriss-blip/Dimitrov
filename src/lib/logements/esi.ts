/**
 * N° ESI : 5 chiffres (n° de groupe / immeuble) + « L » + 4 chiffres (n° de porte), ex. 12345L0273 = porte 273.
 * Même règle que la base (migrations …_format_esi.sql et …_porte_esi.sql), qui en déduit le groupe et la porte.
 */
export const FORMAT_ESI = /^\d{5}L\d{4}$/;

/** Retire les espaces et met le « l » en majuscule. */
export const normaliserEsi = (valeur: string) => valeur.replace(/\s/g, "").toUpperCase();

/** Code du groupe (5 premiers chiffres) si le N° ESI est complet et valide, sinon null. */
export function codeGroupeEsi(valeur: string): string | null {
  const esi = normaliserEsi(valeur);
  return FORMAT_ESI.test(esi) ? esi.slice(0, 5) : null;
}

/** N° de porte (4 derniers chiffres sans les zéros de tête : 0273 → « 273 ») si le N° ESI est valide, sinon null. */
export function porteEsi(valeur: string): string | null {
  const esi = normaliserEsi(valeur);
  return FORMAT_ESI.test(esi) ? String(Number(esi.slice(6))) : null;
}
