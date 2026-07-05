-- 1) Table user_notifications
CREATE TABLE public.user_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  category TEXT NOT NULL DEFAULT 'feature',
  href TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_notifications TO authenticated;
GRANT ALL ON public.user_notifications TO service_role;

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON public.user_notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can mark their own notifications as read"
  ON public.user_notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications"
  ON public.user_notifications FOR DELETE
  USING (auth.uid() = user_id);

-- Insertion : soit le propriétaire (rare), soit un admin qui pousse vers autrui.
CREATE POLICY "Users can insert their own notifications"
  ON public.user_notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can insert any notification"
  ON public.user_notifications FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_user_notifications_user_created
  ON public.user_notifications(user_id, created_at DESC);

-- 2) Realtime
ALTER TABLE public.user_notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'user_notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications';
  END IF;
END $$;

-- 3) Fan-out sur nouvelle demande de suppression
CREATE OR REPLACE FUNCTION public.notify_account_deletion_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_id UUID;
  who TEXT := COALESCE(NEW.user_nom, NEW.user_email, 'Un utilisateur');
BEGIN
  -- Notification de confirmation pour le demandeur
  INSERT INTO public.user_notifications (user_id, title, body, category, href)
  VALUES (
    NEW.user_id,
    'Demande de suppression enregistrée',
    'Votre compte est suspendu. Un administrateur peut le réactiver sur demande.',
    'account',
    '/parametres'
  );

  -- Notification pour chaque administrateur
  FOR admin_id IN
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  LOOP
    INSERT INTO public.user_notifications (user_id, title, body, category, href)
    VALUES (
      admin_id,
      'Nouvelle demande de suppression',
      who || ' a demandé la suspension de son compte.',
      'account',
      '/admin'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_account_deletion_request
  AFTER INSERT ON public.account_deletion_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_account_deletion_request();

-- 4) Notifier l'utilisateur quand un admin réactive son compte (statut passe de suspendu à actif)
CREATE OR REPLACE FUNCTION public.notify_account_reactivated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.statut = 'suspendu' AND NEW.statut = 'actif' THEN
    INSERT INTO public.user_notifications (user_id, title, body, category, href)
    VALUES (
      NEW.user_id,
      'Votre compte a été réactivé',
      'Un administrateur a réactivé votre compte. Vous pouvez à nouveau vous connecter.',
      'account',
      '/accueil'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_account_reactivated
  AFTER UPDATE OF statut ON public.profils_enseignant
  FOR EACH ROW EXECUTE FUNCTION public.notify_account_reactivated();