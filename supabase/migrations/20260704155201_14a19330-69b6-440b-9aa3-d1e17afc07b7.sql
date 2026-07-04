-- Plan limits configuration table
CREATE TABLE IF NOT EXISTS public.plan_limits (
  plan public.app_plan PRIMARY KEY,
  max_ecoles integer NOT NULL,
  max_classes_par_ecole integer NOT NULL,
  max_eleves integer NOT NULL,
  bulletins_pdf boolean NOT NULL DEFAULT false,
  rapports boolean NOT NULL DEFAULT false,
  progression boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.plan_limits TO authenticated, anon;
GRANT ALL ON public.plan_limits TO service_role;

ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plan_limits readable by everyone"
  ON public.plan_limits FOR SELECT
  USING (true);

CREATE POLICY "plan_limits admin write"
  ON public.plan_limits FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_plan_limits_updated
  BEFORE UPDATE ON public.plan_limits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed defaults
INSERT INTO public.plan_limits (plan, max_ecoles, max_classes_par_ecole, max_eleves, bulletins_pdf, rapports, progression) VALUES
  ('gratuit', 1, 1, 25, false, false, false),
  ('lite',    2, 2, 2147483647, true, true, false),
  ('premium', 2147483647, 2147483647, 2147483647, true, true, true)
ON CONFLICT (plan) DO NOTHING;

-- Rewrite the enforce_plan_limits function to read from plan_limits table
CREATE OR REPLACE FUNCTION public.enforce_plan_limits()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_plan public.app_plan;
  v_count int;
  v_limits public.plan_limits%ROWTYPE;
BEGIN
  IF public.has_role(NEW.user_id, 'admin') THEN
    RETURN NEW;
  END IF;

  v_plan := public.get_user_plan(NEW.user_id);

  SELECT * INTO v_limits FROM public.plan_limits WHERE plan = v_plan;
  IF NOT FOUND THEN
    -- fallback safe defaults
    v_limits.max_ecoles := 1;
    v_limits.max_classes_par_ecole := 1;
    v_limits.max_eleves := 25;
  END IF;

  IF TG_TABLE_NAME = 'ecoles' THEN
    SELECT count(*) INTO v_count FROM public.ecoles WHERE user_id = NEW.user_id;
    IF v_count >= v_limits.max_ecoles THEN
      RAISE EXCEPTION 'PLAN_LIMIT_ECOLES: Votre plan % autorise au maximum % école(s). Passez à un plan supérieur.', v_plan, v_limits.max_ecoles;
    END IF;
  ELSIF TG_TABLE_NAME = 'classes' THEN
    SELECT count(*) INTO v_count FROM public.classes WHERE user_id = NEW.user_id AND ecole_id = NEW.ecole_id;
    IF v_count >= v_limits.max_classes_par_ecole THEN
      RAISE EXCEPTION 'PLAN_LIMIT_CLASSES: Votre plan % autorise au maximum % classe(s) par école. Passez à un plan supérieur.', v_plan, v_limits.max_classes_par_ecole;
    END IF;
  ELSIF TG_TABLE_NAME = 'eleves' THEN
    SELECT count(*) INTO v_count FROM public.eleves WHERE user_id = NEW.user_id;
    IF v_count >= v_limits.max_eleves THEN
      RAISE EXCEPTION 'PLAN_LIMIT_ELEVES: Votre plan % autorise au maximum % élèves. Passez à un plan supérieur.', v_plan, v_limits.max_eleves;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;