-- =====================================================================
-- Page « Gestion des vacants »
--   * champs propres à chaque vacance : ancien locataire, préavis, envoi au réservataire
--   * « Date de reprise » = remise en location prévue (vacances.date_disponibilite)
--   * statut des travaux calculé à partir des travaux de la dernière vacance
--   * recherche / filtres / tri / pagination côté base : rechercher_logements()
--   * enregistrement atomique logement + vacance : enregistrer_logement()
-- =====================================================================

create extension if not exists unaccent with schema extensions;

alter table public.vacances
  add column nom_ancien_locataire     text,
  add column date_preavis             date,   -- réception du préavis du locataire sortant
  add column date_envoi_reservataire  date;   -- envoi du logement au réservataire

comment on column public.vacances.date_debut         is 'Date de libération du logement (début de la vacance)';
comment on column public.vacances.date_disponibilite is 'Date de reprise : remise en location prévue';

-- Minuscules sans accents, pour une recherche tolérante (« chloe » trouve « Chloé »)
create or replace function private.normaliser(p_texte text)
returns text language sql immutable parallel safe set search_path = '' as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p_texte, '')))
$$;

revoke execute on function private.normaliser(text) from public, anon;
grant  execute on function private.normaliser(text) to authenticated;

-- ---------------------------------------------------------------------
-- Vue des logements : dernière vacance + statut des travaux
-- ---------------------------------------------------------------------
drop view public.v_logements;

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
  end                        as statut_travaux_ordre
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
         count(*) filter (where tv.statut_code = 'commande')    as nb_commande
  from public.travaux tv
  where tv.vacance_id = dv.id
) tr on true;

-- ---------------------------------------------------------------------
-- Recherche paginée
--   p_filtres (tous facultatifs, combinables) :
--     statut_code, statut_travaux, groupe_id, reservataire_id ('aucun' = sans réservataire),
--     plafond_code, type_logement_code, etage,
--     surface_min/max, loyer_charges_min/max,
--     date_preavis_du/au, date_envoi_du/au, date_reprise_du/au,
--     inclure_loues (false par défaut : les logements loués sont dans les Archives)
--   Retour : { "total": n, "lignes": [ ...v_logements ] }
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
    'commentaire', 'date_liberation', 'duree_vacance_jours'];
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
-- Création / modification d'un logement et des champs de sa dernière vacance,
-- en une seule transaction. RLS de l'appelant appliquée (security invoker).
--   p_id null → création ; sinon modification.
-- ---------------------------------------------------------------------
create or replace function public.enregistrer_logement(p_id uuid, p_logement jsonb, p_vacance jsonb default '{}'::jsonb)
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  l              public.logements := jsonb_populate_record(null::public.logements, p_logement);
  v              public.vacances  := jsonb_populate_record(null::public.vacances, coalesce(p_vacance, '{}'::jsonb));
  v_id           uuid := p_id;
  v_ancien       text;
  v_vacance      uuid;
begin
  if v_id is null then
    insert into public.logements (
      numero_esi, groupe_id, type_logement_code, plafond_code, reservataire_id, statut_code,
      adresse, batiment, escalier, etage, porte, surface_habitable, loyer, charges, commentaire)
    values (
      btrim(l.numero_esi), l.groupe_id, l.type_logement_code, l.plafond_code, l.reservataire_id,
      coalesce(l.statut_code, 'vacant_technique'),
      l.adresse, l.batiment, l.escalier, l.etage, l.porte, l.surface_habitable, l.loyer, l.charges, l.commentaire)
    returning id into v_id;
  else
    select statut_code into v_ancien from public.logements where id = v_id;

    update public.logements set
      numero_esi         = btrim(l.numero_esi),
      groupe_id          = l.groupe_id,
      type_logement_code = l.type_logement_code,
      plafond_code       = l.plafond_code,
      reservataire_id    = l.reservataire_id,
      statut_code        = coalesce(l.statut_code, statut_code),
      adresse            = l.adresse,
      batiment           = l.batiment,
      escalier           = l.escalier,
      etage              = l.etage,
      porte              = l.porte,
      surface_habitable  = l.surface_habitable,
      loyer              = l.loyer,
      charges            = l.charges,
      commentaire        = l.commentaire
    where id = v_id;

    if not found then
      raise exception 'Logement introuvable ou modification non autorisée.' using errcode = 'insufficient_privilege';
    end if;

    -- Un logement qui sort de « Loué » ouvre une NOUVELLE vacance : on ne recopie pas
    -- dessus les informations de l'ancienne (ancien locataire, préavis…) affichées dans le formulaire.
    if v_ancien = 'loue' and coalesce(l.statut_code, v_ancien) <> 'loue' then
      return v_id;
    end if;
  end if;

  select id into v_vacance
    from public.vacances
   where logement_id = v_id
   order by date_debut desc, created_at desc
   limit 1;

  if v_vacance is not null then
    update public.vacances set
      date_debut              = coalesce(v.date_debut, date_debut),
      date_disponibilite      = v.date_disponibilite,
      nom_ancien_locataire    = nullif(btrim(v.nom_ancien_locataire), ''),
      date_preavis            = v.date_preavis,
      date_envoi_reservataire = v.date_envoi_reservataire
    where id = v_vacance;
  end if;

  return v_id;
end $$;

revoke execute on function public.rechercher_logements(text, jsonb, text, text, integer, integer) from public, anon;
grant  execute on function public.rechercher_logements(text, jsonb, text, text, integer, integer) to authenticated;
revoke execute on function public.enregistrer_logement(uuid, jsonb, jsonb) from public, anon;
grant  execute on function public.enregistrer_logement(uuid, jsonb, jsonb) to authenticated;
