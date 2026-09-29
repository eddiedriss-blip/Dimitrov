"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProfil } from "@/lib/auth/profil";
import { cheminInterne } from "@/lib/auth/validation";
import { FORMAT_ESI, normaliserEsi } from "@/lib/logements/esi";
import { DATE, UUID } from "@/lib/motifs";
import { createClient } from "@/lib/supabase/server";

export type EtatEnregistrement =
  | { erreur?: string; champs?: Record<string, string>; erreursChamps?: Record<string, string> }
  | undefined;

const MESSAGE_FORMAT_ESI = "Format attendu : 5 chiffres, la lettre L, puis 4 chiffres (ex. 12345L0012).";

/** Traduit les erreurs de la base en messages compréhensibles. */
function messageErreurBase(erreur: { code?: string; message?: string }): string {
  const m = erreur.message ?? "";
  if (m.includes("logements_numero_esi_key")) return "Ce N° ESI existe déjà.";
  if (m.includes("logements_numero_esi_check")) return "Le N° ESI est obligatoire.";
  if (m.includes("N° ESI invalide") || m.includes("logements_numero_esi_format")) return MESSAGE_FORMAT_ESI;
  if (m.includes("vacances_sans_chevauchement")) return "La date de libération chevauche une vacance précédente de ce logement.";
  if (m.includes("vacances_dates_coherentes")) return "La date de libération ne peut pas être postérieure à la date de location.";
  if (m.includes("Logement archivé")) return "Ce logement est loué (archivé) : il ne peut plus être modifié.";
  if (erreur.code === "42501" || m.includes("row-level security")) return "Vous n'avez pas les droits pour effectuer cette action.";
  if (erreur.code === "23503") return "Une valeur choisie dans une liste n'existe plus. Rechargez la page.";
  return "L'enregistrement a échoué. Réessayez ou contactez un administrateur.";
}

export async function enregistrerLogement(_etat: EtatEnregistrement, formData: FormData): Promise<EtatEnregistrement> {
  await getProfil();

  const champs: Record<string, string> = {};
  formData.forEach((valeur, cle) => {
    if (typeof valeur === "string" && !cle.startsWith("$")) champs[cle] = valeur.trim();
  });

  const erreursChamps: Record<string, string> = {};
  const texte = (cle: string) => champs[cle] || null;
  const decimal = (cle: string, libelle: string) => {
    const v = champs[cle]?.replace(",", ".");
    if (!v) return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) erreursChamps[cle] = `${libelle} : nombre positif attendu.`;
    return n;
  };
  const entier = (cle: string) => {
    const v = champs[cle];
    if (!v) return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n < -5 || n > 60) erreursChamps[cle] = "Étage : nombre entier attendu (0 = RDC).";
    return n;
  };
  const date = (cle: string) => {
    const v = champs[cle];
    if (!v) return null;
    if (!DATE.test(v)) erreursChamps[cle] = "Date invalide.";
    return v;
  };
  const uuid = (cle: string) => {
    const v = champs[cle];
    return v && UUID.test(v) ? v : null;
  };

  const id = uuid("id");
  const numeroEsi = normaliserEsi(champs.numero_esi ?? "");
  if (!numeroEsi) erreursChamps.numero_esi = "Le N° ESI est obligatoire.";
  else if (!FORMAT_ESI.test(numeroEsi)) erreursChamps.numero_esi = MESSAGE_FORMAT_ESI;
  if (!champs.type_logement_code) erreursChamps.type_logement_code = "Choisissez un type de logement.";

  const logement = {
    numero_esi: numeroEsi,
    // groupe déduit du N° ESI par la base
    type_logement_code: texte("type_logement_code"),
    plafond_code: texte("plafond_code"),
    reservataire_id: uuid("reservataire_id"),
    statut_code: texte("statut_code"),
    adresse: texte("adresse"),
    batiment: texte("batiment"),
    escalier: texte("escalier"),
    etage: entier("etage"),
    // porte déduite du N° ESI par la base
    surface_habitable: decimal("surface_habitable", "Surface"),
    loyer: decimal("loyer", "Loyer"),
    charges: decimal("charges", "Charges"),
    commentaire: texte("commentaire"),
  };
  const vacance = {
    date_debut: date("date_liberation"),
    date_disponibilite: date("date_reprise"),
    nom_ancien_locataire: texte("nom_ancien_locataire"),
    date_preavis: date("date_preavis"),
    date_envoi_reservataire: date("date_envoi_reservataire"),
  };

  if (Object.keys(erreursChamps).length) {
    return { erreur: "Certains champs sont à corriger.", champs, erreursChamps };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("enregistrer_logement", {
    p_id: id,
    p_logement: logement,
    p_vacance: vacance,
  });
  if (error) return { erreur: messageErreurBase(error), champs };

  revalidatePath("/vacants");
  revalidatePath("/archives");
  // Un logement qui reste (ou devient) « Loué » est affiché dans les Archives.
  const fiche = logement.statut_code === "loue" ? "/archives" : "/vacants";
  redirect(`${fiche}/${data as string}?info=${id ? "modifie" : "cree"}`);
}

/** « Travaux finis » → « À louer » (uniquement depuis « Travaux finis »). */
export async function passerALouer(id: string) {
  await getProfil();
  if (!UUID.test(id)) return { erreur: "Logement introuvable." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("logements")
    .update({ statut_code: "a_louer" })
    .eq("id", id)
    .eq("statut_code", "travaux_finis")
    .select("id");
  if (error) return { erreur: messageErreurBase(error) };
  if (!data?.length) return { erreur: "Le logement n'est plus au statut « Travaux finis ». Rechargez la page." };

  revalidatePath("/vacants");
  revalidatePath("/travaux");
  revalidatePath(`/vacants/${id}`);
  revalidatePath(`/travaux/${id}`);
  return { succes: true };
}

/** Archiver = passer au statut « Loué » (la vacance en cours est clôturée par la base). */
export async function archiverLogement(id: string, retour?: string) {
  await getProfil();
  if (!UUID.test(id)) return { erreur: "Logement introuvable." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("logements")
    .update({ statut_code: "loue" })
    .eq("id", id)
    .select("id");
  if (error) return { erreur: messageErreurBase(error) };
  if (!data?.length) return { erreur: "Logement introuvable ou modification non autorisée." };

  revalidatePath("/vacants");
  if (retour) redirect(cheminInterne(retour, "/vacants"));
  return { succes: true };
}
