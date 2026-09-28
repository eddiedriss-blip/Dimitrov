"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cheminInterne, erreurMotDePasse, messageErreurAuth } from "@/lib/auth/validation";

export type EtatFormulaire = { erreur?: string; succes?: string; email?: string } | undefined;

const texte = (formData: FormData, cle: string) => String(formData.get(cle) ?? "");

export async function seConnecter(_etat: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const email = texte(formData, "email").trim();
  const motDePasse = texte(formData, "mot_de_passe");
  if (!email || !motDePasse) {
    return { erreur: "Saisissez votre e-mail et votre mot de passe.", email };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: motDePasse });
  if (error) return { erreur: messageErreurAuth(error.code), email };

  const { data: profil } = await supabase
    .from("utilisateurs")
    .select("actif")
    .eq("id", data.user.id)
    .maybeSingle<{ actif: boolean }>();
  if (!profil?.actif) {
    await supabase.auth.signOut({ scope: "local" });
    return { erreur: "Votre compte est désactivé. Contactez un administrateur.", email };
  }

  redirect(cheminInterne(formData.get("suite")));
}

export async function demanderReinitialisation(
  _etat: EtatFormulaire,
  formData: FormData,
): Promise<EtatFormulaire> {
  const email = texte(formData, "email").trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return { erreur: "Saisissez une adresse e-mail valide.", email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error?.code === "over_email_send_rate_limit" || error?.code === "over_request_rate_limit") {
    return { erreur: messageErreurAuth(error.code), email };
  }

  // Même message que le compte existe ou non (ne pas révéler les adresses connues).
  return {
    succes:
      "Si un compte correspond à cette adresse, un e-mail contenant un lien de réinitialisation vient d'être envoyé. Le lien est valable 1 heure.",
  };
}

export async function definirMotDePasse(_etat: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const motDePasse = texte(formData, "mot_de_passe");
  const confirmation = texte(formData, "confirmation");

  const erreur = erreurMotDePasse(motDePasse);
  if (erreur) return { erreur };
  if (motDePasse !== confirmation) return { erreur: "Les deux mots de passe ne correspondent pas." };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) {
    return { erreur: "Le lien a expiré. Refaites une demande de réinitialisation." };
  }

  const { error } = await supabase.auth.updateUser({ password: motDePasse });
  if (error) return { erreur: messageErreurAuth(error.code) };

  redirect("/?info=mot-de-passe-modifie");
}
