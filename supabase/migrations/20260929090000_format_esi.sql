-- =====================================================================
-- Format du N° ESI : 5 chiffres + « L » + 4 chiffres (ex. 12345L0012)
--   * les 5 premiers chiffres = n° du groupe (immeuble)
--   * les 4 derniers          = n° du logement dans le groupe
-- Le groupe d'un logement est donc DÉDUIT du N° ESI (jamais choisi à la main) ;
-- s'il n'existe pas encore, il est créé (nom provisoire « Groupe 12345 », à renommer dans Paramètres).
-- =====================================================================

-- Codes de groupe : 5 chiffres, figés après création (ils composent les N° ESI).
alter table public.groupes
  add constraint groupes_code_format check (code ~ '^[0-9]{5}$');

create trigger trg_figer_code before update of code on public.groupes
  for each row execute function private.figer_code();

alter table public.logements
  add constraint logements_numero_esi_format check (numero_esi ~ '^[0-9]{5}L[0-9]{4}$');

-- Normalise le N° ESI (espaces retirés, « l » → « L »), le valide et rattache le groupe.
create or replace function private.preparer_numero_esi()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_code   text;
  v_groupe uuid;
begin
  new.numero_esi := upper(regexp_replace(coalesce(new.numero_esi, ''), '\s', '', 'g'));
  if new.numero_esi !~ '^[0-9]{5}L[0-9]{4}$' then
    raise exception 'N° ESI invalide : format attendu 5 chiffres, la lettre L, puis 4 chiffres (ex. 12345L0012).'
      using errcode = 'check_violation';
  end if;

  v_code := left(new.numero_esi, 5);
  select id into v_groupe from public.groupes where code = v_code;
  if v_groupe is null then
    insert into public.groupes (code, nom) values (v_code, 'Groupe ' || v_code)
    returning id into v_groupe;
  end if;

  new.groupe_id := v_groupe;
  return new;
end $$;

create trigger trg_logements_esi before insert or update of numero_esi, groupe_id on public.logements
  for each row execute function private.preparer_numero_esi();
