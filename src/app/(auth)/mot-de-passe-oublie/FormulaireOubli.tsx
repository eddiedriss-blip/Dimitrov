"use client";

import { useActionState } from "react";
import { Alerte, BoutonPrincipal, Champ } from "@/components/formulaire";
import { demanderReinitialisation } from "../actions";

export function FormulaireOubli() {
  const [etat, action, enCours] = useActionState(demanderReinitialisation, undefined);

  if (etat?.succes) return <Alerte type="succes">{etat.succes}</Alerte>;

  return (
    <form action={action} className="space-y-5" noValidate>
      {etat?.erreur && <Alerte type="erreur">{etat.erreur}</Alerte>}
      <Champ
        label="E-mail"
        id="email"
        type="email"
        autoComplete="username"
        inputMode="email"
        required
        defaultValue={etat?.email}
        autoFocus
      />
      <BoutonPrincipal enCours={enCours}>{enCours ? "Envoi…" : "Recevoir le lien"}</BoutonPrincipal>
    </form>
  );
}
