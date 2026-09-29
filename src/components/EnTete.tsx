"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { seDeconnecter } from "@/app/(app)/actions";
import { Logo } from "@/components/Logo";
import type { ElementMenu } from "@/lib/navigation";

type Props = {
  menu: ElementMenu[];
  utilisateur: { nom: string; role: string };
};

const estActif = (chemin: string, href: string) =>
  href === "/" ? chemin === "/" : chemin === href || chemin.startsWith(`${href}/`);

export function EnTete({ menu, utilisateur }: Props) {
  const chemin = usePathname();
  const [menuOuvert, setMenuOuvert] = useState(false);

  return (
    <header className="sticky top-0 z-30">
      {/* Bandeau blanc avec le logo, liseré flamme */}
      <div className="bg-white text-anthracite">
        <div className="mx-auto flex h-16 sm:h-[4.5rem] max-w-screen-2xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="Accueil" className="rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primaire">
            <Logo />
          </Link>

          <div className="hidden items-center gap-4 md:flex">
            <div className="text-right text-sm leading-tight">
              <div className="font-medium">{utilisateur.nom}</div>
              <div className="text-stone-500">{utilisateur.role}</div>
            </div>
            <form action={seDeconnecter}>
              <button
                type="submit"
                className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:border-primaire hover:text-primaire focus-visible:outline-2 focus-visible:outline-primaire"
              >
                Se déconnecter
              </button>
            </form>
          </div>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-anthracite hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-primaire md:hidden"
            aria-expanded={menuOuvert}
            aria-controls="menu-mobile"
            aria-label={menuOuvert ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => setMenuOuvert((o) => !o)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              {menuOuvert ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
        <div aria-hidden="true" className="h-1 bg-gradient-to-r from-primaire via-flamme to-soleil" />
      </div>

      {/* Menu ordinateur / tablette : barre anthracite */}
      <nav aria-label="Navigation principale" className="hidden bg-anthracite shadow-sm md:block">
        <ul className="mx-auto flex max-w-screen-2xl gap-1 overflow-x-auto px-4 sm:px-6 lg:px-8">
          {menu.map((e) => {
            const actif = estActif(chemin, e.href);
            return (
              <li key={e.href}>
                <Link
                  href={e.href}
                  aria-current={actif ? "page" : undefined}
                  className={`block whitespace-nowrap border-b-[3px] px-3 py-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-soleil ${
                    actif
                      ? "border-flamme text-white"
                      : "border-transparent text-stone-300 hover:border-stone-500 hover:text-white"
                  }`}
                >
                  {e.libelle}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Menu téléphone */}
      <nav
        id="menu-mobile"
        aria-label="Navigation principale"
        hidden={!menuOuvert}
        className="border-b border-slate-200 bg-white shadow-md md:hidden"
      >
        <ul className="px-2 py-2">
          {menu.map((e) => {
            const actif = estActif(chemin, e.href);
            return (
              <li key={e.href}>
                <Link
                  href={e.href}
                  aria-current={actif ? "page" : undefined}
                  onClick={() => setMenuOuvert(false)}
                  className={`block rounded-md px-3 py-3 text-base font-medium ${
                    actif ? "bg-primaire-clair text-primaire" : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {e.libelle}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
          <div className="text-sm leading-tight">
            <div className="font-medium text-slate-900">{utilisateur.nom}</div>
            <div className="text-slate-500">{utilisateur.role}</div>
          </div>
          <form action={seDeconnecter}>
            <button
              type="submit"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Se déconnecter
            </button>
          </form>
        </div>
      </nav>
    </header>
  );
}
