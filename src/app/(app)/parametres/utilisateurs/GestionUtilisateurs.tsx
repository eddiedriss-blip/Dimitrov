"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { BoutonsDialogue, Dialogue } from "@/components/Dialogue";
import { Alerte, classeChampFormulaire } from "@/components/formulaire";
import { envoyerSansReinitialiser } from "@/lib/formulaires";
import { formatDate } from "@/lib/format";
import { LIBELLES_ROLE } from "@/lib/navigation";
import {
  anonymiserUtilisateur,
  changerActivationUtilisateur,
  inviterUtilisateur,
  modifierUtilisateur,
  reinitialiserMotDePasse,
  type Resultat,
} from "../actions";

export type CompteUtilisateur = {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  role: "admin" | "utilisateur";
  actif: boolean;
  anonymise_le: string | null;
  created_at: string;
};

type Confirmation = { type: "desactiver" | "reactiver" | "reinitialiser" | "anonymiser"; compte: CompteUtilisateur };

const TEXTES: Record<Confirmation["type"], { titre: string; texte: string; bouton: string; danger?: boolean }> = {
  desactiver: {
    titre: "Désactiver ce compte ?",
    texte: "La personne ne pourra plus se connecter ; si elle est connectée, son accès est coupé dès sa prochaine action. Son historique est conservé. Le compte peut être réactivé.",
    bouton: "Désactiver",
  },
  reactiver: { titre: "Réactiver ce compte ?", texte: "La personne pourra de nouveau se connecter avec son mot de passe.", bouton: "Réactiver" },
  reinitialiser: {
    titre: "Réinitialiser le mot de passe ?",
    texte: "Un e-mail contenant un lien pour choisir un nouveau mot de passe sera envoyé à la personne (valable 1 heure). Son mot de passe actuel reste valable tant qu'elle ne l'a pas changé.",
    bouton: "Envoyer l'e-mail",
  },
  anonymiser: {
    titre: "Anonymiser ce compte (RGPD) ?",
    texte: "Le nom, le prénom et l'e-mail seront effacés définitivement et le compte ne pourra plus jamais être utilisé. L'historique restera rattaché à un « Utilisateur anonymisé ». Cette action est irréversible.",
    bouton: "Anonymiser définitivement",
    danger: true,
  },
};


function Etat({ c }: { c: CompteUtilisateur }) {
  const [texte, style] = c.anonymise_le
    ? ["Anonymisé", "bg-slate-100 text-slate-500 ring-slate-400/20"]
    : c.actif
      ? ["Actif", "bg-green-50 text-green-700 ring-green-600/20"]
      : ["Désactivé", "bg-orange-50 text-orange-800 ring-orange-600/25"];
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${style}`}>{texte}</span>;
}

export function GestionUtilisateurs({ comptes, moi, creationPossible }: { comptes: CompteUtilisateur[]; moi: string; creationPossible: boolean }) {
  const [formulaire, setFormulaire] = useState<{ compte?: CompteUtilisateur } | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [message, setMessage] = useState<{ type: "succes" | "erreur"; texte: string }>();
  const [enCours, demarrer] = useTransition();
  const dialogue = useRef<HTMLDialogElement>(null);

  const demander = (type: Confirmation["type"], compte: CompteUtilisateur) => {
    setConfirmation({ type, compte });
    dialogue.current?.showModal();
  };
  const confirmer = () =>
    confirmation &&
    demarrer(async () => {
      const { type, compte } = confirmation;
      const r: Resultat =
        type === "reinitialiser"
          ? await reinitialiserMotDePasse(compte.id)
          : type === "anonymiser"
            ? await anonymiserUtilisateur(compte.id)
            : await changerActivationUtilisateur(compte.id, type === "reactiver");
      setMessage(r.erreur ? { type: "erreur", texte: r.erreur } : { type: "succes", texte: r.succes ?? "Enregistré." });
      dialogue.current?.close();
    });

  const nom = (c: CompteUtilisateur) => `${c.prenom} ${c.nom}`.trim() || c.email;

  return (
    <section aria-labelledby="titre-utilisateurs">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="titre-utilisateurs" className="text-lg font-semibold text-slate-900">
            Utilisateurs <span className="font-normal text-slate-500">({comptes.length})</span>
          </h2>
          <p className="text-sm text-slate-500">
            Les nouveaux comptes reçoivent un e-mail d&apos;invitation pour choisir leur mot de passe. Un compte n&apos;est jamais
            supprimé : il est désactivé, puis anonymisé si nécessaire (RGPD).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormulaire({})}
          disabled={!creationPossible}
          title={creationPossible ? undefined : "Création de comptes non configurée"}
          className="whitespace-nowrap rounded-md bg-primaire px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primaire-fonce disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Créer un utilisateur
        </button>
      </div>

      {!creationPossible && (
        <div className="mb-4">
          <Alerte type="info">
            La création de comptes depuis l&apos;application nécessite la clé secrète Supabase côté serveur (variable
            <code className="mx-1 rounded bg-white px-1">SUPABASE_SECRET_KEY</code>). En attendant, créez les comptes dans le
            tableau de bord Supabase (Authentication → Users → Invite user) : ils apparaîtront ici.
          </Alerte>
        </div>
      )}
      {message && (
        <div className="mb-4">
          <Alerte type={message.type}>{message.texte}</Alerte>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs font-semibold text-slate-600">
              <th scope="col" className="px-3 py-2.5">Nom</th>
              <th scope="col" className="px-3 py-2.5">E-mail</th>
              <th scope="col" className="px-3 py-2.5">Rôle</th>
              <th scope="col" className="px-3 py-2.5">État</th>
              <th scope="col" className="px-3 py-2.5">Créé le</th>
              <th scope="col" className="px-3 py-2.5">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {comptes.map((c) => {
              const soiMeme = c.id === moi;
              return (
                <tr key={c.id} className={c.actif ? "" : "bg-slate-50/60 text-slate-500"}>
                  <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-900">
                    {nom(c)}
                    {soiMeme && <span className="ml-2 rounded bg-primaire-clair px-1.5 py-0.5 text-xs font-medium text-primaire">vous</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{c.email}</td>
                  <td className="whitespace-nowrap px-3 py-2">{LIBELLES_ROLE[c.role]}</td>
                  <td className="px-3 py-2">
                    <Etat c={c} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{formatDate(c.created_at)}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-right">
                    {!c.anonymise_le && (
                      <>
                        <button type="button" onClick={() => setFormulaire({ compte: c })} className="rounded px-2 py-1 font-medium text-primaire hover:bg-primaire-clair">
                          Modifier
                        </button>
                        {c.actif && (
                          <button type="button" onClick={() => demander("reinitialiser", c)} className="rounded px-2 py-1 font-medium text-slate-600 hover:bg-slate-100">
                            Réinitialiser le mot de passe
                          </button>
                        )}
                        {!soiMeme && (
                          <button
                            type="button"
                            onClick={() => demander(c.actif ? "desactiver" : "reactiver", c)}
                            className="rounded px-2 py-1 font-medium text-slate-600 hover:bg-slate-100"
                          >
                            {c.actif ? "Désactiver" : "Réactiver"}
                          </button>
                        )}
                        {!c.actif && (
                          <button type="button" onClick={() => demander("anonymiser", c)} className="rounded px-2 py-1 font-medium text-red-700 hover:bg-red-50">
                            Anonymiser
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {formulaire && (
        <FormulaireCompte
          key={formulaire.compte?.id ?? "nouveau"}
          compte={formulaire.compte}
          soiMeme={formulaire.compte?.id === moi}
          onFermer={(texte) => {
            setFormulaire(null);
            if (texte) setMessage({ type: "succes", texte });
          }}
        />
      )}

      <Dialogue ref={dialogue} titre={confirmation ? TEXTES[confirmation.type].titre : ""}>
        {confirmation && (
          <>
            <p className="text-sm font-medium text-slate-900">
              {nom(confirmation.compte)} — {confirmation.compte.email}
            </p>
            <p className="mt-2 text-sm text-slate-600">{TEXTES[confirmation.type].texte}</p>
            <BoutonsDialogue
              onAnnuler={() => dialogue.current?.close()}
              onConfirmer={confirmer}
              libelle={TEXTES[confirmation.type].bouton}
              danger={TEXTES[confirmation.type].danger}
              enCours={enCours}
            />
          </>
        )}
      </Dialogue>
    </section>
  );
}

function FormulaireCompte({ compte, soiMeme, onFermer }: { compte?: CompteUtilisateur; soiMeme: boolean; onFermer: (message?: string) => void }) {
  const dialogue = useRef<HTMLDialogElement>(null);
  const [etat, action, enCours] = useActionState(compte ? modifierUtilisateur : inviterUtilisateur, undefined);
  const [v, setV] = useState({ email: compte?.email ?? "", prenom: compte?.prenom ?? "", nom: compte?.nom ?? "", role: compte?.role ?? "utilisateur" });
  const reussi = useRef<string | undefined>(undefined);
  const erreurs = etat?.erreursChamps ?? {};
  const maj = (cle: keyof typeof v) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [cle]: e.target.value }));

  useEffect(() => {
    dialogue.current?.showModal();
  }, []);
  useEffect(() => {
    if (etat?.ok) {
      reussi.current = compte ? "Compte modifié." : `Invitation envoyée à ${v.email}. Le compte apparaîtra comme actif ; la personne choisira son mot de passe via l'e-mail.`;
      dialogue.current?.close();
    }
  }, [etat, compte, v.email]);

  const champ = (cle: "email" | "prenom" | "nom", libelle: string, props: Record<string, unknown> = {}) => (
    <div>
      <label htmlFor={`u-${cle}`} className="mb-1 block text-sm font-medium text-slate-700">
        {libelle} <span className="text-red-600">*</span>
      </label>
      <input id={`u-${cle}`} name={cle} value={v[cle]} onChange={maj(cle)} aria-invalid={erreurs[cle] ? true : undefined} className={classeChampFormulaire} {...props} />
      {erreurs[cle] && <p className="mt-1 text-xs text-red-700">{erreurs[cle]}</p>}
    </div>
  );

  return (
    <Dialogue ref={dialogue} titre={compte ? "Modifier l'utilisateur" : "Créer un utilisateur"} large onClose={() => onFermer(reussi.current)}>
      <form onSubmit={envoyerSansReinitialiser(action)} noValidate className="space-y-4">
        {compte && <input type="hidden" name="id" value={compte.id} />}
        {etat?.erreur && <Alerte type="erreur">{etat.erreur}</Alerte>}
        {compte ? (
          <p className="text-sm text-slate-600">
            E-mail : <strong>{compte.email}</strong>
          </p>
        ) : (
          champ("email", "E-mail", { type: "email", autoComplete: "off", maxLength: 200 })
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {champ("prenom", "Prénom", { maxLength: 80 })}
          {champ("nom", "Nom", { maxLength: 80 })}
        </div>
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-slate-700">Rôle</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["utilisateur", "Utilisateur", "Logements, travaux, chiffres, archives."],
                ["admin", "Administrateur", "Tout, y compris les Paramètres."],
              ] as const
            ).map(([valeur, titre, aide]) => (
              <label key={valeur} className={`flex cursor-pointer gap-2 rounded-md border p-3 text-sm ${v.role === valeur ? "border-primaire bg-primaire-clair" : "border-slate-300"}`}>
                <input type="radio" name="role" value={valeur} checked={v.role === valeur} onChange={maj("role")} className="mt-0.5 accent-primaire" />
                <span>
                  <span className="block font-medium text-slate-900">{titre}</span>
                  <span className="text-xs text-slate-500">{aide}</span>
                </span>
              </label>
            ))}
          </div>
          {soiMeme && v.role !== "admin" && (
            <p className="mt-2 text-xs text-orange-800">Attention : vous perdrez l&apos;accès aux Paramètres. (Refusé si vous êtes le dernier administrateur.)</p>
          )}
        </fieldset>
        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => dialogue.current?.close()} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Annuler
          </button>
          <button type="submit" disabled={enCours} className="rounded-md bg-primaire px-4 py-2 text-sm font-semibold text-white hover:bg-primaire-fonce disabled:opacity-70">
            {enCours ? "Envoi…" : compte ? "Enregistrer" : "Envoyer l'invitation"}
          </button>
        </div>
      </form>
    </Dialogue>
  );
}
