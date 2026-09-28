import type { NextRequest } from "next/server";
import { mettreAJourSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return mettreAJourSession(request);
}

export const config = {
  matcher: [
    // tout sauf les fichiers statiques et les images
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
