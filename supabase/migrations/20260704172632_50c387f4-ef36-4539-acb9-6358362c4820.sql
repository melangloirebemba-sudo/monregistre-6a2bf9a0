-- 1) Enum de période d'abonnement
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_periode') THEN
    CREATE TYPE public.plan_periode AS ENUM ('mensuelle', 'trimestrielle', 'annuelle');
  END IF;
END $$;

-- 2) Colonnes de suivi d'abonnement sur profils_enseignant
ALTER TABLE public.profils_enseignant
  ADD COLUMN IF NOT EXISTS plan_periode public.plan_periode,
  ADD COLUMN IF NOT EXISTS plan_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz;

-- 3) Helper: nombre de jours pour une période donnée
CREATE OR REPLACE FUNCTION public.plan_periode_days(_periode public.plan_periode)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE _periode
    WHEN 'mensuelle'     THEN 30
    WHEN 'trimestrielle' THEN 90
    WHEN 'annuelle'      THEN 300
  END;
$$;

-- 4) Activer un plan payant pour un utilisateur (admin uniquement)
CREATE OR REPLACE FUNCTION public.activate_plan(
  _user_id uuid,
  _plan public.app_plan,
  _periode public.plan_periode
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;

  IF _plan = 'gratuit' THEN
    UPDATE public.profils_enseignant
       SET plan = 'gratuit',
           plan_periode = NULL,
           plan_started_at = NULL,
           plan_expires_at = NULL
     WHERE user_id = _user_id;
    RETURN;
  END IF;

  v_days := public.plan_periode_days(_periode);

  UPDATE public.profils_enseignant
     SET plan = _plan,
         plan_periode = _periode,
         plan_started_at = now(),
         plan_expires_at = now() + make_interval(days => v_days),
         statut = 'actif'
   WHERE user_id = _user_id;
END;
$$;

-- 5) Retourner le plan effectif : si expiré => gratuit
CREATE OR REPLACE FUNCTION public.get_user_plan(_user_id uuid)
RETURNS public.app_plan
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT CASE
              WHEN plan <> 'gratuit'::public.app_plan
                   AND plan_expires_at IS NOT NULL
                   AND plan_expires_at <= now()
                THEN 'gratuit'::public.app_plan
              ELSE plan
            END
       FROM public.profils_enseignant
      WHERE user_id = _user_id),
    'gratuit'::public.app_plan
  );
$$;

-- 6) Balayage périodique : rétrograder les plans expirés
CREATE OR REPLACE FUNCTION public.expire_plans()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.profils_enseignant
     SET plan = 'gratuit',
         plan_periode = NULL,
         plan_started_at = NULL,
         plan_expires_at = NULL
   WHERE plan <> 'gratuit'
     AND plan_expires_at IS NOT NULL
     AND plan_expires_at <= now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 7) Planifier le balayage quotidien (nécessite pg_cron déjà activé)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('expire-plans-daily')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-plans-daily');
    PERFORM cron.schedule(
      'expire-plans-daily',
      '15 2 * * *',
      $cron$ SELECT public.expire_plans(); $cron$
    );
  END IF;
END $$;
