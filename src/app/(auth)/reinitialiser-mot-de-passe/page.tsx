import type { Metadata } from "next";
import Link from "next/link";
import { Alerte } from "@/components/formulaire";
import { createClient } from "@/lib/supabase/server";
import { CarteAuth } from "../CarteAuth";
import { FormulaireNouveauMotDePasse } from "./FormulaireNouveauMotDePasse";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

/** Atteinte via le lien de l'e-mail (/auth/confirm ouvre une session temporaire). */
export default async function PageReinitialisation() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email as string | undefined;

  if (!data?.claims?.sub) {
    return (
      <CarteAuth titre="Lien expiré">
        <Alerte type="erreur">
          Ce lien de réinitialisation est invalide ou a expiré. Vous pouvez en demander un nouveau.
        </Alerte>
        <p className="mt-6 text-center text-sm">
          <Link href="/mot-de-passe-oublie" className="font-medium text-primaire underline-offset-2 hover:underline">
            Demander un nouveau lien
          </Link>
        </p>
      </CarteAuth>
    );
  }

  return (
    <CarteAuth titre="Choisir un nouveau mot de passe" sousTitre={email ? <>Compte : {email}</> : undefined}>
      <FormulaireNouveauMotDePasse email={email} />
    </CarteAuth>
  );
}
