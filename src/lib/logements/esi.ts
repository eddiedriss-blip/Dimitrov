/**
 * N° ESI : 5 chiffres (n° de groupe / immeuble) + « L » + 4 chiffres (n° de logement), ex. 12345L0012.
 * Même règle que la base (migration …_format_esi.sql), qui déduit le groupe des 5 premiers chiffres.
 */
export const FORMAT_ESI = /^\d{5}L\d{4}$/;

/** Retire les espaces et met le « l » en majuscule. */
export const normaliserEsi = (valeur: string) => valeur.replace(/\s/g, "").toUpperCase();

/** Code du groupe (5 premiers chiffres) si le N° ESI est complet et valide, sinon null. */
export function codeGroupeEsi(valeur: string): string | null {
  const esi = normaliserEsi(valeur);
  return FORMAT_ESI.test(esi) ? esi.slice(0, 5) : null;
}
