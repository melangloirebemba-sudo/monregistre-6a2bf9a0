
-- 1. Table annees_scolaires
CREATE TABLE IF NOT EXISTS public.annees_scolaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  libelle text NOT NULL,
  date_debut date,
  date_fin date,
  statut text NOT NULL DEFAULT 'active' CHECK (statut IN ('active','archivee','a_venir')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, libelle)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.annees_scolaires TO authenticated;
GRANT ALL ON public.annees_scolaires TO service_role;

ALTER TABLE public.annees_scolaires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own annees_scolaires"
  ON public.annees_scolaires
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_annees_scolaires_updated_at
  BEFORE UPDATE ON public.annees_scolaires
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Une seule année active par enseignant
CREATE UNIQUE INDEX IF NOT EXISTS annees_scolaires_one_active_per_user
  ON public.annees_scolaires (user_id)
  WHERE statut = 'active';

-- 2. Rattacher les classes à une année scolaire (libelle textuel, simple et rétro-compatible)
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS annee_scolaire text;

CREATE INDEX IF NOT EXISTS classes_annee_scolaire_idx
  ON public.classes (user_id, annee_scolaire);

-- 3. Backfill : créer une entrée annees_scolaires à partir de l'annee_active du profil
INSERT INTO public.annees_scolaires (user_id, libelle, statut)
SELECT user_id, annee_active, 'active'
FROM public.profils_enseignant
WHERE annee_active IS NOT NULL AND annee_active <> ''
ON CONFLICT (user_id, libelle) DO NOTHING;

-- 4. Backfill : rattacher les classes existantes à l'année active de leur enseignant
UPDATE public.classes c
SET annee_scolaire = p.annee_active
FROM public.profils_enseignant p
WHERE c.user_id = p.user_id
  AND c.annee_scolaire IS NULL
  AND p.annee_active IS NOT NULL
  AND p.annee_active <> '';
