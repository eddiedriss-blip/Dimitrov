import { startTransition, type FormEvent } from "react";

/**
 * Envoie un formulaire à l'action d'un `useActionState` SANS la réinitialisation automatique
 * que React 19 applique aux `<form action={…}>` : elle remet les listes et boutons radio
 * contrôlés à leur valeur initiale, ce qui fait perdre la saisie en cas d'erreur.
 * Usage : `<form onSubmit={envoyerSansReinitialiser(action)}>`.
 */
export const envoyerSansReinitialiser = (action: (donnees: FormData) => void) => (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  const donnees = new FormData(e.currentTarget);
  startTransition(() => action(donnees));
};
