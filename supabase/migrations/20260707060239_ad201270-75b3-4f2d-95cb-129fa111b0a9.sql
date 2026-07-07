CREATE OR REPLACE FUNCTION public.notify_account_reactivated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.statut = 'suspendu' AND NEW.statut = 'actif' THEN
    INSERT INTO public.user_notifications (user_id, title, body, category, href)
    VALUES (
      NEW.user_id,
      'Votre compte a été réactivé',
      'Un administrateur a réactivé votre compte. Vous pouvez à nouveau vous connecter.',
      'reactivation',
      '/accueil'
    );
  END IF;
  RETURN NEW;
END;
$function$;