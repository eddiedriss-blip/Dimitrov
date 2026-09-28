"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alerte, BoutonPrincipal, Champ } from "@/components/formulaire";
import { entrerModeTest, seConnecter } from "../actions";

/** Mode test : entrée avec le compte de test partagé (affiché seulement si le mode test est activé côté serveur). */
export function BoutonModeTest({ suite }: { suite: string }) {
  const [etat, action, enCours] = useActionState(entrerModeTest, undefined);

  return (
    <form action={action} className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-4">
      <input type="hidden" name="suite" value={suite} />
      <p className="text-sm text-amber-900">
        <strong>Mode test</strong> : entrée directe avec le compte de test, données fictives uniquement.
      </p>
      {etat?.erreur && <Alerte type="erreur">{etat.erreur}</Alerte>}
      <button
        type="submit"
        disabled={enCours}
        className="flex w-full items-center justify-center rounded-md bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:cursor-wait disabled:opacity-70"
      >
        {enCours ? "Entrée…" : "Entrer en mode test"}
      </button>
    </form>
  );
}

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
