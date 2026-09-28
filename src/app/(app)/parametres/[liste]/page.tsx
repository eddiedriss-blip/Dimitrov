import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LISTES, type SlugListe } from "@/lib/parametres/listes";
import { createClient } from "@/lib/supabase/server";
import { GestionListe, type LigneListe } from "./GestionListe";

export async function generateMetadata({ params }: PageProps<"/parametres/[liste]">): Promise<Metadata> {
  const c = LISTES[(await params).liste as SlugListe];
  return { title: c ? `Paramètres — ${c.titre}` : "Paramètres" };
}

export default async function PageListe({ params }: PageProps<"/parametres/[liste]">) {
  const c = LISTES[(await params).liste as SlugListe];
  if (!c) notFound();

  const supabase = await createClient();
  const [lignes, usages] = await Promise.all([
    supabase.from(c.table).select("*").order(c.ordre),
    supabase.from("v_usages_referentiels").select("cle, nb").eq("liste", c.table),
  ]);
  if (lignes.error || usages.error) throw new Error(`Lecture de la liste impossible : ${(lignes.error ?? usages.error)!.message}`);

  const nb = new Map((usages.data ?? []).map((u) => [u.cle as string, u.nb as number]));
  const donnees: LigneListe[] = (lignes.data ?? []).map((l: Record<string, unknown>) => ({
    cle: String(l[c.cle]),
    actif: Boolean(l.actif),
    valeurs: Object.fromEntries(c.champs.map((ch) => [ch.nom, l[ch.nom] === null || l[ch.nom] === undefined ? "" : String(l[ch.nom])])),
    usages: nb.get(String(l[c.cle])) ?? 0,
  }));

  return <GestionListe slug={c.slug} lignes={donnees} />;
}
