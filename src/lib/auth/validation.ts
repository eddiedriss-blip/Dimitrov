/** Longueur minimale, alignée sur `minimum_password_length` (supabase/config.toml). */
export const LONGUEUR_MIN_MOT_DE_PASSE = 10;

/** Règle alignée sur `password_requirements = "letters_digits"` côté Supabase. */
export function erreurMotDePasse(motDePasse: string): string | null {
  if (motDePasse.length < LONGUEUR_MIN_MOT_DE_PASSE) {
    return `Le mot de passe doit contenir au moins ${LONGUEUR_MIN_MOT_DE_PASSE} caractères.`;
  }
  if (!/[a-zA-Z]/.test(motDePasse) || !/\d/.test(motDePasse)) {
    return "Le mot de passe doit contenir au moins une lettre et un chiffre.";
  }
  return null;
}

/** N'accepte qu'un chemin interne (évite les redirections vers un autre site). */
export function cheminInterne(valeur: unknown, defaut = "/"): string {
  if (typeof valeur !== "string" || !valeur.startsWith("/") || valeur.startsWith("//") || valeur.startsWith("/\\")) {
    return defaut;
  }
  return valeur;
}

/** Traduit les codes d'erreur Supabase Auth en messages compréhensibles. */
export function messageErreurAuth(code: string | undefined): string {
  switch (code) {
    case "invalid_credentials":
      return "E-mail ou mot de passe incorrect.";
    case "user_banned":
      return "Votre compte est désactivé. Contactez un administrateur.";
    case "email_not_confirmed":
      return "Votre adresse e-mail n'a pas encore été confirmée.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Trop de tentatives. Patientez quelques minutes avant de réessayer.";
    case "same_password":
      return "Le nouveau mot de passe doit être différent de l'ancien.";
    case "weak_password":
      return "Mot de passe trop faible : au moins 10 caractères, avec des lettres et des chiffres.";
    default:
      return "Le service d'authentification est momentanément indisponible. Réessayez dans un instant.";
  }
}
