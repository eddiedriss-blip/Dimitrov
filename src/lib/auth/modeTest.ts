import "server-only";

/**
 * Mode test : entrée sans identifiants, via un compte de test partagé.
 * Actif uniquement si les deux variables SERVEUR sont définies (type Secret sur Vercel) ;
 * pour le désactiver, supprimer ces variables et redéployer. Réservé aux données fictives.
 */
export function identifiantsModeTest() {
  const email = process.env.MODE_TEST_EMAIL;
  const motDePasse = process.env.MODE_TEST_MOT_DE_PASSE;
  return email && motDePasse ? { email, motDePasse } : null;
}

export const modeTestActif = () => identifiantsModeTest() !== null;
