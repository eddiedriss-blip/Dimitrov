/**
 * Logo provisoire (pictogramme + nom de l'application).
 * À remplacer par le logo du bailleur : déposer le fichier dans /public et l'afficher ici.
 */
export function Logo({ variante = "bleu", taille = "normal" }: { variante?: "bleu" | "blanc"; taille?: "normal" | "grand" }) {
  const fond = variante === "blanc" ? "#ffffff" : "#1d4e89";
  const trait = variante === "blanc" ? "#1d4e89" : "#ffffff";
  const cote = taille === "grand" ? 48 : 32;

  return (
    <span className="inline-flex items-center gap-3">
      <svg width={cote} height={cote} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
        <rect width="32" height="32" rx="6" fill={fond} />
        <path d="M16 6 5 15h3v10h6v-6h4v6h6V15h3z" fill={trait} />
      </svg>
      <span className={`font-semibold leading-tight ${taille === "grand" ? "text-2xl" : "text-lg"}`}>
        Logements vacants
      </span>
    </span>
  );
}
