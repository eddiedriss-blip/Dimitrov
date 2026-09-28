import type { Metadata } from "next";
import { Alerte } from "@/components/formulaire";
import { cheminInterne } from "@/lib/auth/validation";
import { CarteAuth } from "../CarteAuth";
import { FormulaireConnexion } from "./FormulaireConnexion";

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
      <FormulaireConnexion suite={cheminInterne(suite)} />
    </CarteAuth>
  );
}
