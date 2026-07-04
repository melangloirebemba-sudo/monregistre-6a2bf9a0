
-- Ensure classe.ecole_id matches eleve.ecole_id via a composite foreign key.
-- 1) Composite unique index required by the FK target.
CREATE UNIQUE INDEX IF NOT EXISTS classes_id_ecole_unique
  ON public.classes (id, ecole_id);

-- 2) Composite FK on eleves(classe_id, ecole_id) -> classes(id, ecole_id).
--    This guarantees the classe belongs to the same ecole, even if the client
--    is bypassed. The existing eleves_classe_id_fkey remains for ON DELETE CASCADE.
ALTER TABLE public.eleves
  DROP CONSTRAINT IF EXISTS eleves_classe_ecole_fkey;

ALTER TABLE public.eleves
  ADD CONSTRAINT eleves_classe_ecole_fkey
  FOREIGN KEY (classe_id, ecole_id)
  REFERENCES public.classes (id, ecole_id)
  ON UPDATE CASCADE
  ON DELETE CASCADE;
