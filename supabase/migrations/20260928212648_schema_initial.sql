-- =====================================================================
-- Gestion des logements vacants — schéma initial Supabase (PostgreSQL 15+)
--
-- Principes :
--   * uuid comme clé technique ; N° ESI = identifiant métier unique.
--   * Un logement n'est JAMAIS supprimé : il change de statut ("Loué" = archivé).
--   * loyer + charges n'est pas stocké : calculé dans v_logements.
--   * Chaque période de vacance d'un logement est une ligne de `vacances`
--     (ouverte/fermée automatiquement selon le statut du logement).
--   * Historique alimenté uniquement par triggers (non falsifiable).
--   * Pas de cloisonnement par secteur : tout utilisateur actif voit tout,
--     deux rôles : admin (tout, dont paramètres) et utilisateur (logements, travaux...).
-- =====================================================================

create schema if not exists private;
create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------
-- 1. Types
-- ---------------------------------------------------------------------
create type public.role_utilisateur as enum ('admin', 'utilisateur');
create type public.entite_statut    as enum ('logement', 'travail');

-- ---------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------

-- Secteurs : conservés pour un éventuel cloisonnement futur (non utilisés par la RLS)
create table public.secteurs (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  libelle     text not null,
  created_at  timestamptz not null default now()
);

-- Profils utilisateurs (1-1 avec auth.users) — jamais supprimés : désactivés puis anonymisés
create table public.utilisateurs (
  id          uuid primary key references auth.users(id) on delete restrict,
  email       text not null,
  nom         text not null default '',
  prenom      text not null default '',
  role        public.role_utilisateur not null default 'utilisateur',
  actif       boolean not null default true,
  anonymise_le timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.utilisateurs_secteurs (
  utilisateur_id uuid not null references public.utilisateurs(id) on delete cascade,
  secteur_id     uuid not null references public.secteurs(id)     on delete cascade,
  primary key (utilisateur_id, secteur_id)
);

-- Référentiel des statuts (logement + travail)
create table public.statuts (
  code     text primary key,
  entite   public.entite_statut not null,
  libelle  text not null,
  ordre    smallint not null,
  unique (code, entite)              -- cible des FK composites
);

create table public.types_logements (
  code        text primary key,      -- 'T1', 'T2', ...
  libelle     text not null,
  nb_pieces   smallint check (nb_pieces > 0),
  ordre       smallint not null default 0
);

create table public.plafonds (
  code     text primary key,         -- 'PLAI', 'PLUS', 'PLS', 'PLI'
  libelle  text not null,
  ordre    smallint not null default 0
);

create table public.reservataires (
  id                 uuid primary key default gen_random_uuid(),
  nom                text not null unique,
  categorie          text not null default 'autre'
                     check (categorie in ('prefecture','action_logement','collectivite','bailleur','autre')),
  contact_nom        text,
  contact_email      text,
  contact_telephone  text,
  actif              boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table public.groupes (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,          -- n° de groupe métier
  nom          text not null,
  adresse      text,
  code_postal  text,
  commune      text,
  secteur_id   uuid references public.secteurs(id) on delete restrict,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.logements (
  id                  uuid primary key default gen_random_uuid(),
  numero_esi          text not null check (btrim(numero_esi) <> ''),
  groupe_id           uuid not null references public.groupes(id)            on delete restrict,
  type_logement_code  text not null references public.types_logements(code) on update cascade on delete restrict,
  plafond_code        text          references public.plafonds(code)        on update cascade on delete restrict,
  reservataire_id     uuid          references public.reservataires(id)     on delete restrict,

  statut_code         text not null default 'vacant_technique',
  statut_entite       public.entite_statut not null default 'logement'
                      check (statut_entite = 'logement'),

  adresse             text,
  batiment            text,
  escalier            text,
  etage               smallint,
  porte               text,
  surface_habitable   numeric(6,2) check (surface_habitable > 0),

  loyer               numeric(10,2) check (loyer   >= 0),
  charges             numeric(10,2) check (charges >= 0),
  -- loyer + charges : NON stocké → calculé dans v_logements
  -- dates de libération / disponibilité / location : portées par `vacances`

  commentaire         text,

  created_by          uuid references public.utilisateurs(id) default auth.uid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint logements_numero_esi_key unique (numero_esi),
  constraint logements_statut_fk foreign key (statut_code, statut_entite)
    references public.statuts(code, entite)
);

-- Une ligne par période de vacance d'un logement.
-- Ouverte (date_fin null) tant que le logement n'est pas loué.
create table public.vacances (
  id                  uuid primary key default gen_random_uuid(),
  logement_id         uuid not null references public.logements(id) on delete restrict,
  date_debut          date not null default current_date,  -- libération du logement
  date_disponibilite  date,                                -- prévision "prêt à louer"
  date_fin            date,                                -- prise d'effet du nouveau bail
  motif_depart        text,
  commentaire         text,
  created_by          uuid references public.utilisateurs(id) default auth.uid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint vacances_dates_coherentes check (date_fin is null or date_fin >= date_debut),
  -- deux vacances d'un même logement ne se chevauchent jamais (et une seule ouverte)
  constraint vacances_sans_chevauchement exclude using gist (
    logement_id with =,
    daterange(date_debut, date_fin, '[)') with &&
  ),
  unique (id, logement_id)          -- cible de la FK composite des travaux
);

create table public.entreprises (
  id              uuid primary key default gen_random_uuid(),
  raison_sociale  text not null,
  siret           text unique check (siret ~ '^\d{14}$'),
  corps_etat      text,                 -- plomberie, électricité, peinture...
  contact_nom     text,
  email           text,
  telephone       text,
  adresse         text,
  actif           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.travaux (
  id                   uuid primary key default gen_random_uuid(),
  logement_id          uuid not null references public.logements(id)   on delete restrict,
  vacance_id           uuid not null,   -- rempli automatiquement avec la vacance en cours si omis
  entreprise_id        uuid          references public.entreprises(id) on delete restrict,

  statut_code          text not null default 'a_commander',
  statut_entite        public.entite_statut not null default 'travail'
                       check (statut_entite = 'travail'),

  libelle              text not null,
  description          text,
  numero_bon_commande  text,
  montant_estime_ht    numeric(12,2) check (montant_estime_ht   >= 0),
  montant_commande_ht  numeric(12,2) check (montant_commande_ht >= 0),
  date_commande        date,   -- auto quand statut = 'commande'
  date_fin_prevue      date,
  date_fin_reelle      date,   -- auto quand statut = 'fini'

  created_by           uuid references public.utilisateurs(id) default auth.uid(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint travaux_statut_fk foreign key (statut_code, statut_entite)
    references public.statuts(code, entite),
  -- la vacance appartient forcément au même logement
  constraint travaux_vacance_fk foreign key (vacance_id, logement_id)
    references public.vacances(id, logement_id) on delete restrict,
  constraint travaux_entreprise_si_commande
    check (statut_code = 'a_commander' or entreprise_id is not null),
  unique (id, logement_id)           -- cible de la FK composite des photos
);

create table public.photos (
  id            uuid primary key default gen_random_uuid(),
  logement_id   uuid not null references public.logements(id) on delete restrict,
  travail_id    uuid,
  storage_path  text not null unique,     -- '{logement_id}/{fichier}' dans le bucket
  legende       text,
  prise_le      timestamptz,
  created_by    uuid references public.utilisateurs(id) default auth.uid(),
  created_at    timestamptz not null default now(),

  -- une photo de travaux appartient forcément au même logement
  constraint photos_travail_fk foreign key (travail_id, logement_id)
    references public.travaux(id, logement_id) on delete set null (travail_id),
  constraint photos_chemin_logement
    check (storage_path like logement_id::text || '/%')
);

create table public.historique (
  id               bigint generated always as identity primary key,
  logement_id      uuid not null references public.logements(id) on delete restrict,
  entite           text not null check (entite in ('logement','vacance','travail','photo')),
  entite_id        uuid not null,
  action           text not null check (action in ('creation','modification','suppression')),
  champ            text,            -- null pour creation / suppression
  ancienne_valeur  jsonb,
  nouvelle_valeur  jsonb,
  automatique      boolean not null default false,  -- true = changement fait par un trigger
  utilisateur_id   uuid references public.utilisateurs(id) on delete restrict,
  cree_le          timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. Index
-- ---------------------------------------------------------------------
create index on public.utilisateurs_secteurs (secteur_id);
create index on public.groupes   (secteur_id);
create index on public.logements (groupe_id);
create index on public.logements (statut_code);
create index on public.logements (reservataire_id);
create index on public.logements (type_logement_code);
create unique index vacances_une_ouverte_par_logement on public.vacances (logement_id) where date_fin is null;
create index on public.vacances  (logement_id, date_debut desc);
create index on public.travaux   (logement_id);
create index on public.travaux   (vacance_id);
create index on public.travaux   (entreprise_id);
create index on public.travaux   (statut_code);
create index on public.photos    (logement_id);
create index on public.photos    (travail_id);
create index on public.historique (logement_id, cree_le desc);

-- ---------------------------------------------------------------------
-- 4. Données de référence
-- ---------------------------------------------------------------------
insert into public.statuts (code, entite, libelle, ordre) values
  ('vacant_technique',  'logement', 'Vacant technique',  1),
  ('travaux_a_faire',   'logement', 'Travaux à faire',   2),
  ('travaux_commandes', 'logement', 'Travaux commandés', 3),
  ('travaux_finis',     'logement', 'Travaux finis',     4),
  ('a_louer',           'logement', 'À louer',           5),
  ('loue',              'logement', 'Loué',              6),
  ('a_commander',       'travail',  'À commander',       1),
  ('commande',          'travail',  'Commandé',          2),
  ('fini',              'travail',  'Fini',              3);

insert into public.types_logements (code, libelle, nb_pieces, ordre) values
  ('T1','T1',1,1), ('T2','T2',2,2), ('T3','T3',3,3),
  ('T4','T4',4,4), ('T5','T5',5,5), ('T6','T6 et +',6,6);

insert into public.plafonds (code, libelle, ordre) values
  ('PLAI','PLAI — Prêt locatif aidé d''intégration',1),
  ('PLUS','PLUS — Prêt locatif à usage social',2),
  ('PLS', 'PLS — Prêt locatif social',3),
  ('PLI', 'PLI — Prêt locatif intermédiaire',4);

-- ---------------------------------------------------------------------
-- 5. Fonctions & triggers métier
-- ---------------------------------------------------------------------

-- Indicateur "changement automatique" lu par la journalisation
-- (positionné par les triggers d'automatisation le temps de leurs écritures).
create or replace function private.debut_auto()
returns text language plpgsql set search_path = '' as $$
declare
  v_precedent text := coalesce(current_setting('app.changement_auto', true), '');
begin
  perform set_config('app.changement_auto', 'on', true);
  return v_precedent;
end $$;

create or replace function private.fin_auto(p_precedent text)
returns void language plpgsql set search_path = '' as $$
begin
  perform set_config('app.changement_auto', p_precedent, true);
end $$;

-- updated_at
create or replace function private.maj_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger trg_utilisateurs_maj  before update on public.utilisateurs  for each row execute function private.maj_updated_at();
create trigger trg_reservataires_maj before update on public.reservataires for each row execute function private.maj_updated_at();
create trigger trg_groupes_maj       before update on public.groupes       for each row execute function private.maj_updated_at();
create trigger trg_logements_maj     before update on public.logements     for each row execute function private.maj_updated_at();
create trigger trg_vacances_maj      before update on public.vacances      for each row execute function private.maj_updated_at();
create trigger trg_entreprises_maj   before update on public.entreprises   for each row execute function private.maj_updated_at();
create trigger trg_travaux_maj       before update on public.travaux       for each row execute function private.maj_updated_at();

-- Interdiction absolue de supprimer un logement (y compris service_role)
create or replace function private.interdire_suppression_logement()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Suppression interdite : un logement ne se supprime jamais, changez son statut.'
    using errcode = 'restrict_violation';
end $$;

create trigger trg_logements_no_delete   before delete   on public.logements
  for each row       execute function private.interdire_suppression_logement();
create trigger trg_logements_no_truncate before truncate on public.logements
  for each statement execute function private.interdire_suppression_logement();

-- Ouverture / fermeture automatique des vacances selon le statut du logement
--   * création d'un logement non loué        → ouvre une vacance
--   * passage à "Loué"                        → ferme la vacance en cours (date_fin = aujourd'hui)
--   * sortie de "Loué"                        → ouvre une nouvelle vacance,
--       sauf si la dernière a été fermée aujourd'hui (correction d'erreur) → elle est rouverte
create or replace function private.synchroniser_vacance()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_prec     text;
  v_derniere public.vacances%rowtype;
begin
  if tg_op = 'UPDATE' and old.statut_code is not distinct from new.statut_code then
    return null;
  end if;

  v_prec := private.debut_auto();

  if tg_op = 'INSERT' then
    if new.statut_code <> 'loue' then
      insert into public.vacances (logement_id, date_debut) values (new.id, current_date);
    end if;

  elsif new.statut_code = 'loue' then
    update public.vacances
       set date_fin = greatest(current_date, date_debut)
     where logement_id = new.id and date_fin is null;

  elsif old.statut_code = 'loue' then
    select * into v_derniere
      from public.vacances
     where logement_id = new.id
     order by date_debut desc, created_at desc
     limit 1;

    if found and v_derniere.date_fin = current_date then
      update public.vacances set date_fin = null where id = v_derniere.id;
    else
      insert into public.vacances (logement_id, date_debut)
      values (new.id, greatest(current_date, coalesce(v_derniere.date_fin, current_date)));
    end if;
  end if;

  perform private.fin_auto(v_prec);
  return null;
end $$;

create trigger trg_logements_vacance after insert or update of statut_code on public.logements
  for each row execute function private.synchroniser_vacance();

-- Travaux : rattachement à la vacance en cours + dates automatiques
create or replace function private.preparer_travail()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.vacance_id is null then
    select v.id into new.vacance_id
      from public.vacances v
     where v.logement_id = new.logement_id and v.date_fin is null;
    if new.vacance_id is null then
      raise exception 'Aucune vacance en cours pour ce logement : précisez vacance_id.'
        using errcode = 'not_null_violation';
    end if;
  end if;

  if new.statut_code in ('commande', 'fini') and new.date_commande is null then
    new.date_commande := current_date;
  end if;
  if new.statut_code = 'fini' and new.date_fin_reelle is null then
    new.date_fin_reelle := current_date;
  end if;
  return new;
end $$;

create trigger trg_travaux_preparer before insert or update of statut_code, vacance_id on public.travaux
  for each row execute function private.preparer_travail();

-- Passage automatique du logement à "Travaux finis" quand tous les travaux
-- de la vacance en cours sont "Fini". Ne s'applique qu'aux logements encore
-- en phase travaux (vacant technique / travaux à faire / travaux commandés) :
-- un statut posé manuellement plus loin (À louer, Loué...) n'est jamais écrasé.
create or replace function private.statut_auto_travaux_finis()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_logement uuid;
  v_statut   text;
  v_vacance  uuid;
  v_prec     text;
begin
  v_logement := case when tg_op = 'DELETE' then old.logement_id else new.logement_id end;

  select l.statut_code into v_statut
    from public.logements l where l.id = v_logement
    for update;

  if v_statut not in ('vacant_technique', 'travaux_a_faire', 'travaux_commandes') then
    return null;
  end if;

  select v.id into v_vacance
    from public.vacances v where v.logement_id = v_logement and v.date_fin is null;
  if v_vacance is null then
    return null;
  end if;

  if exists     (select 1 from public.travaux t where t.vacance_id = v_vacance)
     and not exists (select 1 from public.travaux t where t.vacance_id = v_vacance and t.statut_code <> 'fini')
  then
    v_prec := private.debut_auto();
    update public.logements set statut_code = 'travaux_finis' where id = v_logement;
    perform private.fin_auto(v_prec);
  end if;

  return null;
end $$;

create trigger trg_travaux_statut_logement
  after insert or update of statut_code, vacance_id or delete on public.travaux
  for each row execute function private.statut_auto_travaux_finis();

-- Journalisation générique → historique (1 ligne par champ modifié)
create or replace function private.journaliser()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entite   text := tg_argv[0];
  v_user     uuid := auth.uid();
  v_auto     boolean := coalesce(current_setting('app.changement_auto', true), '') = 'on';
  v_old      jsonb;
  v_new      jsonb;
  v_row      jsonb;
  v_logement uuid;
  k          text;
begin
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  -- logements : id ; vacances/travaux/photos : logement_id
  v_logement := coalesce((v_row->>'logement_id')::uuid, (v_row->>'id')::uuid);

  if tg_op = 'INSERT' then
    insert into public.historique (logement_id, entite, entite_id, action, nouvelle_valeur, automatique, utilisateur_id)
    values (v_logement, v_entite, (v_row->>'id')::uuid, 'creation', v_row, v_auto, v_user);
    return null;

  elsif tg_op = 'DELETE' then
    insert into public.historique (logement_id, entite, entite_id, action, ancienne_valeur, automatique, utilisateur_id)
    values (v_logement, v_entite, (v_row->>'id')::uuid, 'suppression', v_row, v_auto, v_user);
    return null;

  else
    v_old := to_jsonb(old);
    v_new := v_row;
    for k in select jsonb_object_keys(v_new) loop
      continue when k in ('updated_at', 'created_at', 'statut_entite');
      if v_old -> k is distinct from v_new -> k then
        insert into public.historique
          (logement_id, entite, entite_id, action, champ, ancienne_valeur, nouvelle_valeur, automatique, utilisateur_id)
        values
          (v_logement, v_entite, (v_row->>'id')::uuid, 'modification', k, v_old -> k, v_new -> k, v_auto, v_user);
      end if;
    end loop;
    return null;
  end if;
end $$;

create trigger trg_logements_historique after insert or update on public.logements
  for each row execute function private.journaliser('logement');
create trigger trg_vacances_historique  after insert or update or delete on public.vacances
  for each row execute function private.journaliser('vacance');
create trigger trg_travaux_historique   after insert or update or delete on public.travaux
  for each row execute function private.journaliser('travail');
create trigger trg_photos_historique    after insert or update or delete on public.photos
  for each row execute function private.journaliser('photo');

-- Création automatique du profil (rôle utilisateur). Les inscriptions publiques sont désactivées :
-- seuls les comptes invités par un administrateur existent.
create or replace function private.creer_profil_utilisateur()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.utilisateurs (id, email, nom, prenom)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'nom', ''),
    coalesce(new.raw_user_meta_data->>'prenom', '')
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.creer_profil_utilisateur();

-- ---------------------------------------------------------------------
-- 6. Fonctions d'aide RLS (schéma private, non exposé par l'API)
-- ---------------------------------------------------------------------
create or replace function private.role_courant()
returns public.role_utilisateur
language sql stable security definer set search_path = '' as $$
  select u.role from public.utilisateurs u
  where u.id = (select auth.uid()) and u.actif
$$;

create or replace function private.est_actif()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.role_courant() is not null
$$;

create or replace function private.est_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(private.role_courant() = 'admin', false)
$$;

create or replace function private.peut_ecrire()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(private.role_courant() in ('admin', 'utilisateur'), false)
$$;

-- Règle d'accès : pas de cloisonnement, tout utilisateur actif accède à tous les groupes.
-- (Pour réintroduire un cloisonnement par secteur plus tard, c'est ici.)
create or replace function private.acces_groupe(p_groupe_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.est_actif()
$$;

create or replace function private.acces_logement(p_logement_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select private.acces_groupe(l.groupe_id) from public.logements l where l.id = p_logement_id),
    false)
$$;

-- Pour Storage : chemin '{logement_id}/...'
create or replace function private.acces_logement_chemin(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then private.acces_logement(split_part(p_name, '/', 1)::uuid)
    else false
  end
$$;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
revoke execute on all functions in schema private from public, anon;
grant  execute on all functions in schema private to authenticated;

-- Le trigger de création de profil est déclenché par le service Auth de Supabase
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant usage on schema private to supabase_auth_admin;
    grant execute on function private.creer_profil_utilisateur() to supabase_auth_admin;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 7. RGPD : anonymisation d'un utilisateur (au lieu d'une suppression)
--    Appel (admin uniquement) : select public.anonymiser_utilisateur('<uuid>');
--    L'historique conserve l'uuid, qui ne renvoie plus qu'à un profil anonyme.
-- ---------------------------------------------------------------------
create or replace function public.anonymiser_utilisateur(p_utilisateur_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_email text := 'anonyme-' || p_utilisateur_id::text || '@anonyme.invalid';
begin
  if not private.est_admin() then
    raise exception 'Réservé aux administrateurs.' using errcode = 'insufficient_privilege';
  end if;
  if p_utilisateur_id = auth.uid() then
    raise exception 'Un administrateur ne peut pas s''anonymiser lui-même.';
  end if;

  update public.utilisateurs
     set email = v_email, nom = 'Utilisateur', prenom = 'anonymisé',
         actif = false, anonymise_le = now()
   where id = p_utilisateur_id;
  if not found then
    raise exception 'Utilisateur % introuvable.', p_utilisateur_id;
  end if;

  -- Compte Auth : e-mail/téléphone/métadonnées effacés, connexion bloquée
  update auth.users
     set email = v_email, phone = null, raw_user_meta_data = '{}'::jsonb,
         banned_until = now() + interval '100 years'
   where id = p_utilisateur_id;
  update auth.identities
     set identity_data = jsonb_build_object('sub', p_utilisateur_id::text, 'email', v_email)
   where user_id = p_utilisateur_id;
  delete from auth.sessions where user_id = p_utilisateur_id;
end $$;

revoke execute on function public.anonymiser_utilisateur(uuid) from public, anon;
grant  execute on function public.anonymiser_utilisateur(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 8. Vues de lecture (RLS de l'appelant appliquée)
-- ---------------------------------------------------------------------
create view public.v_logements
with (security_invoker = true) as
select
  l.*,
  l.loyer + l.charges        as loyer_charges,
  (l.statut_code = 'loue')   as archive,
  s.libelle                  as statut_libelle,
  s.ordre                    as statut_ordre,
  g.code                     as groupe_code,
  g.nom                      as groupe_nom,
  t.libelle                  as type_logement_libelle,
  r.nom                      as reservataire_nom,
  dv.id                      as derniere_vacance_id,
  dv.date_debut              as date_liberation,
  dv.date_disponibilite,
  dv.date_fin                as date_location,
  case when dv.id is not null and dv.date_fin is null
       then current_date - dv.date_debut end as duree_vacance_jours
from public.logements l
join public.statuts         s on s.code = l.statut_code
join public.groupes         g on g.id   = l.groupe_id
join public.types_logements t on t.code = l.type_logement_code
left join public.reservataires r on r.id = l.reservataire_id
left join lateral (
  select v.* from public.vacances v
  where v.logement_id = l.id
  order by v.date_debut desc, v.created_at desc
  limit 1
) dv on true;

-- Indicateurs par vacance (durée, coût des travaux)
create view public.v_vacances
with (security_invoker = true) as
select
  v.*,
  l.numero_esi,
  (v.date_fin is null)                                   as en_cours,
  coalesce(v.date_fin, current_date) - v.date_debut      as duree_jours,
  count(t.id)                                            as nb_travaux,
  count(t.id) filter (where t.statut_code = 'fini')      as nb_travaux_finis,
  coalesce(sum(t.montant_estime_ht),   0)                as montant_estime_ht,
  coalesce(sum(t.montant_commande_ht), 0)                as montant_commande_ht
from public.vacances v
join public.logements l on l.id = v.logement_id
left join public.travaux t on t.vacance_id = v.id
group by v.id, l.numero_esi;

-- ---------------------------------------------------------------------
-- 9. Droits de base (défense en profondeur, en plus de la RLS)
-- ---------------------------------------------------------------------
revoke delete, truncate on public.logements from anon, authenticated;
revoke insert, update, delete, truncate on public.historique from anon, authenticated;

-- ---------------------------------------------------------------------
-- 10. RLS
-- ---------------------------------------------------------------------
alter table public.secteurs              enable row level security;
alter table public.utilisateurs          enable row level security;
alter table public.utilisateurs_secteurs enable row level security;
alter table public.statuts               enable row level security;
alter table public.types_logements       enable row level security;
alter table public.plafonds              enable row level security;
alter table public.reservataires         enable row level security;
alter table public.groupes               enable row level security;
alter table public.logements             enable row level security;
alter table public.vacances              enable row level security;
alter table public.entreprises           enable row level security;
alter table public.travaux               enable row level security;
alter table public.photos                enable row level security;
alter table public.historique            enable row level security;

-- secteurs
create policy secteurs_select on public.secteurs for select to authenticated using (private.est_actif());
create policy secteurs_admin  on public.secteurs for all    to authenticated
  using (private.est_admin()) with check (private.est_admin());

-- utilisateurs : visibles par les actifs (noms dans l'historique), modifiables par admin seul
create policy utilisateurs_select on public.utilisateurs for select to authenticated
  using (id = (select auth.uid()) or private.est_actif());
create policy utilisateurs_update_admin on public.utilisateurs for update to authenticated
  using (private.est_admin()) with check (private.est_admin());
-- pas d'INSERT (trigger) ni de DELETE (désactivation / anonymisation)

-- utilisateurs_secteurs
create policy us_select on public.utilisateurs_secteurs for select to authenticated
  using (utilisateur_id = (select auth.uid()) or private.est_admin());
create policy us_admin  on public.utilisateurs_secteurs for all to authenticated
  using (private.est_admin()) with check (private.est_admin());

-- référentiels : lecture actifs, écriture admin
create policy statuts_select on public.statuts for select to authenticated using (private.est_actif());
create policy statuts_admin  on public.statuts for all    to authenticated
  using (private.est_admin()) with check (private.est_admin());

create policy types_select on public.types_logements for select to authenticated using (private.est_actif());
create policy types_admin  on public.types_logements for all    to authenticated
  using (private.est_admin()) with check (private.est_admin());

create policy plafonds_select on public.plafonds for select to authenticated using (private.est_actif());
create policy plafonds_admin  on public.plafonds for all    to authenticated
  using (private.est_admin()) with check (private.est_admin());

create policy reservataires_select on public.reservataires for select to authenticated using (private.est_actif());
create policy reservataires_admin  on public.reservataires for all    to authenticated
  using (private.est_admin()) with check (private.est_admin());

-- entreprises : utilisateurs peuvent créer/modifier, admin seul supprime
create policy entreprises_select on public.entreprises for select to authenticated using (private.est_actif());
create policy entreprises_insert on public.entreprises for insert to authenticated with check (private.peut_ecrire());
create policy entreprises_update on public.entreprises for update to authenticated
  using (private.peut_ecrire()) with check (private.peut_ecrire());
create policy entreprises_delete on public.entreprises for delete to authenticated using (private.est_admin());

-- groupes : lecture actifs, écriture admin
create policy groupes_select on public.groupes for select to authenticated using (private.acces_groupe(id));
create policy groupes_admin  on public.groupes for all    to authenticated
  using (private.est_admin()) with check (private.est_admin());

-- logements : lecture actifs, écriture utilisateur/admin, JAMAIS de delete
create policy logements_select on public.logements for select to authenticated
  using (private.acces_groupe(groupe_id));
create policy logements_insert on public.logements for insert to authenticated
  with check (private.peut_ecrire() and private.acces_groupe(groupe_id));
create policy logements_update on public.logements for update to authenticated
  using      (private.peut_ecrire() and private.acces_groupe(groupe_id))
  with check (private.peut_ecrire() and private.acces_groupe(groupe_id));

-- vacances : ouverture/fermeture par trigger, dates éditables par utilisateur/admin
create policy vacances_select on public.vacances for select to authenticated
  using (private.acces_logement(logement_id));
create policy vacances_insert on public.vacances for insert to authenticated
  with check (private.peut_ecrire() and private.acces_logement(logement_id));
create policy vacances_update on public.vacances for update to authenticated
  using      (private.peut_ecrire() and private.acces_logement(logement_id))
  with check (private.peut_ecrire() and private.acces_logement(logement_id));
create policy vacances_delete on public.vacances for delete to authenticated
  using (private.est_admin());

-- travaux
create policy travaux_select on public.travaux for select to authenticated
  using (private.acces_logement(logement_id));
create policy travaux_insert on public.travaux for insert to authenticated
  with check (private.peut_ecrire() and private.acces_logement(logement_id));
create policy travaux_update on public.travaux for update to authenticated
  using      (private.peut_ecrire() and private.acces_logement(logement_id))
  with check (private.peut_ecrire() and private.acces_logement(logement_id));
create policy travaux_delete on public.travaux for delete to authenticated
  using (private.est_admin());

-- photos
create policy photos_select on public.photos for select to authenticated
  using (private.acces_logement(logement_id));
create policy photos_insert on public.photos for insert to authenticated
  with check (private.peut_ecrire() and private.acces_logement(logement_id));
create policy photos_update on public.photos for update to authenticated
  using      (private.peut_ecrire() and private.acces_logement(logement_id))
  with check (private.peut_ecrire() and private.acces_logement(logement_id));
create policy photos_delete on public.photos for delete to authenticated
  using (private.peut_ecrire() and private.acces_logement(logement_id));

-- historique : lecture seule
create policy historique_select on public.historique for select to authenticated
  using (private.acces_logement(logement_id));

-- ---------------------------------------------------------------------
-- 11. Storage : bucket privé des photos
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('photos-logements', 'photos-logements', false)
on conflict (id) do nothing;

create policy photos_storage_select on storage.objects for select to authenticated
  using (bucket_id = 'photos-logements' and private.acces_logement_chemin(name));
create policy photos_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'photos-logements' and private.peut_ecrire() and private.acces_logement_chemin(name));
create policy photos_storage_update on storage.objects for update to authenticated
  using      (bucket_id = 'photos-logements' and private.peut_ecrire() and private.acces_logement_chemin(name))
  with check (bucket_id = 'photos-logements' and private.peut_ecrire() and private.acces_logement_chemin(name));
create policy photos_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'photos-logements' and private.peut_ecrire() and private.acces_logement_chemin(name));
