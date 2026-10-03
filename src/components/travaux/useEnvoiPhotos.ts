"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ajouterPhotos } from "@/app/(app)/travaux/actions";
import { preparerPhoto } from "@/lib/photos/preparer";
import { createClient } from "@/lib/supabase/client";
import { BUCKET_PHOTOS } from "@/lib/travaux/types";

export const MAX_PAR_ENVOI = 20;

/**
 * Envoi de photos sur la vacance en cours : redimensionnement dans le navigateur, dépôt dans le Storage,
 * puis enregistrement en base (fichiers retirés du Storage si l'enregistrement échoue).
 * Renvoie le nombre de photos ajoutées.
 */
export function useEnvoiPhotos(logementId: string, vacanceId: string) {
  const router = useRouter();
  const [envoi, setEnvoi] = useState<{ fait: number; total: number } | null>(null);
  const [erreurs, setErreurs] = useState<string[]>([]);

  async function envoyer(liste: File[]): Promise<number> {
    if (envoi) return 0;
    const images = liste.filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    const errs: string[] = [];
    if (images.length < liste.length) errs.push("Seules les images sont acceptées : les autres fichiers ont été ignorés.");
    if (images.length > MAX_PAR_ENVOI) errs.push(`${MAX_PAR_ENVOI} photos maximum par envoi : les suivantes ont été ignorées.`);
    const aTraiter = images.slice(0, MAX_PAR_ENVOI);
    if (!aTraiter.length) {
      setErreurs(errs);
      return 0;
    }

    const supabase = createClient();
    const deposees: { storage_path: string; miniature_path: string }[] = [];
    setErreurs([]);
    setEnvoi({ fait: 0, total: aTraiter.length });

    for (const [i, fichier] of aTraiter.entries()) {
      try {
        const { image, miniature } = await preparerPhoto(fichier);
        const nom = crypto.randomUUID();
        const chemins = {
          storage_path: `${logementId}/${vacanceId}/${nom}.jpg`,
          miniature_path: `${logementId}/${vacanceId}/miniatures/${nom}.jpg`,
        };
        for (const [chemin, contenu] of [[chemins.storage_path, image], [chemins.miniature_path, miniature]] as const) {
          const { error } = await supabase.storage.from(BUCKET_PHOTOS).upload(chemin, contenu, { contentType: "image/jpeg", upsert: false });
          if (error) throw new Error(`${fichier.name} : envoi impossible (${error.message}).`);
        }
        deposees.push(chemins);
      } catch (e) {
        errs.push(e instanceof Error ? e.message : `${fichier.name} : erreur inconnue.`);
      }
      setEnvoi({ fait: i + 1, total: aTraiter.length });
    }

    let ajoutees = deposees.length;
    if (deposees.length) {
      const r = await ajouterPhotos(logementId, deposees);
      if (r.erreur) {
        errs.push(r.erreur);
        ajoutees = 0;
        // pas de fichiers orphelins dans le Storage
        await supabase.storage.from(BUCKET_PHOTOS).remove(deposees.flatMap((d) => [d.storage_path, d.miniature_path]));
      }
    }

    setErreurs(errs);
    setEnvoi(null);
    router.refresh();
    return ajoutees;
  }

  return { envoi, erreurs, envoyer };
}
