# Logements vacants (Next.js + Supabase)

Application interne de gestion des logements vacants d'un bailleur social.

## Organisation

| Dossier | Contenu |
| --- | --- |
| `supabase/migrations/` | Schéma de la base (tables, RLS, triggers) |
| `supabase/tests/` | Tests du schéma (`npm install` puis `npm test` dans ce dossier) |
| `supabase/seed.sql` | Données **fictives** pour le développement local (groupes, réservataires, 40 logements) |
| `supabase/templates/` | E-mails en français (réinitialisation, invitation) |
| `supabase/config.toml` | Configuration Supabase locale (inscriptions fermées, règles de mot de passe) |
| `src/proxy.ts` | Rafraîchit la session et protège les pages à chaque requête |
| `src/app/(auth)/` | Connexion, mot de passe oublié, nouveau mot de passe |
| `src/app/(app)/` | Pages de l'application (Accueil, Gestion des vacants, Travaux, Chiffres, Archives, Paramètres) |
| `src/lib/navigation.ts` | Menu et droits d'accès par rôle |

## Rôles

- **Administrateur** (`admin`) : tout, y compris Paramètres (utilisateurs, référentiels).
- **Utilisateur** (`utilisateur`) : logements, vacances, travaux, photos, entreprises ; pas d'accès aux Paramètres.

Les droits sont appliqués à trois niveaux : le menu, la page (vérification côté serveur) et la base de données (RLS).

## Gestion des vacants (`/vacants`)

- **N° ESI** : 5 chiffres (n° de groupe / immeuble) + `L` + 4 chiffres (n° de porte), ex. `12345L0273` = porte 273. Saisie tolérante (espaces, `l` minuscule). Le **groupe** est déduit des 5 premiers chiffres et la **porte** des 4 derniers (plus de saisie, migration `…_porte_esi.sql`) ; s'il n'existe pas, la base le crée (« Groupe 12345 », à renommer dans Paramètres). Codes de groupe = 5 chiffres, non modifiables après création (migration `…_format_esi.sql`).
- Tableau triable (clic sur l'en-tête), paginé (25/50/100), recherche générale sans accents et filtres combinables ; l'état est dans l'URL (lien partageable).
- Recherche, filtres, tri et pagination sont faits par la base : fonction `rechercher_logements` (migration `…_gestion_vacants.sql`).
- Créer / Modifier / Consulter / Archiver. **Pas de suppression** : un logement n'est jamais supprimé.
- Archiver = passer au statut « Loué » (la vacance en cours est clôturée). Les loués sont masqués par défaut (option « Inclure les logements loués »).
- Champs propres à chaque vacance : ancien locataire, préavis (date de réception), envoi au réservataire, date de reprise (remise en location prévue), date de libération.
- Statut des travaux : calculé à partir des travaux de la dernière vacance (aucun / à commander / commandés / finis).

## Travaux des vacants (`/travaux`)

- **Fiche travaux = la vacance en cours du logement.** Elle est créée automatiquement à la création d'un logement vacant (et à chaque nouveau départ de locataire). N° ESI, groupe, étage et type ne sont pas recopiés : ils sont lus en direct depuis le logement.
- Liste en cartes (N° ESI, groupe, étage, type, statut, progression %) avec filtres N° ESI / groupe / étage / type / statut.
- Fiche (`/travaux/[id]`) : travaux illimités (intitulé, commentaire, entreprise — création rapide possible —, dates de création / commande / fin, montant HT facultatif, statut modifiable directement dans la liste). Suppression d'un travail : administrateur uniquement.
- Progression = travaux finis / total. **Statut du logement automatique** (migration `…_fiches_travaux.sql`) : au moins un « À commander » → Travaux à faire ; sinon un « Commandé » → Travaux commandés ; tous finis → Travaux finis. « À louer » et « Loué » ne sont jamais écrasés. Modification manuelle possible avec confirmation.
- Photos : envoi multiple (bouton ou glisser-déposer), redimensionnées dans le navigateur (1920 px + miniature 480 px, JPEG), bucket privé `photos-logements` (liens temporaires d'1 h), galerie plein écran (flèches, clavier, glisser), légende, suppression. Chemins : `{logement}/{vacance}/{fichier}.jpg`.

## Archives (`/archives`) et historique

- **Passer à louer** : bouton visible uniquement au statut « Travaux finis » (fiche logement, fiche travaux, tableau), avec confirmation.
- **Loué = archivé** : le logement disparaît des listes de travail et toute page le concernant (Consulter, Modifier, Fiche travaux) renvoie vers `/archives/[id]`. Rien n'est supprimé.
- **Administrateurs** : bouton « Modifier » sur les archives (liste et fiche) ; changer le statut remet le logement en vacance (nouvelle vacance).
- **Lecture seule garantie par la base** (migration `…_archives_historique.sql`) : pour un utilisateur, un logement loué, ses vacances, travaux et photos ne peuvent plus être modifiés. Seuls les automatismes (clôture de la vacance) et les administrateurs peuvent encore écrire.
- Liste : recherche générale, filtres groupe / réservataire / type / période de location, tri, pagination.
- Fiche d'archive : toutes les informations, vacances successives (durée, travaux, montants), travaux et photos de la dernière vacance (galerie sans modification), historique.
- **Historique** (fiche logement et archive) : événements lisibles construits à partir du journal (`v_historique`) — logement créé, changements de statut, vacance ouverte / clôturée, travaux ajoutés / commandés / terminés, photos — avec date, heure, utilisateur, ancienne → nouvelle valeur ; changements automatiques signalés. Filtre « Étapes clés / Toutes les modifications ».

## Chiffres (`/chiffres`)

- Calculés par la base en un appel : fonction `statistiques(année, mois, groupe, type)` (migration `…_statistiques.sql`, testée avec un jeu de données maîtrisé).
- Chiffres clés : vacants aujourd'hui / sur la période ; devenus vacants et loués (logements distincts) ; entrées et sorties de vacance (mouvements) ; travaux (logements concernés, à commander, commandés, terminés).
- Graphiques : vacants par mois et par année, entrées/sorties par mois et par année, répartitions par groupe, type et statut. Chaque graphique a une vue tableau et une infobulle au survol / au clavier.
- Définitions affichées sur la page (« Comment ces chiffres sont-ils calculés ? »).
- Graphiques en HTML/CSS sans bibliothèque (`src/components/graphiques/`) ; couleurs validées (contraste et daltonisme) par le script de la méthode dataviz.

## Paramètres (`/parametres`, administrateurs)

- **Utilisateurs** : créer (invitation par e-mail : la personne choisit son mot de passe), modifier nom / prénom / rôle, désactiver / réactiver, envoyer un e-mail de réinitialisation du mot de passe, anonymiser (RGPD) un compte désactivé. La base garantit qu'il reste toujours au moins un administrateur actif.
- **Création de comptes** : nécessite la variable serveur `SUPABASE_SECRET_KEY` (clé secrète Supabase, *Project Settings → API Keys*), à ajouter dans Vercel **sans** préfixe `NEXT_PUBLIC_`. Sans elle, créer les comptes depuis le tableau de bord Supabase (Authentication → Users → Invite user).
- **Listes déroulantes** (groupes, réservataires, plafonds, types, entreprises) : ajouter, modifier, désactiver / réactiver. Une valeur désactivée disparaît des formulaires mais reste affichée là où elle est utilisée et reste filtrable. **Suppression définitive refusée par la base** dès qu'une valeur est utilisée ou apparaît dans l'historique (migration `…_parametres.sql`). Les codes des plafonds et types ne sont plus modifiables après création.

## Sessions

- Session Supabase stockée dans des cookies sécurisés et rafraîchie automatiquement.
- Déconnexion automatique après **30 minutes d'inactivité** (tous onglets confondus) : `src/components/SurveillanceSession.tsx`.
- Un compte désactivé (`utilisateurs.actif = false`) est déconnecté à la requête suivante.

## Démarrer en local

Prérequis : Node.js 22 ou plus récent (recommandé par Supabase), et [Docker Desktop](https://www.docker.com/products/docker-desktop/) pour Supabase local.

```bash
npm install
npx supabase start          # applique les migrations
npx supabase status         # affiche la clé publique à copier dans .env.local
npm run dev
```

E-mails en local : ils ne partent pas réellement, ils sont visibles dans Mailpit (URL indiquée par `npx supabase status`).

### Créer le premier administrateur

1. Dans Supabase Studio (local : http://127.0.0.1:54323) → **Authentication → Users → Add user** (ou « Invite »).
2. Dans le **SQL Editor** :

   ```sql
   update public.utilisateurs set role = 'admin', nom = 'Nom', prenom = 'Prénom'
   where email = 'adresse@exemple.fr';
   ```

## Mise en production (projet Supabase hébergé)

Choisir une région **Union européenne**, puis dans le tableau de bord Supabase :

1. **Authentication → Sign In / Providers** : désactiver « Allow new users to sign up ».
2. **Authentication → URL Configuration** : *Site URL* = adresse de l'application ; ajouter `https://<adresse>/**` aux *Redirect URLs*.
3. **Authentication → Emails** : recopier le contenu de `supabase/templates/recovery.html` (Reset password) et `invite.html` (Invite user).
4. **Authentication → Emails → SMTP** : configurer un vrai serveur d'envoi (celui de Supabase est limité à quelques e-mails par heure).
5. **Authentication → Policies** : longueur minimale 10, « letters and digits ».

Variables d'environnement de l'hébergeur : voir `.env.example` (jamais la clé secrète `service_role`).

## Logo

Le logo actuel est provisoire : remplacer `src/components/Logo.tsx` et `src/app/icon.svg` par ceux du bailleur.
