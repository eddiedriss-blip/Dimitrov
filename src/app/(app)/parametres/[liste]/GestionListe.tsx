"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { BoutonsDialogue, Dialogue } from "@/components/Dialogue";
import { Alerte, classeChampFormulaire } from "@/components/formulaire";
import { envoyerSansReinitialiser } from "@/lib/formulaires";
import { LISTES, type SlugListe } from "@/lib/parametres/listes";
import { changerActivation, enregistrerValeur, supprimerValeur, type Resultat } from "../actions";

export type LigneListe = { cle: string; actif: boolean; valeurs: Record<string, string>; usages: number };


/** Ajouter / modifier / désactiver / supprimer (si jamais utilisée) les valeurs d'une liste déroulante. */
export function GestionListe({ slug, lignes }: { slug: SlugListe; lignes: LigneListe[] }) {
  const c = LISTES[slug];
  const [edition, setEdition] = useState<{ ligne?: LigneListe } | null>(null);
  const [confirmation, setConfirmation] = useState<{ type: "desactiver" | "reactiver" | "supprimer"; ligne: LigneListe } | null>(null);
  const [message, setMessage] = useState<{ type: "succes" | "erreur"; texte: string }>();
  const [recherche, setRecherche] = useState("");
  const [enCours, demarrer] = useTransition();
  const dialogue = useRef<HTMLDialogElement>(null);

  const colonnes = c.champs.filter((ch) => ch.colonne);
  const libelle = (l: LigneListe) => l.valeurs[c.champs.find((ch) => ch.requis && ch.nom !== "code")?.nom ?? c.cle] || l.cle;
  const visibles = useMemo(() => {
    const r = recherche.trim().toLowerCase();
    return r ? lignes.filter((l) => Object.values(l.valeurs).some((v) => v.toLowerCase().includes(r))) : lignes;
  }, [lignes, recherche]);

  const ouvrirConfirmation = (type: "desactiver" | "reactiver" | "supprimer", ligne: LigneListe) => {
    setConfirmation({ type, ligne });
    dialogue.current?.showModal();
  };
  const confirmer = () =>
    confirmation &&
    demarrer(async () => {
      const { type, ligne } = confirmation;
      const r: Resultat =
        type === "supprimer" ? await supprimerValeur(slug, ligne.cle) : await changerActivation(slug, ligne.cle, type === "reactiver");
      setMessage(r.erreur ? { type: "erreur", texte: r.erreur } : { type: "succes", texte: r.succes ?? "Enregistré." });
      dialogue.current?.close();
    });

  const affichage = (nom: string, v: string) => c.champs.find((ch) => ch.nom === nom)?.options?.find((o) => o.valeur === v)?.libelle ?? v;
  const unite = c.usage === "logements" ? "logement" : "travail";

  return (
    <section aria-labelledby="titre-liste">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="titre-liste" className="text-lg font-semibold text-slate-900">
            {c.titre} <span className="font-normal text-slate-500">({lignes.length})</span>
          </h2>
          <p className="text-sm text-slate-500">
            Une valeur désactivée n&apos;est plus proposée dans les formulaires mais reste affichée là où elle est utilisée. Une
            valeur déjà utilisée (même dans l&apos;historique) ne peut jamais être supprimée.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="search"
            aria-label={`Rechercher dans les ${c.titre.toLowerCase()}`}
            placeholder="Rechercher…"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            className="w-44 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => setEdition({})}
            className="whitespace-nowrap rounded-md bg-primaire px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primaire-fonce"
          >
            + Ajouter
          </button>
        </div>
      </div>

      {message && (
        <div className="mb-4">
          <Alerte type={message.type}>{message.texte}</Alerte>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs font-semibold text-slate-600">
              {colonnes.map((ch) => (
                <th key={ch.nom} scope="col" className="whitespace-nowrap px-3 py-2.5">
                  {ch.libelle}
                </th>
              ))}
              <th scope="col" className="px-3 py-2.5 text-right">
                Utilisation
              </th>
              <th scope="col" className="px-3 py-2.5">
                État
              </th>
              <th scope="col" className="px-3 py-2.5">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibles.map((l) => (
              <tr key={l.cle} className={l.actif ? "" : "bg-slate-50/60 text-slate-500"}>
                {colonnes.map((ch) => (
                  <td key={ch.nom} className="whitespace-nowrap px-3 py-2">
                    {affichage(ch.nom, l.valeurs[ch.nom]) || "—"}
                  </td>
                ))}
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                  {l.usages} {l.usages > 1 ? (unite === "travail" ? "travaux" : "logements") : unite}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                      l.actif ? "bg-green-50 text-green-700 ring-green-600/20" : "bg-slate-100 text-slate-600 ring-slate-500/20"
                    }`}
                  >
                    {l.actif ? "Active" : "Désactivée"}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right">
                  <button type="button" onClick={() => setEdition({ ligne: l })} className="rounded px-2 py-1 font-medium text-primaire hover:bg-primaire-clair">
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => ouvrirConfirmation(l.actif ? "desactiver" : "reactiver", l)}
                    className="rounded px-2 py-1 font-medium text-slate-600 hover:bg-slate-100"
                  >
                    {l.actif ? "Désactiver" : "Réactiver"}
                  </button>
                  {l.usages === 0 && (
                    <button type="button" onClick={() => ouvrirConfirmation("supprimer", l)} className="rounded px-2 py-1 font-medium text-red-700 hover:bg-red-50">
                      Supprimer
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {visibles.length === 0 && (
              <tr>
                <td colSpan={colonnes.length + 3} className="px-3 py-8 text-center text-slate-500">
                  Aucune valeur.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {edition && (
        <FormulaireValeur
          key={edition.ligne?.cle ?? "nouveau"}
          slug={slug}
          ligne={edition.ligne}
          onFermer={(enregistre) => {
            setEdition(null);
            if (enregistre) setMessage({ type: "succes", texte: edition.ligne ? "Modifications enregistrées." : "Valeur ajoutée." });
          }}
        />
      )}

      <Dialogue
        ref={dialogue}
        titre={
          confirmation?.type === "supprimer"
            ? `Supprimer « ${confirmation ? libelle(confirmation.ligne) : ""} » ?`
            : confirmation?.type === "desactiver"
              ? `Désactiver « ${confirmation ? libelle(confirmation.ligne) : ""} » ?`
              : `Réactiver « ${confirmation ? libelle(confirmation.ligne) : ""} » ?`
        }
      >
        <p className="text-sm text-slate-600">
          {confirmation?.type === "supprimer"
            ? "Cette valeur n'est utilisée par aucun élément actuel. Si elle apparaît dans l'historique, la suppression sera refusée : il faudra la désactiver."
            : confirmation?.type === "desactiver"
              ? "Elle ne sera plus proposée dans les formulaires. Les logements et travaux qui l'utilisent la conservent."
              : "Elle sera de nouveau proposée dans les formulaires."}
        </p>
        <BoutonsDialogue
          onAnnuler={() => dialogue.current?.close()}
          onConfirmer={confirmer}
          libelle={confirmation?.type === "supprimer" ? "Supprimer" : confirmation?.type === "desactiver" ? "Désactiver" : "Réactiver"}
          danger={confirmation?.type === "supprimer"}
          enCours={enCours}
        />
      </Dialogue>
    </section>
  );
}

function FormulaireValeur({ slug, ligne, onFermer }: { slug: SlugListe; ligne?: LigneListe; onFermer: (enregistre: boolean) => void }) {
  const c = LISTES[slug];
  const dialogue = useRef<HTMLDialogElement>(null);
  const actionListe = useMemo(() => enregistrerValeur.bind(null, slug), [slug]);
  const [etat, action, enCours] = useActionState(actionListe, undefined);
  const enregistre = useRef(false);
  // champs contrôlés : la saisie survit à une erreur de validation
  const [valeurs, setValeurs] = useState<Record<string, string>>(
    () => ligne?.valeurs ?? Object.fromEntries(c.champs.map((ch) => [ch.nom, ch.options?.[0]?.valeur ?? ""])),
  );
  const erreurs = etat?.erreursChamps ?? {};

  useEffect(() => {
    dialogue.current?.showModal();
  }, []);
  useEffect(() => {
    if (etat?.ok) {
      enregistre.current = true;
      dialogue.current?.close();
    }
  }, [etat]);

  return (
    <Dialogue ref={dialogue} titre={ligne ? `Modifier le ${c.singulier}` : `Ajouter un ${c.singulier}`} large onClose={() => onFermer(enregistre.current)}>
      <form onSubmit={envoyerSansReinitialiser(action)} noValidate className="space-y-4">
        {ligne && <input type="hidden" name="__cle" value={ligne.cle} />}
        {etat?.erreur && <Alerte type="erreur">{etat.erreur}</Alerte>}
        <div className="grid gap-4 sm:grid-cols-2">
          {c.champs.map((ch) => {
            const fige = Boolean(ligne && ch.figeApresCreation);
            const commun = {
              id: `v-${ch.nom}`,
              name: ch.nom,
              value: valeurs[ch.nom] ?? "",
              disabled: fige,
              "aria-invalid": erreurs[ch.nom] ? true : undefined,
              className: classeChampFormulaire,
              onChange: (e: { target: { value: string } }) => setValeurs((v) => ({ ...v, [ch.nom]: e.target.value })),
            };
            return (
              <div key={ch.nom}>
                <label htmlFor={`v-${ch.nom}`} className="mb-1 block text-sm font-medium text-slate-700">
                  {ch.libelle}
                  {ch.requis && <span className="text-red-600"> *</span>}
                </label>
                {ch.type === "select" ? (
                  <select {...commun}>
                    {ch.options!.map((o) => (
                      <option key={o.valeur} value={o.valeur}>
                        {o.libelle}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    {...commun}
                    type={ch.type === "number" ? "number" : ch.type ?? "text"}
                    maxLength={ch.max}
                    autoCapitalize={ch.majuscules ? "characters" : undefined}
                  />
                )}
                {erreurs[ch.nom] ? (
                  <p className="mt-1 text-xs text-red-700">{erreurs[ch.nom]}</p>
                ) : (
                  fige && <p className="mt-1 text-xs text-slate-500">Non modifiable : ce code est repris dans l&apos;historique.</p>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => dialogue.current?.close()} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Annuler
          </button>
          <button type="submit" disabled={enCours} className="rounded-md bg-primaire px-4 py-2 text-sm font-semibold text-white hover:bg-primaire-fonce disabled:opacity-70">
            {enCours ? "Enregistrement…" : ligne ? "Enregistrer" : "Ajouter"}
          </button>
        </div>
      </form>
    </Dialogue>
  );
}
