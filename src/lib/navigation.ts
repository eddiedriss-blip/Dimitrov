import type { Role } from "@/lib/auth/profil";

export type ElementMenu = {
  href: string;
  libelle: string;
  /** Réservé aux administrateurs (paramètres sensibles). */
  adminSeulement?: boolean;
};

const MENU: ElementMenu[] = [
  { href: "/", libelle: "Accueil" },
  { href: "/vacants", libelle: "Gestion des vacants" },
  { href: "/travaux", libelle: "Travaux des vacants" },
  { href: "/chiffres", libelle: "Chiffres" },
  { href: "/archives", libelle: "Archives" },
  { href: "/parametres", libelle: "Paramètres", adminSeulement: true },
];

export const menuPourRole = (role: Role) => MENU.filter((e) => !e.adminSeulement || role === "admin");

export const LIBELLES_ROLE: Record<Role, string> = {
  admin: "Administrateur",
  utilisateur: "Utilisateur",
};
