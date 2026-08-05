-- ENUMS
DO $$ BEGIN
  CREATE TYPE public.cycle_enseignement AS ENUM ('primaire','college','lycee','universite');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.seance_statut AS ENUM ('effectuee','absence_justifiee','absence_non_justifiee','annulee');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.salaire_statut AS ENUM ('en_attente','paye','partiel');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- TARIFS HORAIRES
CREATE TABLE public.tarifs_horaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ecole_id uuid NOT NULL REFERENCES public.ecoles(id) ON DELETE CASCADE,
  cycle public.cycle_enseignement NOT NULL DEFAULT 'college',
  matiere text,
  montant_horaire integer NOT NULL DEFAULT 0,
  devise text NOT NULL DEFAULT 'XAF',
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX tarifs_horaires_unique ON public.tarifs_horaires (user_id, ecole_id, cycle, COALESCE(matiere,''));
CREATE INDEX idx_tarifs_user ON public.tarifs_horaires(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarifs_horaires TO authenticated;
GRANT ALL ON public.tarifs_horaires TO service_role;
ALTER TABLE public.tarifs_horaires ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tarifs owner all" ON public.tarifs_horaires FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tarifs admin read" ON public.tarifs_horaires FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER t_tarifs_upd BEFORE UPDATE ON public.tarifs_horaires
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SEANCES
CREATE TABLE public.seances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ecole_id uuid NOT NULL REFERENCES public.ecoles(id) ON DELETE CASCADE,
  classe_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  creneau_id uuid REFERENCES public.creneaux(id) ON DELETE SET NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  heure_debut time NOT NULL,
  heure_fin time NOT NULL,
  matiere text,
  cycle public.cycle_enseignement NOT NULL DEFAULT 'college',
  statut public.seance_statut NOT NULL DEFAULT 'effectuee',
  retard_minutes integer NOT NULL DEFAULT 0,
  duree_minutes integer NOT NULL DEFAULT 0,
  motif text,
  commentaire text,
  validee_le timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_seances_user_date ON public.seances(user_id, date);
CREATE INDEX idx_seances_ecole ON public.seances(ecole_id);
CREATE UNIQUE INDEX seances_creneau_jour_unique ON public.seances(user_id, creneau_id, date) WHERE creneau_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.seances TO authenticated;
GRANT ALL ON public.seances TO service_role;
ALTER TABLE public.seances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seances owner all" ON public.seances FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "seances admin read" ON public.seances FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER t_seances_upd BEFORE UPDATE ON public.seances
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Calcul auto de la durée nette (retard déduit, 0 si absence non justifiée / annulée)
CREATE OR REPLACE FUNCTION public.seance_compute_duree()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_min integer;
BEGIN
  v_min := GREATEST(0, (EXTRACT(EPOCH FROM (NEW.heure_fin - NEW.heure_debut)) / 60)::int);
  IF NEW.statut IN ('absence_non_justifiee','annulee') THEN
    NEW.duree_minutes := 0;
  ELSIF NEW.statut = 'absence_justifiee' THEN
    NEW.duree_minutes := 0;
  ELSE
    NEW.duree_minutes := GREATEST(0, v_min - COALESCE(NEW.retard_minutes, 0));
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.seance_compute_duree() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER t_seances_duree BEFORE INSERT OR UPDATE ON public.seances
  FOR EACH ROW EXECUTE FUNCTION public.seance_compute_duree();

-- PAIEMENTS DE SALAIRE
CREATE TABLE public.paiements_salaire (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ecole_id uuid NOT NULL REFERENCES public.ecoles(id) ON DELETE CASCADE,
  mois date NOT NULL,
  montant integer NOT NULL DEFAULT 0,
  devise text NOT NULL DEFAULT 'XAF',
  heures_payees numeric NOT NULL DEFAULT 0,
  statut public.salaire_statut NOT NULL DEFAULT 'paye',
  moyen_paiement text,
  reference text,
  note text,
  paye_le timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_paiements_salaire_user ON public.paiements_salaire(user_id, mois);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.paiements_salaire TO authenticated;
GRANT ALL ON public.paiements_salaire TO service_role;
ALTER TABLE public.paiements_salaire ENABLE ROW LEVEL SECURITY;
CREATE POLICY "salaire owner all" ON public.paiements_salaire FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "salaire admin read" ON public.paiements_salaire FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER t_paiements_salaire_upd BEFORE UPDATE ON public.paiements_salaire
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SYNTHESE par école / mois
CREATE OR REPLACE FUNCTION public.synthese_remuneration(_debut date, _fin date)
RETURNS TABLE (
  ecole_id uuid,
  mois date,
  minutes_effectuees integer,
  minutes_perdues integer,
  montant_estime numeric,
  devise text
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    s.ecole_id,
    date_trunc('month', s.date)::date AS mois,
    COALESCE(SUM(s.duree_minutes), 0)::int AS minutes_effectuees,
    COALESCE(SUM(CASE WHEN s.statut <> 'effectuee'
      THEN GREATEST(0, (EXTRACT(EPOCH FROM (s.heure_fin - s.heure_debut))/60)::int)
      ELSE COALESCE(s.retard_minutes,0) END), 0)::int AS minutes_perdues,
    COALESCE(SUM((s.duree_minutes::numeric / 60) * COALESCE(t.montant_horaire, 0)), 0) AS montant_estime,
    COALESCE(MAX(t.devise), 'XAF') AS devise
  FROM public.seances s
  LEFT JOIN public.tarifs_horaires t
    ON t.user_id = s.user_id
   AND t.ecole_id = s.ecole_id
   AND t.cycle = s.cycle
   AND t.actif
   AND (t.matiere IS NULL OR t.matiere = s.matiere)
  WHERE s.user_id = auth.uid()
    AND s.date BETWEEN _debut AND _fin
  GROUP BY s.ecole_id, date_trunc('month', s.date)
  ORDER BY 2 DESC;
$$;
GRANT EXECUTE ON FUNCTION public.synthese_remuneration(date, date) TO authenticated;