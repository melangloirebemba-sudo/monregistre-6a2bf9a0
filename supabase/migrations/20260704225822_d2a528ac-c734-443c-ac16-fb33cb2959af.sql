CREATE TABLE public.admin_password_changes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_email TEXT,
  changed_by UUID,
  changed_by_email TEXT,
  source TEXT NOT NULL DEFAULT 'self',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX admin_password_changes_created_at_idx
  ON public.admin_password_changes (created_at DESC);

GRANT SELECT ON public.admin_password_changes TO authenticated;
GRANT ALL ON public.admin_password_changes TO service_role;

ALTER TABLE public.admin_password_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view password change log"
  ON public.admin_password_changes
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));