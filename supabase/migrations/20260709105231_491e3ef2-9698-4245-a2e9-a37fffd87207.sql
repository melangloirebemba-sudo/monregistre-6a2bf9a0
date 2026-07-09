
-- Helper: notify all admins
CREATE OR REPLACE FUNCTION public.notify_admins_new_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_id uuid;
  who text := COALESCE(NEW.nom_affiche, 'Un enseignant');
BEGIN
  FOR admin_id IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    INSERT INTO public.user_notifications (user_id, title, body, category, href)
    VALUES (
      admin_id,
      'Nouvelle inscription',
      who || ' vient de créer un compte.',
      'account',
      '/admin/utilisateurs'
    );
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_admins_new_signup() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_admins_new_signup ON public.profils_enseignant;
CREATE TRIGGER trg_notify_admins_new_signup
AFTER INSERT ON public.profils_enseignant
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_new_signup();

-- New payment recorded
CREATE OR REPLACE FUNCTION public.notify_admins_new_paiement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_id uuid;
  who text;
BEGIN
  SELECT COALESCE(nom_affiche, 'Un utilisateur') INTO who
    FROM public.profils_enseignant WHERE user_id = NEW.user_id;
  FOR admin_id IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    INSERT INTO public.user_notifications (user_id, title, body, category, href)
    VALUES (
      admin_id,
      'Nouveau paiement enregistré',
      COALESCE(who,'Un utilisateur') || ' — ' || NEW.plan::text || ' (' || (NEW.montant::text) || ' ' || COALESCE(NEW.devise,'XAF') || ')',
      'billing',
      '/admin/facturation'
    );
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_admins_new_paiement() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_admins_new_paiement ON public.paiements;
CREATE TRIGGER trg_notify_admins_new_paiement
AFTER INSERT ON public.paiements
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_new_paiement();

-- Plan activations
CREATE OR REPLACE FUNCTION public.notify_admins_plan_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_id uuid;
  who text;
BEGIN
  SELECT COALESCE(nom_affiche, 'Un utilisateur') INTO who
    FROM public.profils_enseignant WHERE user_id = NEW.user_id;
  FOR admin_id IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    INSERT INTO public.user_notifications (user_id, title, body, category, href)
    VALUES (
      admin_id,
      'Activation de plan',
      COALESCE(who,'Un utilisateur') || ' — plan ' || NEW.plan::text || ' (' || NEW.periode::text || ')',
      'billing',
      '/admin/plans'
    );
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_admins_plan_activation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_admins_plan_activation ON public.plan_activations;
CREATE TRIGGER trg_notify_admins_plan_activation
AFTER INSERT ON public.plan_activations
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_plan_activation();
