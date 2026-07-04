-- =========================================================================
-- 1) plan_prices
-- =========================================================================
CREATE TABLE public.plan_prices (
  plan public.app_plan NOT NULL,
  periode public.plan_periode NOT NULL,
  montant integer NOT NULL DEFAULT 0 CHECK (montant >= 0),
  devise text NOT NULL DEFAULT 'XAF',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (plan, periode)
);

GRANT SELECT ON public.plan_prices TO authenticated;
GRANT ALL ON public.plan_prices TO service_role;

ALTER TABLE public.plan_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plan_prices lisibles par les utilisateurs connectés"
  ON public.plan_prices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "plan_prices modifiables par les admins"
  ON public.plan_prices FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_plan_prices_updated_at
  BEFORE UPDATE ON public.plan_prices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed
INSERT INTO public.plan_prices (plan, periode, montant, devise) VALUES
  ('lite',    'mensuelle',     0, 'XAF'),
  ('lite',    'trimestrielle', 0, 'XAF'),
  ('lite',    'annuelle',      0, 'XAF'),
  ('premium', 'mensuelle',     0, 'XAF'),
  ('premium', 'trimestrielle', 0, 'XAF'),
  ('premium', 'annuelle',      0, 'XAF')
ON CONFLICT (plan, periode) DO NOTHING;

-- =========================================================================
-- 2) paiements
-- =========================================================================
CREATE SEQUENCE IF NOT EXISTS public.paiements_recu_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE public.paiements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_activation_id uuid UNIQUE REFERENCES public.plan_activations(id) ON DELETE SET NULL,
  plan public.app_plan NOT NULL,
  periode public.plan_periode NOT NULL,
  montant integer NOT NULL DEFAULT 0 CHECK (montant >= 0),
  devise text NOT NULL DEFAULT 'XAF',
  numero_recu text UNIQUE,
  paye_le timestamptz NOT NULL DEFAULT now(),
  plan_expires_at timestamptz,
  moyen_paiement text NOT NULL DEFAULT 'manuel',
  note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_paiements_user_id_paye_le ON public.paiements (user_id, paye_le DESC);

GRANT SELECT ON public.paiements TO authenticated;
GRANT ALL ON public.paiements TO service_role;

ALTER TABLE public.paiements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "paiements: chaque utilisateur voit les siens"
  ON public.paiements FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "paiements: admins voient tout"
  ON public.paiements FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "paiements: admins peuvent insérer"
  ON public.paiements FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "paiements: admins peuvent modifier"
  ON public.paiements FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "paiements: admins peuvent supprimer"
  ON public.paiements FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Génération du numéro de reçu
CREATE OR REPLACE FUNCTION public.set_numero_recu()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.numero_recu IS NULL OR NEW.numero_recu = '' THEN
    NEW.numero_recu := 'REC-'
      || to_char(COALESCE(NEW.paye_le, now()), 'YYYY')
      || '-'
      || lpad(nextval('public.paiements_recu_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_paiements_numero_recu
  BEFORE INSERT ON public.paiements
  FOR EACH ROW EXECUTE FUNCTION public.set_numero_recu();
