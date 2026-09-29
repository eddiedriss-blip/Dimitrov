"use server";

import { revalidatePath } from "next/cache";
import { getProfil } from "@/lib/auth/profil";
import { DATE, UUID } from "@/lib/motifs";
import { createClient } from "@/lib/supabase/server";
import { STATUTS_LOGEMENT } from "@/lib/logements/types";
import { BUCKET_PHOTOS, NOUVELLE_ENTREPRISE, STATUTS_TRAVAIL } from "@/lib/travaux/types";

export type Resultat = { erreur?: string; succes?: boolean };
export type EtatTravail = { erreur?: string; erreursChamps?: Record<string, string>; ok?: number } | undefined;


function messageErreur(e: { code?: string; message?: string }): string {
  const m = e.message ?? "";
  if (m.includes("travaux_entreprise_si_commande")) return "Choisissez une entreprise avant de passer un travail en « Commandé » ou « Fini ».";
  if (m.includes("entreprises_siret_key")) return "Une entreprise avec ce SIRET existe déjà.";
  if (m.includes("photos_chemin_logement") || m.includes("photos_miniature_chemin")) return "Emplacement de photo invalide.";
  if (m.includes("Logement archivé")) return "Ce logement est loué (archivé) : il ne peut plus être modifié.";
  if (e.code === "42501" || m.includes("row-level security")) return "Vous n'avez pas les droits pour effectuer cette action.";
  return "L'opération a échoué. Réessayez ou contactez un administrateur.";
}

function rafraichir(logementId: string) {
  revalidatePath(`/travaux/${logementId}`);
  revalidatePath("/travaux");
  revalidatePath("/vacants");
}

export async function enregistrerTravail(_etat: EtatTravail, formData: FormData): Promise<EtatTravail> {
  await getProfil();
  const t = (cle: string) => String(formData.get(cle) ?? "").trim();

  const id = t("id");
  const logementId = t("logement_id");
  const vacanceId = t("vacance_id");
  const statut = t("statut_code");
  const erreursChamps: Record<string, string> = {};

  if (!UUID.test(logementId) || !UUID.test(vacanceId)) return { erreur: "Fiche travaux introuvable." };
  if (!t("libelle")) erreursChamps.libelle = "L'intitulé est obligatoire.";
  if (!STATUTS_TRAVAIL.some((s) => s.code === statut)) erreursChamps.statut_code = "Statut invalide.";
  for (const cle of ["date_commande", "date_fin_reelle"]) if (t(cle) && !DATE.test(t(cle))) erreursChamps[cle] = "Date invalide.";
  const montant = t("montant_commande_ht").replace(",", ".");
  if (montant && !(Number(montant) >= 0)) erreursChamps.montant_commande_ht = "Montant positif attendu.";

  let entrepriseId: string | null = t("entreprise_id") || null;
  const nouvelle = t("nouvelle_entreprise");
  if (entrepriseId === NOUVELLE_ENTREPRISE && !nouvelle) erreursChamps.nouvelle_entreprise = "Indiquez le nom de l'entreprise.";
  if (statut !== "a_commander" && !entrepriseId) erreursChamps.entreprise_id = "Entreprise obligatoire pour un travail commandé ou fini.";
  if (Object.keys(erreursChamps).length) return { erreur: "Certains champs sont à corriger.", erreursChamps };

  const supabase = await createClient();

  if (entrepriseId === NOUVELLE_ENTREPRISE) {
    const { data, error } = await supabase.from("entreprises").insert({ raison_sociale: nouvelle }).select("id").single();
    if (error) return { erreur: messageErreur(error) };
    entrepriseId = data.id as string;
  } else if (entrepriseId && !UUID.test(entrepriseId)) {
    entrepriseId = null;
  }

  const travail = {
    libelle: t("libelle"),
    description: t("description") || null,
    entreprise_id: entrepriseId,
    statut_code: statut,
    date_commande: t("date_commande") || null,
    date_fin_reelle: t("date_fin_reelle") || null,
    montant_commande_ht: montant ? Number(montant) : null,
  };

  const { error } = id
    ? await supabase.from("travaux").update(travail).eq("id", id).eq("logement_id", logementId)
    : await supabase.from("travaux").insert({ ...travail, logement_id: logementId, vacance_id: vacanceId });
  if (error) return { erreur: messageErreur(error) };

  rafraichir(logementId);
  return { ok: Date.now() };
}

export async function changerStatutTravail(id: string, logementId: string, statut: string): Promise<Resultat> {
  await getProfil();
  if (!UUID.test(id) || !STATUTS_TRAVAIL.some((s) => s.code === statut)) return { erreur: "Demande invalide." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("travaux").update({ statut_code: statut }).eq("id", id).select("id");
  if (error) return { erreur: messageErreur(error) };
  if (!data?.length) return { erreur: "Travail introuvable ou modification non autorisée." };
  rafraichir(logementId);
  return { succes: true };
}

/** Réservé aux administrateurs (appliqué aussi par la base). */
export async function supprimerTravail(id: string, logementId: string): Promise<Resultat> {
  const profil = await getProfil();
  if (profil.role !== "admin") return { erreur: "Seul un administrateur peut supprimer un travail." };
  if (!UUID.test(id)) return { erreur: "Demande invalide." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("travaux").delete().eq("id", id).select("id");
  if (error) return { erreur: messageErreur(error) };
  if (!data?.length) return { erreur: "Travail introuvable ou suppression non autorisée." };
  rafraichir(logementId);
  return { succes: true };
}

/** Changement manuel du statut du logement (confirmé dans l'interface). */
export async function changerStatutLogement(logementId: string, statut: string): Promise<Resultat> {
  await getProfil();
  if (!UUID.test(logementId) || !STATUTS_LOGEMENT.some((s) => s.code === statut)) return { erreur: "Demande invalide." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("logements").update({ statut_code: statut }).eq("id", logementId).select("id");
  if (error) return { erreur: messageErreur(error) };
  if (!data?.length) return { erreur: "Logement introuvable ou modification non autorisée." };
  rafraichir(logementId);
  revalidatePath(`/vacants/${logementId}`);
  return { succes: true };
}

/** Enregistre les photos déjà déposées dans le Storage par le navigateur. */
export async function ajouterPhotos(
  logementId: string,
  photos: { storage_path: string; miniature_path: string }[],
): Promise<Resultat> {
  await getProfil();
  const valide = (c: string) => typeof c === "string" && c.startsWith(`${logementId}/`) && !c.includes("..");
  if (!UUID.test(logementId) || !photos.length || photos.length > 50 || !photos.every((p) => valide(p.storage_path) && valide(p.miniature_path))) {
    return { erreur: "Demande invalide." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("photos").insert(photos.map((p) => ({ ...p, logement_id: logementId })));
  if (error) return { erreur: messageErreur(error) };
  rafraichir(logementId);
  return { succes: true };
}

export async function modifierLegende(photoId: string, logementId: string, legende: string): Promise<Resultat> {
  await getProfil();
  if (!UUID.test(photoId)) return { erreur: "Demande invalide." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("photos")
    .update({ legende: legende.trim().slice(0, 200) || null })
    .eq("id", photoId)
    .select("id");
  if (error) return { erreur: messageErreur(error) };
  if (!data?.length) return { erreur: "Photo introuvable ou modification non autorisée." };
  rafraichir(logementId);
  return { succes: true };
}

/** Supprime la ligne (journalisée dans l'historique) puis les fichiers du Storage. */
export async function supprimerPhoto(photoId: string, logementId: string): Promise<Resultat> {
  await getProfil();
  if (!UUID.test(photoId)) return { erreur: "Demande invalide." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("photos")
    .delete()
    .eq("id", photoId)
    .select("storage_path, miniature_path");
  if (error) return { erreur: messageErreur(error) };
  const photo = data?.[0] as { storage_path: string; miniature_path: string | null } | undefined;
  if (!photo) return { erreur: "Photo introuvable ou suppression non autorisée." };

  const fichiers = [photo.storage_path, photo.miniature_path].filter((c): c is string => Boolean(c));
  const { error: erreurStockage } = await supabase.storage.from(BUCKET_PHOTOS).remove(fichiers);
  if (erreurStockage) console.error("Fichiers photo non supprimés du Storage :", fichiers, erreurStockage.message);

  rafraichir(logementId);
  return { succes: true };
}
