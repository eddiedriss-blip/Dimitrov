"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alerte, BoutonPrincipal, Champ } from "@/components/formulaire";
import { seConnecter } from "../actions";

export function FormulaireConnexion({ suite }: { suite: string }) {
  const [etat, action, enCours] = useActionState(seConnecter, undefined);

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="suite" value={suite} />
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

      <div className="space-y-2">
        <Champ label="Mot de passe" id="mot_de_passe" type="password" autoComplete="current-password" required />
        <div className="text-right">
          <Link
            href="/mot-de-passe-oublie"
            className="text-sm font-medium text-primaire underline-offset-2 hover:underline"
          >
            Mot de passe oublié ?
          </Link>
        </div>
      </div>

      <BoutonPrincipal enCours={enCours}>{enCours ? "Connexion…" : "Se connecter"}</BoutonPrincipal>
    </form>
  );
}
