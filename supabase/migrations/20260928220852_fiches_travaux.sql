-- =====================================================================
-- Fiche travaux et page « Travaux des vacants »
--
-- La « fiche travaux » d'un logement est sa VACANCE en cours :
--   * elle est créée automatiquement à la création d'un logement vacant
--     (trigger trg_logements_vacance, migration initiale) ;
--   * N° ESI, groupe, étage et type ne sont PAS recopiés : ils sont lus en direct
--     depuis le logement (pas de valeurs divergentes après une correction) ;
--   * chaque relocation ouvre une nouvelle fiche, les anciennes restent consultables.
--
-- Cette migration ajoute :
--   * la progression des travaux (finis / total) dans v_logements ;
--   * le filtre N° ESI et le tri par progression dans rechercher_logements ;
--   * le statut automatique du logement selon l'avancement des travaux ;
--   * les dates des travaux remises à zéro quand un statut revient en arrière ;
--   * le rattachement des photos à la vacance + miniatures ; limites du bucket.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Progression des travaux (colonnes ajoutées en fin de vue)
-- ---------------------------------------------------------------------
create or replace view public.v_logements
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
  p.libelle                  as plafond_libelle,
  r.nom                      as reservataire_nom,
  dv.id                      as derniere_vacance_id,
  dv.date_debut              as date_liberation,
  dv.date_disponibilite      as date_reprise,
  dv.date_fin                as date_location,
  dv.nom_ancien_locataire,
  dv.date_preavis,
  dv.date_envoi_reservataire,
  case when dv.id is not null and dv.date_fin is null
       then current_date - dv.date_debut end as duree_vacance_jours,
  coalesce(tr.nb, 0)         as nb_travaux,
  case
    when coalesce(tr.nb, 0) = 0 then 'aucun'
    when tr.nb_a_commander > 0  then 'a_commander'
    when tr.nb_commande > 0     then 'commande'
    else 'fini'
  end                        as statut_travaux,
  case
    when coalesce(tr.nb, 0) = 0 then 0
    when tr.nb_a_commander > 0  then 1
    when tr.nb_commande > 0     then 2
    else 3
  end                        as statut_travaux_ordre,
  coalesce(tr.nb_fini, 0)    as nb_travaux_finis,
  case when coalesce(tr.nb, 0) > 0
       then round(100.0 * tr.nb_fini / tr.nb)::integer end as progression_travaux
from public.logements l
join public.statuts         s on s.code = l.statut_code
join public.groupes         g on g.id   = l.groupe_id
join public.types_logements t on t.code = l.type_logement_code
left join public.plafonds      p on p.code = l.plafond_code
left join public.reservataires r on r.id   = l.reservataire_id
left join lateral (
  select v.* from public.vacances v
  where v.logement_id = l.id
  order by v.date_debut desc, v.created_at desc
  limit 1
) dv on true
left join lateral (
  select count(*)                                              as nb,
         count(*) filter (where tv.statut_code = 'a_commander') as nb_a_commander,
         count(*) filter (where tv.statut_code = 'commande')    as nb_commande,
         count(*) filter (where tv.statut_code = 'fini')        as nb_fini
  from public.travaux tv
  where tv.vacance_id = dv.id
) tr on true;

-- ---------------------------------------------------------------------
-- Recherche : + filtre numero_esi (contient, sans accents) + tri par progression
-- ---------------------------------------------------------------------
create or replace function public.rechercher_logements(
  p_recherche text    default null,
  p_filtres   jsonb   default '{}'::jsonb,
  p_tri       text    default 'numero_esi',
  p_sens      text    default 'asc',
  p_page      integer default 1,
  p_taille    integer default 25
)
returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  v_colonnes_tri constant text[] := array[
    'numero_esi', 'groupe_nom', 'reservataire_nom', 'date_envoi_reservataire', 'date_reprise',
    'plafond_code', 'nom_ancien_locataire', 'type_logement_code', 'etage', 'surface_habitable',
    'loyer', 'charges', 'loyer_charges', 'date_preavis', 'statut_travaux_ordre', 'statut_ordre',
    'commentaire', 'date_liberation', 'duree_vacance_jours', 'progression_travaux'];
  v_tri      text    := case when p_tri = any (v_colonnes_tri) then p_tri else 'numero_esi' end;
  v_sens     text    := case when lower(p_sens) = 'desc' then 'desc' else 'asc' end;
  v_taille   integer := least(greatest(coalesce(p_taille, 25), 1), 200);
  v_decalage integer := (greatest(coalesce(p_page, 1), 1) - 1) * v_taille;
  v_motif    text    := nullif(private.normaliser(btrim(p_recherche)), '');
  v_resultat jsonb;
begin
  execute format($sql$
    with trouves as (
      select v.*,
             count(*) over ()                                                     as total,
             row_number() over (order by %1$I %2$s nulls last, v.numero_esi, v.id) as rang
      from public.v_logements v
      where ($1::text is null or strpos(private.normaliser(concat_ws(' ',
               v.numero_esi, v.groupe_code, v.groupe_nom, v.reservataire_nom, v.nom_ancien_locataire,
               v.adresse, v.batiment, v.commentaire, v.plafond_code, v.type_logement_code, v.statut_libelle)), $1) > 0)
        and (coalesce(($2->>'inclure_loues')::boolean, false) or v.statut_code <> 'loue' or $2->>'statut_code' = 'loue')
        and ($2->>'numero_esi'         is null
             or strpos(private.normaliser(v.numero_esi), private.normaliser($2->>'numero_esi')) > 0)
        and ($2->>'statut_code'        is null or v.statut_code        = $2->>'statut_code')
        and ($2->>'statut_travaux'     is null or v.statut_travaux     = $2->>'statut_travaux')
        and ($2->>'groupe_id'          is null or v.groupe_id::text    = $2->>'groupe_id')
        and ($2->>'reservataire_id'    is null
             or ($2->>'reservataire_id' = 'aucun' and v.reservataire_id is null)
             or v.reservataire_id::text = $2->>'reservataire_id')
        and ($2->>'plafond_code'       is null or v.plafond_code       = $2->>'plafond_code')
        and ($2->>'type_logement_code' is null or v.type_logement_code = $2->>'type_logement_code')
        and ($2->>'etage'              is null or v.etage              = ($2->>'etage')::smallint)
        and ($2->>'surface_min'        is null or v.surface_habitable >= ($2->>'surface_min')::numeric)
        and ($2->>'surface_max'        is null or v.surface_habitable <= ($2->>'surface_max')::numeric)
        and ($2->>'loyer_charges_min'  is null or v.loyer_charges     >= ($2->>'loyer_charges_min')::numeric)
        and ($2->>'loyer_charges_max'  is null or v.loyer_charges     <= ($2->>'loyer_charges_max')::numeric)
        and ($2->>'date_preavis_du'    is null or v.date_preavis            >= ($2->>'date_preavis_du')::date)
        and ($2->>'date_preavis_au'    is null or v.date_preavis            <= ($2->>'date_preavis_au')::date)
        and ($2->>'date_envoi_du'      is null or v.date_envoi_reservataire >= ($2->>'date_envoi_du')::date)
        and ($2->>'date_envoi_au'      is null or v.date_envoi_reservataire <= ($2->>'date_envoi_au')::date)
        and ($2->>'date_reprise_du'    is null or v.date_reprise            >= ($2->>'date_reprise_du')::date)
        and ($2->>'date_reprise_au'    is null or v.date_reprise            <= ($2->>'date_reprise_au')::date)
    )
    select jsonb_build_object(
      'total',  coalesce(max(total), 0),
      'lignes', coalesce(jsonb_agg(to_jsonb(t) - 'total' - 'rang' order by rang)
                           filter (where rang > $3 and rang <= $3 + $4), '[]'::jsonb))
    from trouves t
  $sql$, v_tri, v_sens)
  into v_resultat
  using v_motif, coalesce(p_filtres, '{}'::jsonb), v_decalage, v_taille;

  return v_resultat;
end $$;

-- ---------------------------------------------------------------------
-- Statut du logement selon l'avancement des travaux de la vacance en cours
--   au moins un « À commander »  → Travaux à faire
--   sinon au moins un « Commandé » → Travaux commandés
--   tous « Fini »                  → Travaux finis
-- Ne s'applique qu'aux logements en phase travaux (vacant technique, travaux à faire,
-- travaux commandés, travaux finis) : « À louer » et « Loué » ne sont jamais écrasés.
-- Le statut reste modifiable à la main (confirmation dans l'interface) ; la règle ne
-- s'applique à nouveau qu'au prochain changement sur les travaux.
-- ---------------------------------------------------------------------
drop trigger trg_travaux_statut_logement on public.travaux;
drop function private.statut_auto_travaux_finis();

create or replace function private.statut_logement_selon_travaux()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_logement    uuid := case when tg_op = 'DELETE' then old.logement_id else new.logement_id end;
  v_statut      text;
  v_vacance     uuid;
  v_nb          integer;
  v_a_commander integer;
  v_commande    integer;
  v_cible       text;
  v_prec        text;
begin
  select l.statut_code into v_statut
    from public.logements l where l.id = v_logement
    for update;

  if v_statut is null
     or v_statut not in ('vacant_technique', 'travaux_a_faire', 'travaux_commandes', 'travaux_finis') then
    return null;
  end if;

  select v.id into v_vacance
    from public.vacances v where v.logement_id = v_logement and v.date_fin is null;
  if v_vacance is null then
    return null;
  end if;

  select count(*),
         count(*) filter (where t.statut_code = 'a_commander'),
         count(*) filter (where t.statut_code = 'commande')
    into v_nb, v_a_commander, v_commande
    from public.travaux t where t.vacance_id = v_vacance;

  if v_nb = 0 then
    return null;   -- plus aucun travail : on ne devine pas, le statut reste tel quel
  end if;

  v_cible := case
    when v_a_commander > 0 then 'travaux_a_faire'
    when v_commande > 0    then 'travaux_commandes'
    else 'travaux_finis'
  end;

  if v_cible <> v_statut then
    v_prec := private.debut_auto();
    update public.logements set statut_code = v_cible where id = v_logement;
    perform private.fin_auto(v_prec);
  end if;

  return null;
end $$;

create trigger trg_travaux_statut_logement
  after insert or update of statut_code, vacance_id or delete on public.travaux
  for each row execute function private.statut_logement_selon_travaux();

-- ---------------------------------------------------------------------
-- Travaux : dates automatiques, y compris retour en arrière de statut
-- ---------------------------------------------------------------------
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

  -- statut revenu en arrière : les dates des étapes annulées sont effacées
  if tg_op = 'UPDATE' and new.statut_code is distinct from old.statut_code then
    if new.statut_code = 'a_commander' then
      new.date_commande   := null;
      new.date_fin_reelle := null;
    elsif new.statut_code = 'commande' then
      new.date_fin_reelle := null;
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

-- ---------------------------------------------------------------------
-- Photos : rattachement à la vacance (fiche travaux) + miniature
-- ---------------------------------------------------------------------
alter table public.photos
  add column vacance_id     uuid,
  add column miniature_path text;

alter table public.photos
  add constraint photos_vacance_fk foreign key (vacance_id, logement_id)
    references public.vacances(id, logement_id) on delete restrict,
  add constraint photos_miniature_chemin
    check (miniature_path is null or miniature_path like logement_id::text || '/%');

create index on public.photos (vacance_id, created_at);

create or replace function private.rattacher_photo()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.vacance_id is null then
    select v.id into new.vacance_id
      from public.vacances v
     where v.logement_id = new.logement_id
     order by v.date_debut desc, v.created_at desc
     limit 1;
  end if;
  return new;
end $$;

create trigger trg_photos_rattacher before insert on public.photos
  for each row execute function private.rattacher_photo();

-- Photos compressées dans le navigateur avant envoi : 10 Mo et 3 formats suffisent.
update storage.buckets
   set file_size_limit    = 10 * 1024 * 1024,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id = 'photos-logements';

-- ---------------------------------------------------------------------
-- Travaux avec le nom de l'entreprise (lecture de la fiche travaux)
-- ---------------------------------------------------------------------
create view public.v_travaux
with (security_invoker = true) as
select
  t.*,
  e.raison_sociale as entreprise_nom,
  s.libelle        as statut_libelle
from public.travaux t
join public.statuts s on s.code = t.statut_code
left join public.entreprises e on e.id = t.entreprise_id;
