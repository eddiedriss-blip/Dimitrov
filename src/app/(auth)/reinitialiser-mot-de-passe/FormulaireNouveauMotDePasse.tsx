"use client";

import { useActionState } from "react";
import { Alerte, BoutonPrincipal, Champ } from "@/components/formulaire";
import { LONGUEUR_MIN_MOT_DE_PASSE } from "@/lib/auth/validation";
import { definirMotDePasse } from "../actions";

export function FormulaireNouveauMotDePasse({ email }: { email?: string }) {
  const [etat, action, enCours] = useActionState(definirMotDePasse, undefined);

  return (
    <form action={action} className="space-y-5" noValidate>
      {/* aide les gestionnaires de mots de passe à associer le nouveau mot de passe au bon compte */}
      <input type="email" name="identifiant" autoComplete="username" value={email ?? ""} readOnly hidden />
      {etat?.erreur && <Alerte type="erreur">{etat.erreur}</Alerte>}
      <Champ
        label="Nouveau mot de passe"
        id="mot_de_passe"
        type="password"
        autoComplete="new-password"
        minLength={LONGUEUR_MIN_MOT_DE_PASSE}
        required
        autoFocus
        aide={`Au moins ${LONGUEUR_MIN_MOT_DE_PASSE} caractères, avec au moins une lettre et un chiffre.`}
      />
      <Champ label="Confirmer le mot de passe" id="confirmation" type="password" autoComplete="new-password" required />
      <BoutonPrincipal enCours={enCours}>{enCours ? "Enregistrement…" : "Enregistrer le mot de passe"}</BoutonPrincipal>
    </form>
  );
}
