"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { seDeconnecter } from "@/app/(app)/actions";
import { createClient } from "@/lib/supabase/client";

/** Déconnexion automatique après cette durée sans activité (tous onglets confondus). */
const DELAI_INACTIVITE_MS = 30 * 60 * 1000;
const CLE_ACTIVITE = "lv:derniere-activite";
const EVENEMENTS = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;

/**
 * - renvoie vers la connexion si la session se termine (déconnexion dans un autre onglet, jeton révoqué) ;
 * - déconnecte après 30 minutes d'inactivité.
 */
export function SurveillanceSession() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((evenement) => {
      if (evenement === "SIGNED_OUT") router.replace("/connexion");
    });

    let derniereActivite = Date.now();
    const enregistrer = () => {
      derniereActivite = Date.now();
      try {
        localStorage.setItem(CLE_ACTIVITE, String(derniereActivite));
      } catch {
        // stockage indisponible (navigation privée…) : suivi limité à cet onglet
      }
    };
    const lirePartagee = () => {
      try {
        return Number(localStorage.getItem(CLE_ACTIVITE)) || 0;
      } catch {
        return 0;
      }
    };

    let dernierEnregistrement = 0;
    const surActivite = () => {
      const maintenant = Date.now();
      if (maintenant - dernierEnregistrement > 15_000) {
        dernierEnregistrement = maintenant;
        enregistrer();
      }
    };

    enregistrer();
    EVENEMENTS.forEach((e) => window.addEventListener(e, surActivite, { passive: true }));

    let deconnexionLancee = false;
    const verifier = () => {
      const inactif = Date.now() - Math.max(derniereActivite, lirePartagee());
      if (inactif >= DELAI_INACTIVITE_MS && !deconnexionLancee) {
        deconnexionLancee = true;
        void seDeconnecter("inactivite");
      }
    };
    const intervalle = window.setInterval(verifier, 30_000);
    document.addEventListener("visibilitychange", verifier);

    return () => {
      subscription.unsubscribe();
      EVENEMENTS.forEach((e) => window.removeEventListener(e, surActivite));
      window.clearInterval(intervalle);
      document.removeEventListener("visibilitychange", verifier);
    };
  }, [router]);

  return null;
}
