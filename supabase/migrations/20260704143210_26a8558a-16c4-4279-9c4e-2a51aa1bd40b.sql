
ALTER TABLE public.profils_enseignant
  ADD COLUMN IF NOT EXISTS prenom text,
  ADD COLUMN IF NOT EXISTS nom_famille text,
  ADD COLUMN IF NOT EXISTS telephone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS matiere_principale text,
  ADD COLUMN IF NOT EXISTS etablissement text;
