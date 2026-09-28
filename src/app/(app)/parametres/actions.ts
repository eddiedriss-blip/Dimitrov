"use server";

import { revalidatePath } from "next/cache";
import { getProfil } from "@/lib/auth/profil";
import { LISTES, type SlugListe } from "@/lib/parametres/listes";
import { clientAdministration } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type Resultat = { erreur?: string; succes?: string };
export type EtatFormulaire = { erreur?: string; erreursChamps?: Record<string, string>; ok?: number } | undefined;

const UUID = /^[0-9a-f-]{36}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Toutes les actions des Paramètres exigent un administrateur (la base le vérifie aussi). */
async function exigerAdmin() {
  const profil = await getProfil();
  if (profil.role !== "admin") throw new Error("Réservé aux administrateurs.");
  return profil;
}

function messageErreur(e: { code?: string; message?: string }): string {
  const m = e.message ?? "";
  if (m.includes("Valeur déjà utilisée") || m.includes("au moins un administrateur") || m.includes("code d'une valeur")) return m;
  if (e.code === "23505") {
    if (m.includes("siret")) return "Une entreprise avec ce SIRET existe déjà.";
    if (m.includes("nom")) return "Une valeur avec ce nom existe déjà.";
    return "Cette valeur existe déjà (code ou nom en double).";
  }
  if (e.code === "23503") return "Valeur déjà utilisée : elle ne peut pas être supprimée, désactivez-la.";
  if (e.code === "42501" || m.includes("row-level security")) return "Action réservée aux administrateurs.";
  return "L'opération a échoué. Réessayez.";
}

// ---------------------------------------------------------------- listes déroulantes

function config(slug: string) {
  const c = LISTES[slug as SlugListe];
  if (!c) throw new Error("Liste inconnue.");
  return c;
}

export async function enregistrerValeur(slug: SlugListe, _etat: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  await exigerAdmin();
  const c = config(slug);
  const cle = String(formData.get("__cle") ?? "");
  const creation = !cle;

  const donnees: Record<string, string | number | null> = {};
  const erreursChamps: Record<string, string> = {};
  for (const champ of c.champs) {
    if (!creation && champ.figeApresCreation) continue;
    let v = String(formData.get(champ.nom) ?? "").trim();
    if (champ.majuscules) v = v.toUpperCase();
    if (!v) {
      if (champ.requis) erreursChamps[champ.nom] = `${champ.libelle} : obligatoire.`;
      donnees[champ.nom] = champ.defaut ?? null;
      continue;
    }
    if (champ.max && v.length > champ.max) erreursChamps[champ.nom] = `${champ.max} caractères au plus.`;
    if (champ.motif && !new RegExp(champ.motif).test(v)) erreursChamps[champ.nom] = champ.messageMotif ?? "Format invalide.";
    if (champ.type === "email" && !EMAIL.test(v)) erreursChamps[champ.nom] = "Adresse e-mail invalide.";
    if (champ.options && !champ.options.some((o) => o.valeur === v)) erreursChamps[champ.nom] = "Choix invalide.";
    if (champ.type === "number") {
      if (!/^-?\d{1,4}$/.test(v)) erreursChamps[champ.nom] = "Nombre entier attendu.";
      donnees[champ.nom] = Number(v);
    } else {
      donnees[champ.nom] = v;
    }
  }
  if (Object.keys(erreursChamps).length) return { erreur: "Certains champs sont à corriger.", erreursChamps };

  const supabase = await createClient();
  const requete = creation
    ? supabase.from(c.table).insert(donnees).select(c.cle)
    : supabase.from(c.table).update(donnees).eq(c.cle, cle).select(c.cle);
  const { data, error } = await requete;
  if (error) return { erreur: messageErreur(error) };
  if (!data?.length) return { erreur: "Valeur introuvable." };

  revalidatePath(`/parametres/${slug}`);
  return { ok: Date.now() };
}

export async function changerActivation(slug: SlugListe, cle: string, actif: boolean): Promise<Resultat> {
  await exigerAdmin();
  const c = config(slug);
  const supabase = await createClient();
  const { data, error } = await supabase.from(c.table).update({ actif }).eq(c.cle, cle).select(c.cle);
  if (error) return { erreur: messageErreur(error) };
  if (!data?.length) return { erreur: "Valeur introuvable." };
  revalidatePath(`/parametres/${slug}`);
  return { succes: actif ? "Valeur réactivée." : "Valeur désactivée : elle n'est plus proposée dans les formulaires." };
}

/** Suppression définitive — refusée par la base si la valeur est (ou a été) utilisée. */
export async function supprimerValeur(slug: SlugListe, cle: string): Promise<Resultat> {
  await exigerAdmin();
  const c = config(slug);
  const supabase = await createClient();
  const { data, error } = await supabase.from(c.table).delete().eq(c.cle, cle).select(c.cle);
  if (error) return { erreur: messageErreur(error) };
  if (!data?.length) return { erreur: "Valeur introuvable." };
  revalidatePath(`/parametres/${slug}`);
  return { succes: "Valeur supprimée." };
}

// ---------------------------------------------------------------- utilisateurs

export async function inviterUtilisateur(_etat: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  await exigerAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const prenom = String(formData.get("prenom") ?? "").trim();
  const nom = String(formData.get("nom") ?? "").trim();
  const role = String(formData.get("role") ?? "utilisateur");

  const erreursChamps: Record<string, string> = {};
  if (!EMAIL.test(email)) erreursChamps.email = "Adresse e-mail invalide.";
  if (!prenom) erreursChamps.prenom = "Prénom obligatoire.";
  if (!nom) erreursChamps.nom = "Nom obligatoire.";
  if (!["admin", "utilisateur"].includes(role)) erreursChamps.role = "Rôle invalide.";
  if (Object.keys(erreursChamps).length) return { erreur: "Certains champs sont à corriger.", erreursChamps };

  const administration = clientAdministration();
  if (!administration) {
    return { erreur: "La création de comptes n'est pas encore configurée (clé SUPABASE_SECRET_KEY absente sur le serveur)." };
  }
  const { data, error } = await administration.auth.admin.inviteUserByEmail(email, { data: { prenom, nom } });
  if (error) {
    if (error.code === "email_exists" || error.message.toLowerCase().includes("already")) return { erreur: "Un compte existe déjà avec cette adresse." };
    if (error.code === "over_email_send_rate_limit") return { erreur: "Trop d'e-mails envoyés : réessayez dans quelques minutes." };
    return { erreur: "L'invitation n'a pas pu être envoyée. Vérifiez la configuration des e-mails (SMTP) de Supabase." };
  }

  // Le profil est créé automatiquement (rôle « utilisateur ») ; on applique le rôle choisi.
  if (role === "admin" && data.user) {
    const supabase = await createClient();
    const { error: e } = await supabase.from("utilisateurs").update({ role }).eq("id", data.user.id);
    if (e) return { erreur: `Compte créé, mais le rôle n'a pas pu être appliqué : ${messageErreur(e)}` };
  }

  revalidatePath("/parametres/utilisateurs");
  return { ok: Date.now() };
}

export async function modifierUtilisateur(_etat: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  await exigerAdmin();
  const id = String(formData.get("id") ?? "");
  const prenom = String(formData.get("prenom") ?? "").trim();
  const nom = String(formData.get("nom") ?? "").trim();
  const role = String(formData.get("role") ?? "");
  if (!UUID.test(id)) return { erreur: "Utilisateur introuvable." };

  const erreursChamps: Record<string, string> = {};
  if (!prenom) erreursChamps.prenom = "Prénom obligatoire.";
  if (!nom) erreursChamps.nom = "Nom obligatoire.";
  if (!["admin", "utilisateur"].includes(role)) erreursChamps.role = "Rôle invalide.";
  if (Object.keys(erreursChamps).length) return { erreur: "Certains champs sont à corriger.", erreursChamps };

  const supabase = await createClient();
  const { data, error } = await supabase.from("utilisateurs").update({ prenom, nom, role }).eq("id", id).select("id");
  if (error) return { erreur: messageErreur(error) };
  if (!data?.length) return { erreur: "Utilisateur introuvable." };
  revalidatePath("/parametres/utilisateurs");
  return { ok: Date.now() };
}

export async function changerActivationUtilisateur(id: string, actif: boolean): Promise<Resultat> {
  const profil = await exigerAdmin();
  if (!UUID.test(id)) return { erreur: "Utilisateur introuvable." };
  if (id === profil.id && !actif) return { erreur: "Vous ne pouvez pas désactiver votre propre compte." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("utilisateurs").update({ actif }).eq("id", id).is("anonymise_le", null).select("id");
  if (error) return { erreur: messageErreur(error) };
  if (!data?.length) return { erreur: "Utilisateur introuvable ou anonymisé." };
  revalidatePath("/parametres/utilisateurs");
  return { succes: actif ? "Compte réactivé." : "Compte désactivé : l'accès est coupé dès sa prochaine action." };
}

/** Envoie à l'utilisateur l'e-mail « choisir un nouveau mot de passe ». */
export async function reinitialiserMotDePasse(id: string): Promise<Resultat> {
  await exigerAdmin();
  if (!UUID.test(id)) return { erreur: "Utilisateur introuvable." };
  const supabase = await createClient();
  const { data: u } = await supabase.from("utilisateurs").select("email, actif, anonymise_le").eq("id", id).maybeSingle();
  if (!u || !u.actif || u.anonymise_le) return { erreur: "Compte introuvable ou désactivé." };
  const { error } = await supabase.auth.resetPasswordForEmail(u.email as string);
  if (error) return { erreur: "L'e-mail n'a pas pu être envoyé. Vérifiez la configuration des e-mails (SMTP) de Supabase." };
  return { succes: `E-mail de réinitialisation envoyé à ${u.email}. Le lien est valable 1 heure.` };
}

/** RGPD : efface définitivement nom, prénom et e-mail (l'historique reste rattaché à un profil anonyme). */
export async function anonymiserUtilisateur(id: string): Promise<Resultat> {
  await exigerAdmin();
  if (!UUID.test(id)) return { erreur: "Utilisateur introuvable." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("anonymiser_utilisateur", { p_utilisateur_id: id });
  if (error) return { erreur: error.message.includes("lui-même") ? "Vous ne pouvez pas vous anonymiser vous-même." : messageErreur(error) };
  revalidatePath("/parametres/utilisateurs");
  return { succes: "Compte anonymisé." };
}
