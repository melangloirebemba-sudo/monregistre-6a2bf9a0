CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profils_enseignant (user_id, nom_affiche, initiales, telephone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nom_affiche', split_part(new.email, '@', 1)),
    upper(substr(coalesce(new.raw_user_meta_data->>'nom_affiche', new.email), 1, 2)),
    nullif(new.raw_user_meta_data->>'telephone', '')
  )
  on conflict (user_id) do update
    set telephone = coalesce(excluded.telephone, public.profils_enseignant.telephone);
  return new;
end;
$function$;