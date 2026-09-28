import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { configSupabase } from "./env";

/** Pages accessibles sans être connecté. */
const CHEMINS_PUBLICS = ["/connexion", "/mot-de-passe-oublie", "/reinitialiser-mot-de-passe", "/auth"];
/** Pages sans intérêt une fois connecté : renvoi vers l'accueil. */
const CHEMINS_INVITE_SEULEMENT = ["/connexion", "/mot-de-passe-oublie"];

const correspond = (chemin: string, liste: string[]) =>
  liste.some((p) => chemin === p || chemin.startsWith(`${p}/`));

/**
 * Rafraîchit la session Supabase (cookies) à chaque requête et protège les pages privées.
 * Ce n'est qu'une première barrière : chaque page vérifie aussi le profil, et la base applique la RLS.
 */
export async function mettreAJourSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const { url, cle } = configSupabase();
  const supabase = createServerClient(url, cle, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([cle, valeur]) => response.headers.set(cle, valeur));
      },
    },
  });

  // Ne rien intercaler entre la création du client et getClaims() (recommandation Supabase).
  const { data } = await supabase.auth.getClaims();
  const connecte = Boolean(data?.claims?.sub);
  const chemin = request.nextUrl.pathname;

  const rediriger = (destination: URL) => {
    const redirection = NextResponse.redirect(destination);
    // conserver les cookies de session éventuellement rafraîchis
    response.cookies.getAll().forEach((cookie) => redirection.cookies.set(cookie));
    return redirection;
  };

  if (!connecte && !correspond(chemin, CHEMINS_PUBLICS)) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    url.search = "";
    if (chemin !== "/") url.searchParams.set("suite", chemin + request.nextUrl.search);
    return rediriger(url);
  }

  if (connecte && correspond(chemin, CHEMINS_INVITE_SEULEMENT)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return rediriger(url);
  }

  return response;
}
