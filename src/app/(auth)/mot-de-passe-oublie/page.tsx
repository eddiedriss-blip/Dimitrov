import type { Metadata } from "next";
import Link from "next/link";
import { Alerte } from "@/components/formulaire";
import { CarteAuth } from "../CarteAuth";
import { FormulaireOubli } from "./FormulaireOubli";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default async function PageMotDePasseOublie({ searchParams }: PageProps<"/mot-de-passe-oublie">) {
  const { erreur } = await searchParams;

  return (
    <CarteAuth
      titre="Mot de passe oublié"
      sousTitre="Indiquez votre adresse e-mail : vous recevrez un lien pour choisir un nouveau mot de passe."
    >
      {erreur === "lien-invalide" && (
        <div className="mb-5">
          <Alerte type="erreur">Ce lien est invalide ou a expiré. Faites une nouvelle demande ci-dessous.</Alerte>
        </div>
      )}
      <FormulaireOubli />
      <p className="mt-6 text-center text-sm">
        <Link href="/connexion" className="font-medium text-primaire underline-offset-2 hover:underline">
          ← Retour à la connexion
        </Link>
      </p>
    </CarteAuth>
  );
}
