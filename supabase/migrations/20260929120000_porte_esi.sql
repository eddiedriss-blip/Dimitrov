-- =====================================================================
-- Porte déduite du N° ESI : les 4 derniers chiffres sont le n° de porte
-- (12345L0273 → porte 273, 12345L0001 → porte 1). Plus de saisie manuelle.
-- =====================================================================

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
  new.porte     := right(new.numero_esi, 4)::int::text;   -- zéros de tête retirés
  return new;
end $$;

drop trigger trg_logements_esi on public.logements;
create trigger trg_logements_esi before insert or update of numero_esi, groupe_id, porte on public.logements
  for each row execute function private.preparer_numero_esi();

-- Logements existants : porte recalculée (changement automatique dans l'historique).
select set_config('app.changement_auto', 'on', false);
update public.logements
   set porte = right(numero_esi, 4)::int::text
 where porte is distinct from right(numero_esi, 4)::int::text;
select set_config('app.changement_auto', '', false);
