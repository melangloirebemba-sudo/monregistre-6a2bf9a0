CREATE TYPE public.seance_approbation AS ENUM ('non_requise','en_attente','approuvee','refusee');

ALTER TABLE public.seances
  ADD COLUMN approbation public.seance_approbation NOT NULL DEFAULT 'non_requise',
  ADD COLUMN approbation_note text,
  ADD COLUMN approuve_le timestamptz,
  ADD COLUMN approuve_par uuid REFERENCES auth.users(id);

CREATE TABLE public.seance_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seance_id uuid NOT NULL REFERENCES public.seances(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  note text,
  statut_seance public.seance_statut,
  retard_minutes integer NOT NULL DEFAULT 0,
  approbation public.seance_approbation NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.seance_validations TO authenticated;
GRANT ALL ON public.seance_validations TO service_role;
ALTER TABLE public.seance_validations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enseignant lit son historique de validations"
  ON public.seance_validations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admin gere l historique de validations"
  ON public.seance_validations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_seance_validations_seance ON public.seance_validations(seance_id);

CREATE OR REPLACE FUNCTION public.seance_set_approbation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_requise boolean;
BEGIN
  v_requise := (NEW.statut = 'absence_justifiee') OR (COALESCE(NEW.retard_minutes,0) > 0);

  IF TG_OP = 'UPDATE'
     AND OLD.statut IS NOT DISTINCT FROM NEW.statut
     AND COALESCE(OLD.retard_minutes,0) = COALESCE(NEW.retard_minutes,0) THEN
    RETURN NEW;
  END IF;

  IF v_requise THEN
    NEW.approbation := 'en_attente';
    NEW.approuve_le := NULL;
    NEW.approuve_par := NULL;
  ELSE
    NEW.approbation := 'non_requise';
    NEW.approuve_le := NULL;
    NEW.approuve_par := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER t_seances_approbation
  BEFORE INSERT OR UPDATE ON public.seances
  FOR EACH ROW EXECUTE FUNCTION public.seance_set_approbation();

CREATE OR REPLACE FUNCTION public.seance_log_demande()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.approbation = 'en_attente'
     AND (TG_OP = 'INSERT' OR OLD.approbation IS DISTINCT FROM 'en_attente') THEN
    INSERT INTO public.seance_validations
      (seance_id, user_id, action, note, statut_seance, retard_minutes, approbation, created_by)
    VALUES
      (NEW.id, NEW.user_id, 'demande', NEW.motif, NEW.statut,
       COALESCE(NEW.retard_minutes,0), 'en_attente', NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER t_seances_log_demande
  AFTER INSERT OR UPDATE ON public.seances
  FOR EACH ROW EXECUTE FUNCTION public.seance_log_demande();

CREATE POLICY "Admin lit les seances"
  ON public.seances FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin met a jour les seances"
  ON public.seances FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE UNIQUE INDEX IF NOT EXISTS seances_uniq_creneau_date
  ON public.seances(user_id, creneau_id, date)
  WHERE creneau_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.approuver_seance(_seance_id uuid, _approuver boolean, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seance public.seances%ROWTYPE;
  v_statut public.seance_approbation;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;

  SELECT * INTO v_seance FROM public.seances WHERE id = _seance_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Séance introuvable';
  END IF;

  v_statut := CASE WHEN _approuver THEN 'approuvee'::public.seance_approbation
                   ELSE 'refusee'::public.seance_approbation END;

  UPDATE public.seances
     SET approbation = v_statut,
         approbation_note = _note,
         approuve_le = now(),
         approuve_par = auth.uid()
   WHERE id = _seance_id;

  INSERT INTO public.seance_validations
    (seance_id, user_id, action, note, statut_seance, retard_minutes, approbation, created_by)
  VALUES
    (_seance_id, v_seance.user_id, CASE WHEN _approuver THEN 'approbation' ELSE 'refus' END,
     _note, v_seance.statut, COALESCE(v_seance.retard_minutes,0), v_statut, auth.uid());

  INSERT INTO public.user_notifications (user_id, title, body, category, href)
  VALUES (
    v_seance.user_id,
    CASE WHEN _approuver THEN 'Séance approuvée' ELSE 'Séance refusée' END,
    to_char(v_seance.date, 'DD/MM/YYYY') || ' — ' ||
    CASE WHEN _approuver THEN 'votre justification a été acceptée.'
         ELSE 'votre justification a été refusée.' END ||
    COALESCE(' ' || _note, ''),
    'remuneration',
    '/remuneration'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.seance_set_approbation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seance_log_demande() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.approuver_seance(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approuver_seance(uuid, boolean, text) TO authenticated;