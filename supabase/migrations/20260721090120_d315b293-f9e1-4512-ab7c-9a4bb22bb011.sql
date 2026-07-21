
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_nom text;
  v_init text;
begin
  v_nom := coalesce(
    nullif(new.raw_user_meta_data->>'nom_affiche', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Invité démo'
  );
  v_init := upper(substr(v_nom, 1, 2));
  insert into public.profils_enseignant (user_id, nom_affiche, initiales, telephone)
  values (
    new.id,
    v_nom,
    v_init,
    nullif(new.raw_user_meta_data->>'telephone', '')
  )
  on conflict (user_id) do update
    set telephone = coalesce(excluded.telephone, public.profils_enseignant.telephone);
  return new;
end;
$function$;
