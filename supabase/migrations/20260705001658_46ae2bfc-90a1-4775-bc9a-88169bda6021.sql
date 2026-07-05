-- 1) Colonne pdf_path sur paiements
ALTER TABLE public.paiements
  ADD COLUMN IF NOT EXISTS pdf_path text;

-- 2) Policies storage.objects pour le bucket "recus"
-- Chemin attendu : {auth.uid}/{paiement_id}.pdf
DROP POLICY IF EXISTS "recus_select_own" ON storage.objects;
DROP POLICY IF EXISTS "recus_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "recus_update_own" ON storage.objects;
DROP POLICY IF EXISTS "recus_delete_own" ON storage.objects;

CREATE POLICY "recus_select_own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'recus'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "recus_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'recus'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "recus_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'recus'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'recus'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "recus_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'recus'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );