-- ============================================================
-- 1. RÔLES
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

DROP POLICY IF EXISTS "Users read own roles or admin reads all" ON public.user_roles;
CREATE POLICY "Users read own roles or admin reads all" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage all roles" ON public.user_roles;
CREATE POLICY "Admins manage all roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 2. PLANS ET STATUT
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.app_plan AS ENUM ('gratuit', 'lite', 'premium');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.user_statut AS ENUM ('actif', 'suspendu');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profils_enseignant
  ADD COLUMN IF NOT EXISTS plan public.app_plan NOT NULL DEFAULT 'gratuit',
  ADD COLUMN IF NOT EXISTS statut public.user_statut NOT NULL DEFAULT 'actif';

-- Admins peuvent tout voir/modifier sur les profils
DROP POLICY IF EXISTS "Admins full access profils_enseignant" ON public.profils_enseignant;
CREATE POLICY "Admins full access profils_enseignant" ON public.profils_enseignant
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.get_user_plan(_user_id uuid)
RETURNS public.app_plan
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT plan FROM public.profils_enseignant WHERE user_id = _user_id),
    'gratuit'::public.app_plan
  );
$$;

-- ============================================================
-- 3. APPLICATION DES LIMITES DE PLAN (triggers)
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_plan_limits()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_plan public.app_plan;
  v_count int;
  v_max_ecoles int;
  v_max_classes_par_ecole int;
  v_max_eleves int;
BEGIN
  IF public.has_role(NEW.user_id, 'admin') THEN
    RETURN NEW;
  END IF;

  v_plan := public.get_user_plan(NEW.user_id);

  IF v_plan = 'premium' THEN
    RETURN NEW;
  ELSIF v_plan = 'lite' THEN
    v_max_ecoles := 2; v_max_classes_par_ecole := 2; v_max_eleves := 2147483647;
  ELSE
    v_max_ecoles := 1; v_max_classes_par_ecole := 1; v_max_eleves := 25;
  END IF;

  IF TG_TABLE_NAME = 'ecoles' THEN
    SELECT count(*) INTO v_count FROM public.ecoles WHERE user_id = NEW.user_id;
    IF v_count >= v_max_ecoles THEN
      RAISE EXCEPTION 'PLAN_LIMIT_ECOLES: Votre plan % autorise au maximum % école(s). Passez à un plan supérieur.', v_plan, v_max_ecoles;
    END IF;
  ELSIF TG_TABLE_NAME = 'classes' THEN
    SELECT count(*) INTO v_count FROM public.classes WHERE user_id = NEW.user_id AND ecole_id = NEW.ecole_id;
    IF v_count >= v_max_classes_par_ecole THEN
      RAISE EXCEPTION 'PLAN_LIMIT_CLASSES: Votre plan % autorise au maximum % classe(s) par école. Passez à un plan supérieur.', v_plan, v_max_classes_par_ecole;
    END IF;
  ELSIF TG_TABLE_NAME = 'eleves' THEN
    SELECT count(*) INTO v_count FROM public.eleves WHERE user_id = NEW.user_id;
    IF v_count >= v_max_eleves THEN
      RAISE EXCEPTION 'PLAN_LIMIT_ELEVES: Votre plan % autorise au maximum % élèves. Passez à un plan supérieur.', v_plan, v_max_eleves;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_plan_limits_ecoles ON public.ecoles;
CREATE TRIGGER trg_plan_limits_ecoles BEFORE INSERT ON public.ecoles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_limits();

DROP TRIGGER IF EXISTS trg_plan_limits_classes ON public.classes;
CREATE TRIGGER trg_plan_limits_classes BEFORE INSERT ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_limits();

DROP TRIGGER IF EXISTS trg_plan_limits_eleves ON public.eleves;
CREATE TRIGGER trg_plan_limits_eleves BEFORE INSERT ON public.eleves
  FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_limits();

-- ============================================================
-- 4. POLITIQUES ADMIN — ACCÈS TOTAL
-- ============================================================
DROP POLICY IF EXISTS "Admins full access ecoles" ON public.ecoles;
CREATE POLICY "Admins full access ecoles" ON public.ecoles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins full access classes" ON public.classes;
CREATE POLICY "Admins full access classes" ON public.classes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins full access eleves" ON public.eleves;
CREATE POLICY "Admins full access eleves" ON public.eleves FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins full access annees_scolaires" ON public.annees_scolaires;
CREATE POLICY "Admins full access annees_scolaires" ON public.annees_scolaires FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 5. TRIGGER : admin@master.cg = admin + premium automatique
-- ============================================================
CREATE OR REPLACE FUNCTION public.assign_admin_by_email()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.email = 'admin@master.cg' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;

    UPDATE public.profils_enseignant
       SET plan = 'premium', statut = 'actif'
     WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.assign_admin_by_email();

-- ============================================================
-- 6. SEED DU COMPTE ADMIN
-- ============================================================
DO $$
DECLARE
  v_uid uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = 'admin@master.cg';

  IF v_uid IS NULL THEN
    v_uid := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      is_super_admin, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_uid, 'authenticated', 'authenticated',
      'admin@master.cg', crypt('Admin@master123', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"nom_affiche":"Administrateur"}'::jsonb,
      false, '', '', '', ''
    );

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_uid,
      jsonb_build_object('sub', v_uid::text, 'email', 'admin@master.cg'),
      'email', v_uid::text,
      now(), now(), now()
    );
  ELSE
    -- S'assurer que le compte existant a bien les bons privilèges
    INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
    UPDATE public.profils_enseignant SET plan = 'premium', statut = 'actif' WHERE user_id = v_uid;
  END IF;
END $$;
