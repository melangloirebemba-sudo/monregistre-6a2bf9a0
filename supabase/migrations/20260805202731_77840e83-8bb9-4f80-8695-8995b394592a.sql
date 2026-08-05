ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS cycle text;

CREATE TABLE public.catalogue_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('cycle','classe','matiere')),
  cycle text,
  valeur text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalogue_entries TO authenticated;
GRANT ALL ON public.catalogue_entries TO service_role;

ALTER TABLE public.catalogue_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own catalogue entries"
ON public.catalogue_entries FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE UNIQUE INDEX catalogue_entries_uniq
  ON public.catalogue_entries (user_id, type, lower(coalesce(cycle,'')), lower(valeur));

CREATE TRIGGER t_catalogue_entries_upd
BEFORE UPDATE ON public.catalogue_entries
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();