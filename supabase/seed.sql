-- Données FICTIVES pour le développement local (npx supabase db reset).
-- Ne jamais exécuter sur la base de production.

insert into public.groupes (code, nom, adresse, code_postal, commune) values
  ('10001', 'Les Tilleuls',       '12 rue des Tilleuls',     '38000', 'Grenoble'),
  ('10002', 'Résidence du Parc',  '3 allée du Parc',         '38100', 'Grenoble'),
  ('10003', 'Le Clos des Vignes', '8 chemin des Vignes',     '38400', 'Saint-Martin-d''Hères'),
  ('10004', 'Les Terrasses',      '21 avenue Jean Jaurès',   '38600', 'Fontaine');

insert into public.reservataires (nom, categorie) values
  ('Préfecture (contingent)', 'prefecture'),
  ('Action Logement',         'action_logement'),
  ('Commune',                 'collectivite'),
  ('Bailleur (hors contingent)', 'bailleur');

insert into public.entreprises (raison_sociale, corps_etat) values
  ('Entreprise Peinture Exemple', 'Peinture'),
  ('Plomberie Exemple',           'Plomberie');

-- 40 logements aux caractéristiques variées (N° ESI au format 12345L0012) (les vacances s'ouvrent automatiquement)
insert into public.logements
  (numero_esi, groupe_id, type_logement_code, plafond_code, reservataire_id, statut_code,
   etage, surface_habitable, loyer, charges, commentaire)
select
  format('1000%sL%s', 1 + i % 4, lpad(i::text, 4, '0')),   -- N° ESI : groupe (5 chiffres) + L + n° de logement
  null,                                                      -- groupe déduit du N° ESI par la base
  (array['T1','T2','T3','T4','T5'])[1 + i % 5],
  (array['PLAI','PLUS','PLUS','PLS'])[1 + i % 4],
  case when i % 6 = 0 then null
       else (select id from public.reservataires order by nom offset (i % 4) limit 1) end,
  (array['vacant_technique','travaux_a_faire','travaux_commandes','travaux_finis','a_louer','loue'])[1 + i % 6],
  i % 8,
  round((25 + i * 1.7)::numeric, 1),
  round((250 + i * 9.5)::numeric, 2),
  round((40 + (i % 5) * 12)::numeric, 2),
  case when i % 7 = 0 then 'Clés disponibles à l''agence' end
from generate_series(1, 40) as i;

-- Informations des vacances en cours
update public.vacances v set
  date_debut              = current_date - (10 + (x.n % 90)),
  nom_ancien_locataire    = format('Locataire fictif %s', x.n),
  date_preavis            = current_date - (40 + (x.n % 90)),
  date_envoi_reservataire = case when x.n % 3 = 0 then current_date - (x.n % 20) end,
  date_disponibilite      = current_date + (x.n % 45)
from (
  select v2.id, (row_number() over (order by l.numero_esi))::int as n
  from public.vacances v2 join public.logements l on l.id = v2.logement_id
) x
where x.id = v.id;

-- Vacances passées (déjà relouées) sur ~2 ans, pour des graphiques d'évolution réalistes.
-- Elles se terminent au moins 160 jours avant aujourd'hui : aucun chevauchement avec la vacance en cours.
insert into public.vacances (logement_id, date_debut, date_fin, nom_ancien_locataire)
select l.id,
       current_date - (300 + (x.n * 37) % 420),
       current_date - (300 + (x.n * 37) % 420) + (20 + (x.n * 13) % 120),
       format('Ancien locataire fictif %s', x.n)
from (select id, (row_number() over (order by numero_esi))::int as n from public.logements) x
join public.logements l on l.id = x.id
where x.n % 3 <> 0;

-- Travaux chiffrés sur ces vacances passées
insert into public.travaux (logement_id, vacance_id, libelle, statut_code, entreprise_id, montant_commande_ht, date_commande, date_fin_reelle)
select v.logement_id, v.id, 'Remise en état (fictif)', 'fini',
       (select id from public.entreprises order by raison_sociale limit 1),
       round((800 + (extract(doy from v.date_debut)::int * 17) % 3000)::numeric, 2),
       v.date_debut + 5, v.date_fin - 2
from public.vacances v
where v.date_fin is not null;

-- Travaux sur une partie des vacances en cours (statuts variés)
insert into public.travaux (logement_id, vacance_id, libelle, statut_code, entreprise_id)
select v.logement_id, v.id, t.libelle, t.statut,
       case when t.statut = 'a_commander' then null else (select id from public.entreprises order by raison_sociale desc limit 1) end
from public.vacances v
join public.logements l on l.id = v.logement_id
cross join (values ('Peinture (fictif)', 'fini'), ('Plomberie (fictif)', 'commande'), ('Serrurerie (fictif)', 'a_commander')) as t(libelle, statut)
where v.date_fin is null
  and ('x' || substr(md5(l.numero_esi), 1, 2))::bit(8)::int % 2 = 0;
