import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const TYPES_MOT_DE_PASSE: EmailOtpType[] = ["recovery", "invite"];

/**
 * Cible des liens envoyés par e-mail (réinitialisation, invitation).
 * Modèles : supabase/templates/*.html → /auth/confirm?token_hash=…&type=…
 * Le paramètre `code` (flux PKCE) est aussi accepté.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const code = params.get("code");

  const supabase = await createClient();
  let valide = false;

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    valide = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    valide = !error;
  }

  if (!valide) redirect("/mot-de-passe-oublie?erreur=lien-invalide");
  redirect(!type || TYPES_MOT_DE_PASSE.includes(type) ? "/reinitialiser-mot-de-passe" : "/");
}
