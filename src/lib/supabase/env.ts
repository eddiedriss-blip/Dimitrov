function lire(nom: string, valeur: string | undefined): string {
  if (!valeur) {
    throw new Error(`Variable d'environnement manquante : ${nom} (voir .env.example).`);
  }
  return valeur;
}

/**
 * Configuration Supabase, lue au moment de l'utilisation (et non au chargement du module) :
 * le build ne dépend pas des variables, seule l'exécution les exige.
 * Références littérales obligatoires : Next.js remplace NEXT_PUBLIC_* à la compilation.
 */
export const configSupabase = () => ({
  url: lire("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  cle: lire("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
});

/** Variables manquantes (vide si tout est configuré) — pour afficher un message clair plutôt qu'une erreur 500. */
export const variablesManquantes = () =>
  [
    ["NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL],
    ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY],
  ]
    .filter(([, valeur]) => !valeur)
    .map(([nom]) => nom as string);
