import type { Metadata } from "next";
import { Alerte } from "@/components/formulaire";
import { cheminInterne } from "@/lib/auth/validation";
import { CarteAuth } from "../CarteAuth";
import { modeTestActif } from "@/lib/auth/modeTest";
import { BoutonModeTest, FormulaireConnexion } from "./FormulaireConnexion";

export const metadata: Metadata = { title: "Connexion" };

const MESSAGES: Record<string, { type: "info" | "erreur"; texte: string }> = {
  inactivite: { type: "info", texte: "Vous avez été déconnecté après 30 minutes d'inactivité." },
  "compte-desactive": { type: "erreur", texte: "Votre compte est désactivé. Contactez un administrateur." },
};

export default async function PageConnexion({ searchParams }: PageProps<"/connexion">) {
  const { suite, raison } = await searchParams;
  const message = typeof raison === "string" ? MESSAGES[raison] : undefined;

  return (
    <CarteAuth titre="Connexion" sousTitre="Accès réservé aux personnes habilitées.">
      {message && (
        <div className="mb-5">
          <Alerte type={message.type}>{message.texte}</Alerte>
        </div>
      )}
      {modeTestActif() && (
        <div className="mb-6 space-y-4">
          <BoutonModeTest suite={cheminInterne(suite)} />
          <p className="text-center text-xs text-slate-500">ou avec vos identifiants</p>
        </div>
      )}
      <FormulaireConnexion suite={cheminInterne(suite)} />
    </CarteAuth>
  );
}
