CREATE TABLE public.plan_activations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan public.app_plan NOT NULL,
  periode public.plan_periode,
  plan_started_at timestamptz NOT NULL DEFAULT now(),
  plan_expires_at timestamptz,
  activated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  activated_by_email text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX plan_activations_user_id_created_at_idx
  ON public.plan_activations (user_id, created_at DESC);

GRANT SELECT ON public.plan_activations TO authenticated;
GRANT ALL ON public.plan_activations TO service_role;

ALTER TABLE public.plan_activations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own activation history"
  ON public.plan_activations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all activations"
  ON public.plan_activations
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
