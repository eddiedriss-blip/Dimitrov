import "server-only";
import { getLogement } from "@/lib/logements/donnees";
import { createClient } from "@/lib/supabase/server";
import { BUCKET_PHOTOS, type Entreprise, type Photo, type Travail } from "./types";

/** Durée de validité des liens d'affichage des photos (bucket privé). */
const DUREE_LIENS_S = 60 * 60;

type ClientSupabase = Awaited<ReturnType<typeof createClient>>;

/** Liens d'affichage temporaires pour des fichiers du bucket privé des photos (chemin → lien). */
async function signerChemins(supabase: ClientSupabase, chemins: string[]): Promise<Map<string, string>> {
  const liens = new Map<string, string>();
  if (!chemins.length) return liens;
  const { data, error } = await supabase.storage.from(BUCKET_PHOTOS).createSignedUrls(chemins, DUREE_LIENS_S);
  if (error) throw new Error(`Liens des photos impossibles : ${error.message}`);
  for (const l of data ?? []) if (l.path && l.signedUrl) liens.set(l.path, l.signedUrl);
  return liens;
}

export type ApercuPhoto = { id: string; legende: string | null; url: string };

/**
 * Aperçu des photos de plusieurs vacances (cartes « Travaux des vacants ») :
 * les `max` premières miniatures de chacune, en une requête et une signature groupée.
 */
export async function getApercusPhotos(vacanceIds: string[], max = 6): Promise<Record<string, ApercuPhoto[]>> {
  if (!vacanceIds.length) return {};
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("photos")
    .select("id, vacance_id, legende, storage_path, miniature_path")
    .in("vacance_id", vacanceIds)
    .order("created_at");
  if (error) throw new Error(`Lecture des photos impossible : ${error.message}`);

  const parVacance = new Map<string, NonNullable<typeof data>>();
  for (const p of data ?? []) {
    const liste = parVacance.get(p.vacance_id) ?? [];
    if (liste.length < max) parVacance.set(p.vacance_id, [...liste, p]);
  }
  const retenues = [...parVacance.values()].flat();
  const liens = await signerChemins(supabase, retenues.map((p) => p.miniature_path ?? p.storage_path));

  const apercus: Record<string, ApercuPhoto[]> = {};
  for (const [vacanceId, liste] of parVacance) {
    apercus[vacanceId] = liste.flatMap((p) => {
      const url = liens.get(p.miniature_path ?? p.storage_path);
      return url ? [{ id: p.id, legende: p.legende, url }] : [];
    });
  }
  return apercus;
}

/**
 * Fiche travaux d'un logement = sa dernière vacance (en cours, ou la dernière si le logement est loué),
 * avec ses travaux et ses photos. Les infos du logement (N° ESI, groupe, étage, type) sont lues en direct.
 */
export async function getFicheTravaux(logementId: string) {
  const logement = await getLogement(logementId);
  if (!logement) return null;
  const vacanceId = logement.derniere_vacance_id;
  if (!vacanceId) return { logement, travaux: [] as Travail[], photos: [] as Photo[] };

  const supabase = await createClient();
  const [travaux, photos] = await Promise.all([
    supabase.from("v_travaux").select("*").eq("vacance_id", vacanceId).order("created_at"),
    supabase
      .from("photos")
      .select("id, legende, storage_path, miniature_path, created_at")
      .eq("vacance_id", vacanceId)
      .order("created_at"),
  ]);
  if (travaux.error) throw new Error(`Lecture des travaux impossible : ${travaux.error.message}`);
  if (photos.error) throw new Error(`Lecture des photos impossible : ${photos.error.message}`);

  const lignesPhotos = (photos.data ?? []) as Omit<Photo, "url" | "urlMiniature">[];
  const liens = await signerChemins(
    supabase,
    lignesPhotos.flatMap((p) => [p.storage_path, p.miniature_path].filter((c): c is string => Boolean(c))),
  );

  return {
    logement,
    travaux: (travaux.data ?? []) as Travail[],
    photos: lignesPhotos.map((p) => ({
      ...p,
      url: liens.get(p.storage_path) ?? null,
      urlMiniature: (p.miniature_path && liens.get(p.miniature_path)) || liens.get(p.storage_path) || null,
    })),
  };
}

export async function chargerEntreprises(): Promise<Entreprise[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entreprises")
    .select("id, raison_sociale")
    .eq("actif", true)
    .order("raison_sociale");
  if (error) throw new Error(`Chargement des entreprises impossible : ${error.message}`);
  return data ?? [];
}
