-- =====================================================================
-- Page « Chiffres » : statistiques calculées par la base, en un appel.
--
-- Définitions (reprises dans l'interface) :
--   * vacant sur une période  = au moins un jour de vacance dans la période
--       (une vacance court de date_debut inclus à date_fin exclu ; une vacance en
--        cours s'arrête à aujourd'hui : jamais comptée dans un mois futur) ;
--   * devenus vacants / loués  = logements DISTINCTS ;
--   * entrées / sorties de vacance = MOUVEMENTS (un logement peut entrer deux fois
--       en vacance dans l'année) ; une sortie de vacance = une location ;
--   * travaux = ceux des vacances de la période, selon leur statut actuel.
-- Filtres : année (obligatoire), mois, groupe, type. RLS de l'appelant appliquée.
-- =====================================================================

create or replace function public.statistiques(
  p_annee  integer,
  p_mois   integer default null,
  p_groupe uuid    default null,
  p_type   text    default null
)
returns jsonb
language sql stable security invoker set search_path = '' as $$
with
bornes as (
  select
    case when p_mois between 1 and 12 then make_date(p_annee, p_mois, 1) else make_date(p_annee, 1, 1) end as debut,
    case when p_mois between 1 and 12 then (make_date(p_annee, p_mois, 1) + interval '1 month')::date
         else make_date(p_annee + 1, 1, 1) end as fin     -- exclue
),
v as (
  select va.id, va.logement_id, va.date_debut, va.date_fin,
         coalesce(va.date_fin, current_date + 1) as fin_effective,
         l.groupe_id, l.type_logement_code, l.statut_code
  from public.vacances va
  join public.logements l on l.id = va.logement_id
  where va.date_debut <= current_date
    and (p_groupe is null or l.groupe_id = p_groupe)
    and (p_type   is null or l.type_logement_code = p_type)
),
-- vacances qui touchent la période sélectionnée
vp as (
  select v.* from v, bornes b
  where v.date_debut < b.fin and v.fin_effective > b.debut
),
mois as (
  select m, make_date(p_annee, m, 1) as debut, (make_date(p_annee, m, 1) + interval '1 month')::date as fin
  from generate_series(1, 12) as m
),
annees as (
  select a, make_date(a, 1, 1) as debut, make_date(a + 1, 1, 1) as fin
  from generate_series(
    greatest(coalesce((select extract(year from min(date_debut))::integer from v), extract(year from current_date)::integer),
             extract(year from current_date)::integer - 9),
    extract(year from current_date)::integer) as a
)
select jsonb_build_object(
  'periode', (select jsonb_build_object('debut', debut, 'fin', fin - 1) from bornes),

  'vacants', jsonb_build_object(
    'actuellement', (select count(distinct logement_id) from v where date_fin is null),
    'periode',      (select count(distinct logement_id) from vp),
    'par_groupe', coalesce((
      select jsonb_agg(jsonb_build_object('id', g.id, 'libelle', g.nom, 'valeur', x.n) order by x.n desc, g.nom)
      from (select groupe_id, count(distinct logement_id) as n from vp group by groupe_id) x
      join public.groupes g on g.id = x.groupe_id), '[]'::jsonb),
    'par_type', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.code, 'libelle', t.libelle, 'valeur', x.n) order by t.ordre)
      from (select type_logement_code, count(distinct logement_id) as n from vp group by type_logement_code) x
      join public.types_logements t on t.code = x.type_logement_code), '[]'::jsonb),
    'par_statut', (
      select jsonb_agg(jsonb_build_object('id', s.code, 'libelle', s.libelle,
               'valeur', (select count(distinct vp.logement_id) from vp where vp.statut_code = s.code)) order by s.ordre)
      from public.statuts s where s.entite = 'logement')
  ),

  'mouvements', (
    select jsonb_build_object(
      'devenus_vacants', count(distinct v.logement_id) filter (where v.date_debut >= b.debut and v.date_debut < b.fin),
      'entrees',         count(*)                      filter (where v.date_debut >= b.debut and v.date_debut < b.fin),
      'loues',           count(distinct v.logement_id) filter (where v.date_fin   >= b.debut and v.date_fin   < b.fin),
      'sorties',         count(*)                      filter (where v.date_fin   >= b.debut and v.date_fin   < b.fin))
    from v, bornes b),

  'travaux', (
    select jsonb_build_object(
      'logements_avec_travaux', count(distinct vp.logement_id),
      'total',       count(t.id),
      'a_commander', count(t.id) filter (where t.statut_code = 'a_commander'),
      'commande',    count(t.id) filter (where t.statut_code = 'commande'),
      'fini',        count(t.id) filter (where t.statut_code = 'fini'))
    from vp join public.travaux t on t.vacance_id = vp.id),

  -- 12 mois de l'année choisie ; null pour les mois pas encore commencés
  'mensuel', (
    select jsonb_agg(jsonb_build_object(
      'mois', mo.m,
      'vacants', case when mo.debut > current_date then null else
        (select count(distinct v.logement_id) from v where v.date_debut < mo.fin and v.fin_effective > mo.debut) end,
      'entrees', case when mo.debut > current_date then null else
        (select count(*) from v where v.date_debut >= mo.debut and v.date_debut < mo.fin) end,
      'sorties', case when mo.debut > current_date then null else
        (select count(*) from v where v.date_fin >= mo.debut and v.date_fin < mo.fin) end
    ) order by mo.m)
    from mois mo),

  -- 10 dernières années au plus, depuis la première vacance enregistrée
  'annuel', (
    select jsonb_agg(jsonb_build_object(
      'annee', an.a,
      'vacants', (select count(distinct v.logement_id) from v where v.date_debut < an.fin and v.fin_effective > an.debut),
      'entrees', (select count(*) from v where v.date_debut >= an.debut and v.date_debut < an.fin),
      'sorties', (select count(*) from v where v.date_fin >= an.debut and v.date_fin < an.fin)
    ) order by an.a)
    from annees an),

  'annees_disponibles', (select jsonb_agg(a order by a desc) from annees)
)
$$;

revoke execute on function public.statistiques(integer, integer, uuid, text) from public, anon;
grant  execute on function public.statistiques(integer, integer, uuid, text) to authenticated;
