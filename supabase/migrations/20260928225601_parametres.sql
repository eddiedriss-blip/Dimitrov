-- =====================================================================
-- Page « Paramètres » (administrateurs)
--   * listes déroulantes : activation / désactivation ; suppression interdite
--     dès qu'une valeur est utilisée (tables OU historique) ;
--   * codes des plafonds et types figés (ils sont repris dans l'historique) ;
--   * au moins un administrateur actif en permanence ;
--   * v_usages_referentiels : nombre d'utilisations actuelles de chaque valeur.
-- =====================================================================

alter table public.groupes         add column actif boolean not null default true;
alter table public.plafonds        add column actif boolean not null default true;
alter table public.types_logements add column actif boolean not null default true;

-- ---------------------------------------------------------------------
-- Une valeur apparaît-elle dans l'historique ? (champ modifié, ou ligne créée / supprimée)
-- ---------------------------------------------------------------------
create or replace function private.valeur_dans_historique(p_champ text, p_valeur text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.historique h
    where (h.champ = p_champ and (h.ancienne_valeur #>> '{}' = p_valeur or h.nouvelle_valeur #>> '{}' = p_valeur))
       or (h.action in ('creation', 'suppression')
           and coalesce(h.nouvelle_valeur, h.ancienne_valeur) ->> p_champ = p_valeur)
  )
$$;

-- Suppression refusée si la valeur est (ou a été) utilisée : il faut la désactiver.
create or replace function private.proteger_referentiel()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_champ  text := tg_argv[0];                         -- colonne qui référence la valeur
  v_valeur text := to_jsonb(old) ->> tg_argv[1];       -- id ou code de la valeur supprimée
  v_utilisee boolean;
begin
  v_utilisee := case tg_table_name
    when 'groupes'         then exists (select 1 from public.logements where groupe_id::text = v_valeur)
    when 'reservataires'   then exists (select 1 from public.logements where reservataire_id::text = v_valeur)
    when 'plafonds'        then exists (select 1 from public.logements where plafond_code = v_valeur)
    when 'types_logements' then exists (select 1 from public.logements where type_logement_code = v_valeur)
    when 'entreprises'     then exists (select 1 from public.travaux where entreprise_id::text = v_valeur)
    else true
  end or private.valeur_dans_historique(v_champ, v_valeur);

  if v_utilisee then
    raise exception 'Valeur déjà utilisée : elle ne peut pas être supprimée, désactivez-la.'
      using errcode = 'restrict_violation';
  end if;
  return old;
end $$;

create trigger trg_proteger_referentiel before delete on public.groupes
  for each row execute function private.proteger_referentiel('groupe_id', 'id');
create trigger trg_proteger_referentiel before delete on public.reservataires
  for each row execute function private.proteger_referentiel('reservataire_id', 'id');
create trigger trg_proteger_referentiel before delete on public.plafonds
  for each row execute function private.proteger_referentiel('plafond_code', 'code');
create trigger trg_proteger_referentiel before delete on public.types_logements
  for each row execute function private.proteger_referentiel('type_logement_code', 'code');
create trigger trg_proteger_referentiel before delete on public.entreprises
  for each row execute function private.proteger_referentiel('entreprise_id', 'id');

-- Codes figés : ils sont stockés tels quels dans l'historique.
create or replace function private.figer_code()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.code is distinct from old.code then
    raise exception 'Le code d''une valeur ne peut pas être modifié (il est repris dans l''historique). Créez une nouvelle valeur.'
      using errcode = 'restrict_violation';
  end if;
  return new;
end $$;

create trigger trg_figer_code before update of code on public.plafonds
  for each row execute function private.figer_code();
create trigger trg_figer_code before update of code on public.types_logements
  for each row execute function private.figer_code();

-- ---------------------------------------------------------------------
-- Toujours au moins un administrateur actif
-- ---------------------------------------------------------------------
create or replace function private.garder_un_admin()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'admin' and old.actif and not (new.role = 'admin' and new.actif) then
    if not exists (select 1 from public.utilisateurs u where u.id <> old.id and u.role = 'admin' and u.actif) then
      raise exception 'Il doit rester au moins un administrateur actif.'
        using errcode = 'restrict_violation';
    end if;
  end if;
  return new;
end $$;

create trigger trg_garder_un_admin before update on public.utilisateurs
  for each row execute function private.garder_un_admin();

revoke execute on function private.valeur_dans_historique(text, text) from public, anon;
grant  execute on function private.valeur_dans_historique(text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Nombre d'utilisations actuelles (affiché dans les Paramètres)
-- ---------------------------------------------------------------------
create view public.v_usages_referentiels
with (security_invoker = true) as
          select 'groupes'::text as liste, groupe_id::text as cle, count(*)::integer as nb from public.logements group by groupe_id
union all select 'reservataires', reservataire_id::text, count(*)::integer from public.logements where reservataire_id is not null group by reservataire_id
union all select 'plafonds', plafond_code, count(*)::integer from public.logements where plafond_code is not null group by plafond_code
union all select 'types_logements', type_logement_code, count(*)::integer from public.logements group by type_logement_code
union all select 'entreprises', entreprise_id::text, count(*)::integer from public.travaux where entreprise_id is not null group by entreprise_id;
