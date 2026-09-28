"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Alerte } from "@/components/formulaire";
import { preparerPhoto } from "@/lib/photos/preparer";
import { createClient } from "@/lib/supabase/client";
import { BUCKET_PHOTOS, type Photo } from "@/lib/travaux/types";
import { ajouterPhotos } from "@/app/(app)/travaux/actions";
import { Galerie } from "./Galerie";

const MAX_PAR_ENVOI = 20;

export function Photos({
  photos,
  logementId,
  vacanceId,
  lectureSeule,
}: {
  photos: Photo[];
  logementId: string;
  vacanceId: string;
  /** Archives : consultation et galerie uniquement. */
  lectureSeule?: boolean;
}) {
  const router = useRouter();
  const selecteur = useRef<HTMLInputElement>(null);
  const [envoi, setEnvoi] = useState<{ fait: number; total: number } | null>(null);
  const [erreurs, setErreurs] = useState<string[]>([]);
  const [survol, setSurvol] = useState(false);
  const [ouverte, setOuverte] = useState<number | null>(null);

  async function envoyer(liste: File[]) {
    if (envoi) return;
    const images = liste.filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    const errs: string[] = [];
    if (images.length < liste.length) errs.push("Seules les images sont acceptées : les autres fichiers ont été ignorés.");
    if (images.length > MAX_PAR_ENVOI) errs.push(`${MAX_PAR_ENVOI} photos maximum par envoi : les suivantes ont été ignorées.`);
    const aTraiter = images.slice(0, MAX_PAR_ENVOI);
    if (!aTraiter.length) {
      setErreurs(errs);
      return;
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

    if (deposees.length) {
      const r = await ajouterPhotos(logementId, deposees);
      if (r.erreur) {
        errs.push(r.erreur);
        // pas de fichiers orphelins dans le Storage
        await supabase.storage.from(BUCKET_PHOTOS).remove(deposees.flatMap((d) => [d.storage_path, d.miniature_path]));
      }
    }

    setErreurs(errs);
    setEnvoi(null);
    router.refresh();
  }

  return (
    <section aria-labelledby="titre-photos" className="rounded-lg border border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <h2 id="titre-photos" className="text-base font-semibold text-slate-900">
          Photos <span className="font-normal text-slate-500">({photos.length})</span>
        </h2>
        {!lectureSeule && (
        <button
          type="button"
          onClick={() => selecteur.current?.click()}
          disabled={!!envoi}
          className="rounded-md bg-primaire px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primaire-fonce disabled:opacity-70"
        >
          + Ajouter des photos
        </button>
        )}
        <input
          ref={selecteur}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple
          hidden
          onChange={(e) => {
            void envoyer(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>

      <div
        className={`p-4 ${survol ? "bg-primaire-clair" : ""}`}
        onDragOver={(e) => {
          if (lectureSeule) return;
          e.preventDefault();
          setSurvol(true);
        }}
        onDragLeave={() => setSurvol(false)}
        onDrop={(e) => {
          if (lectureSeule) return;
          e.preventDefault();
          setSurvol(false);
          void envoyer(Array.from(e.dataTransfer.files));
        }}
      >
        {envoi && (
          <div className="mb-4">
            <Alerte type="info">
              Envoi des photos… {envoi.fait}/{envoi.total}
            </Alerte>
          </div>
        )}
        {erreurs.length > 0 && (
          <div className="mb-4">
            <Alerte type="erreur">
              <ul className="list-inside list-disc space-y-0.5">
                {erreurs.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </Alerte>
          </div>
        )}

        {photos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-500">
            {lectureSeule ? "Aucune photo." : "Aucune photo. Utilisez « Ajouter des photos » ou glissez-déposez vos images ici."}
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {photos.map((p, i) => (
              <li key={p.id}>
                <figure>
                  <button
                    type="button"
                    onClick={() => setOuverte(i)}
                    className="block aspect-[4/3] w-full overflow-hidden rounded-md bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaire"
                    aria-label={`Agrandir ${p.legende ? `« ${p.legende} »` : `la photo ${i + 1}`}`}
                  >
                    {/* Liens signés d'un bucket privé : pas d'optimisation next/image */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.urlMiniature ?? undefined} alt="" loading="lazy" className="h-full w-full object-cover transition hover:scale-105" />
                  </button>
                  <figcaption className={`mt-1 truncate text-xs ${p.legende ? "text-slate-700" : "text-slate-400"}`} title={p.legende ?? undefined}>
                    {p.legende ?? "Sans légende"}
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        )}
        {!lectureSeule && <p className="mt-3 text-xs text-slate-500">
          JPEG, PNG ou WebP · jusqu&apos;à {MAX_PAR_ENVOI} photos à la fois · redimensionnées automatiquement avant l&apos;envoi.
        </p>}
      </div>

      {ouverte !== null && (
        <Galerie
          photos={photos}
          index={ouverte}
          logementId={logementId}
          lectureSeule={lectureSeule}
          onChangerIndex={setOuverte}
          onFermer={() => setOuverte(null)}
        />
      )}
    </section>
  );
}
