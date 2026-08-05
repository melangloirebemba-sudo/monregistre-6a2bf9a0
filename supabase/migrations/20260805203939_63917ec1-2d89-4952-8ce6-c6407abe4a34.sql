-- 1. Déduplication normalisée (casse + espaces multiples)
DELETE FROM public.catalogue_entries a
USING public.catalogue_entries b
WHERE a.ctid > b.ctid
  AND a.user_id = b.user_id
  AND a.type = b.type
  AND lower(btrim(regexp_replace(coalesce(a.cycle,''), '\s+', ' ', 'g'))) = lower(btrim(regexp_replace(coalesce(b.cycle,''), '\s+', ' ', 'g')))
  AND lower(btrim(regexp_replace(a.valeur, '\s+', ' ', 'g'))) = lower(btrim(regexp_replace(b.valeur, '\s+', ' ', 'g')));

DROP INDEX IF EXISTS public.catalogue_entries_uniq;
CREATE UNIQUE INDEX catalogue_entries_uniq ON public.catalogue_entries
  (user_id, type,
   lower(btrim(regexp_replace(coalesce(cycle,''), '\s+', ' ', 'g'))),
   lower(btrim(regexp_replace(valeur, '\s+', ' ', 'g'))));

-- 2. Historique
CREATE TABLE public.catalogue_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  entry_id uuid,
  action text NOT NULL,
  type text NOT NULL,
  cycle text,
  ancienne_valeur text,
  nouvelle_valeur text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.catalogue_history TO authenticated;
GRANT ALL ON public.catalogue_history TO service_role;

ALTER TABLE public.catalogue_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalogue_history_select_own" ON public.catalogue_history
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "catalogue_history_insert_own" ON public.catalogue_history
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "catalogue_history_delete_own" ON public.catalogue_history
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX idx_catalogue_history_user ON public.catalogue_history (user_id, created_at DESC);

-- 3. Journalisation automatique
CREATE OR REPLACE FUNCTION public.log_catalogue_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.catalogue_history (user_id, entry_id, action, type, cycle, nouvelle_valeur)
    VALUES (NEW.user_id, NEW.id, 'ajout', NEW.type, NEW.cycle, NEW.valeur);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.valeur IS DISTINCT FROM OLD.valeur OR NEW.cycle IS DISTINCT FROM OLD.cycle THEN
      INSERT INTO public.catalogue_history (user_id, entry_id, action, type, cycle, ancienne_valeur, nouvelle_valeur)
      VALUES (NEW.user_id, NEW.id, 'modification', NEW.type, NEW.cycle, OLD.valeur, NEW.valeur);
    END IF;
    RETURN NEW;
  ELSE
    INSERT INTO public.catalogue_history (user_id, entry_id, action, type, cycle, ancienne_valeur)
    VALUES (OLD.user_id, OLD.id, 'suppression', OLD.type, OLD.cycle, OLD.valeur);
    RETURN OLD;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_catalogue_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_catalogue_history
AFTER INSERT OR UPDATE OR DELETE ON public.catalogue_entries
FOR EACH ROW EXECUTE FUNCTION public.log_catalogue_change();